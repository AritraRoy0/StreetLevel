/**
 * Position-level and portfolio-level analytics.
 *
 * The portfolio is derived from a transaction log rather than from a snapshot
 * of holdings. A snapshot cannot answer "what did this return", because it has
 * no record of what was paid or when money entered. Replaying transactions
 * gives cost basis, realized profit, cash, and a daily value series that
 * correctly separates market moves from deposits.
 *
 * Cost basis uses **FIFO** lots: a sale consumes the oldest shares first. This
 * is the default method for US brokerage reporting. The choice matters only
 * for the split between realized and unrealized profit, never for total
 * profit.
 */

import { finite, isNum, mean, safeDiv, stdDev, sum } from "./math.ts";
import { averagePairwiseCorrelation, correlationMatrix } from "./compare.ts";
import { dayKey } from "./series.ts";
import { PERIODS_PER_YEAR } from "./types.ts";
import type { Bar, Maybe } from "./types.ts";

export type TransactionType = "buy" | "sell" | "deposit" | "withdraw" | "dividend";

export interface Transaction {
  id: string;
  /** ISO-8601 UTC date of settlement. */
  date: string;
  type: TransactionType;
  /** Required for `buy`, `sell` and `dividend`. */
  symbol?: string;
  /** Share count for `buy` and `sell`. Always positive; direction comes from `type`. */
  shares?: number;
  /** Price per share for `buy` and `sell`. */
  price?: number;
  /** Commission or fee, always reducing cash. */
  fees?: number;
  /** Cash amount for `deposit`, `withdraw` and `dividend`. Always positive. */
  amount?: number;
}

export interface Lot {
  shares: number;
  price: number;
  date: string;
}

export interface PositionMetrics {
  symbol: string;
  shares: number;
  /** Total cash paid for the shares still held, including fees. */
  costBasis: Maybe;
  /** `costBasis / shares`. */
  averageCost: Maybe;
  /** Most recent close available for the symbol, or `null` when no price exists. */
  lastPrice: Maybe;
  /** Timestamp of `lastPrice`. */
  priceAsOf: string | null;
  marketValue: Maybe;
  unrealizedPl: Maybe;
  unrealizedPlPercent: Maybe;
  /** Profit already banked on shares sold, net of fees. */
  realizedPl: Maybe;
  /** Share of total portfolio value, as a fraction. */
  weight: Maybe;
  /** Latest one-session change of the holding, in currency. */
  dayChangeValue: Maybe;
  /** Latest one-session change of the price, as a fraction. */
  dayChangePercent: Maybe;
  /** Fraction of the portfolio's return over the window attributable to this position. */
  contribution: Maybe;
  /** False when no price could be found; the position is then excluded from totals. */
  priced: boolean;
}

export interface PortfolioValuePoint {
  timestamp: string;
  /** Marked-to-market holdings plus cash. */
  value: number;
  /** Holdings only, excluding cash. */
  holdingsValue: number;
  cash: number;
  /** Deposits minus withdrawals settled on this date. */
  externalFlow: number;
  /** Positions with no price on this date, excluded from `holdingsValue`. */
  unpricedSymbols: string[];
}

export interface PortfolioAnalytics {
  positions: PositionMetrics[];
  /** Positions held but impossible to value; surfaced so the UI can say so. */
  unpricedSymbols: string[];
  /**
   * Cost basis locked up in unpriced positions.
   *
   * Exposed because it is the exact amount by which `unrealizedPl + realizedPl`
   * exceeds `totalValue - netContributions`. Without it a reader comparing
   * those figures finds a gap and no explanation for it.
   */
  unpricedCostBasis: Maybe;
  cash: number;
  cashWeight: Maybe;
  /** Cost basis of all open positions. */
  investedValue: Maybe;
  /** Open positions marked to market, excluding cash. */
  holdingsValue: Maybe;
  /** `holdingsValue + cash`. */
  totalValue: Maybe;
  unrealizedPl: Maybe;
  realizedPl: Maybe;
  totalPl: Maybe;
  /** Profit against net money contributed, as a fraction. */
  totalReturn: Maybe;
  /** Deposits minus withdrawals across the whole log. */
  netContributions: number;
  /** Daily marked-to-market value of the portfolio. */
  series: PortfolioValuePoint[];
  /** Time-weighted return across `series`, neutral to the timing of deposits. */
  timeWeightedReturn: Maybe;
  /** Money-weighted return: profit over the average capital employed. */
  simpleReturnOnContributions: Maybe;
  /** Annualized standard deviation of the daily portfolio return. */
  volatility: Maybe;
  maxDrawdown: Maybe;
  /** Average pairwise correlation of the holdings' daily returns. */
  averageCorrelation: Maybe;
  correlation: { symbols: string[]; matrix: Maybe[][] };
  /** Inverse Herfindahl index: the number of equally weighted positions this is worth. */
  effectiveHoldings: Maybe;
  /** Weight of the single largest position, as a fraction. */
  largestWeight: Maybe;
  warnings: string[];
}

function normalizeTransactions(transactions: readonly Transaction[]): Transaction[] {
  return transactions
    .filter((transaction) => {
      const time = new Date(transaction.date).getTime();
      if (Number.isNaN(time)) return false;
      if (transaction.type === "buy" || transaction.type === "sell") {
        return (
          typeof transaction.symbol === "string" &&
          isNum(transaction.shares) &&
          transaction.shares > 0 &&
          isNum(transaction.price) &&
          transaction.price >= 0
        );
      }
      return isNum(transaction.amount) && transaction.amount >= 0;
    })
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

interface ReplayState {
  lots: Map<string, Lot[]>;
  realized: Map<string, number>;
  cash: number;
  netContributions: number;
}

function emptyState(): ReplayState {
  return { lots: new Map(), realized: new Map(), cash: 0, netContributions: 0 };
}

/**
 * Applies one transaction to the running state.
 *
 * A sale of more shares than are held consumes everything available and the
 * excess is ignored rather than creating a negative lot. A short position is
 * not representable in this model, so silently going negative would produce a
 * cost basis with no meaning.
 */
function applyTransaction(state: ReplayState, transaction: Transaction): void {
  const fees = isNum(transaction.fees) ? transaction.fees : 0;

  if (transaction.type === "deposit") {
    state.cash += transaction.amount ?? 0;
    state.netContributions += transaction.amount ?? 0;
    return;
  }
  if (transaction.type === "withdraw") {
    state.cash -= transaction.amount ?? 0;
    state.netContributions -= transaction.amount ?? 0;
    return;
  }
  if (transaction.type === "dividend") {
    state.cash += transaction.amount ?? 0;
    const symbol = transaction.symbol ?? "";
    state.realized.set(symbol, (state.realized.get(symbol) ?? 0) + (transaction.amount ?? 0));
    return;
  }

  const symbol = transaction.symbol!;
  const shares = transaction.shares!;
  const price = transaction.price!;
  const lots = state.lots.get(symbol) ?? [];

  if (transaction.type === "buy") {
    // Fees are capitalized into the lot price so cost basis reflects cash out.
    const perShareFee = shares > 0 ? fees / shares : 0;
    lots.push({ shares, price: price + perShareFee, date: transaction.date });
    state.lots.set(symbol, lots);
    state.cash -= shares * price + fees;
    return;
  }

  let remaining = shares;
  let costRemoved = 0;
  while (remaining > 0 && lots.length > 0) {
    const lot = lots[0];
    const taken = Math.min(lot.shares, remaining);
    costRemoved += taken * lot.price;
    lot.shares -= taken;
    remaining -= taken;
    if (lot.shares <= 1e-9) lots.shift();
  }
  const sold = shares - remaining;
  state.lots.set(symbol, lots);
  state.cash += sold * price - fees;
  state.realized.set(symbol, (state.realized.get(symbol) ?? 0) + (sold * price - fees - costRemoved));
}

/** Shares held per symbol in a replay state. */
function sharesOf(state: ReplayState): Map<string, number> {
  const out = new Map<string, number>();
  for (const [symbol, lots] of state.lots) {
    const total = lots.reduce((accumulator, lot) => accumulator + lot.shares, 0);
    if (total > 1e-9) out.set(symbol, total);
  }
  return out;
}

/** Cost basis of the open lots per symbol. */
function costBasisOf(state: ReplayState): Map<string, number> {
  const out = new Map<string, number>();
  for (const [symbol, lots] of state.lots) {
    const total = lots.reduce((accumulator, lot) => accumulator + lot.shares * lot.price, 0);
    if (total !== 0) out.set(symbol, total);
  }
  return out;
}

/**
 * Computes every position and portfolio statistic from a transaction log and a
 * price book.
 *
 * `prices` maps each symbol to its bar history. Symbols absent from the book,
 * or whose history ends before the position was opened, are reported in
 * `unpricedSymbols` and excluded from totals rather than valued at zero.
 * Valuing an unpriced holding at zero would understate the portfolio and show
 * a loss that did not happen.
 *
 * `windowStart` bounds the period used for contribution, volatility, drawdown
 * and correlation. It defaults to the first transaction date.
 */
export function analyzePortfolio(
  transactions: readonly Transaction[],
  prices: Readonly<Record<string, readonly Bar[]>>,
  options: { windowStart?: string; riskFreeRate?: number } = {},
): PortfolioAnalytics {
  const warnings: string[] = [];
  const log = normalizeTransactions(transactions);
  if (log.length !== transactions.length) {
    const dropped = transactions.length - log.length;
    warnings.push(`${dropped} malformed ${dropped === 1 ? "transaction" : "transactions"} ignored.`);
  }

  const priceLookup = new Map<string, Map<string, Bar>>();
  const priceDays = new Set<string>();
  for (const [symbol, bars] of Object.entries(prices)) {
    const lookup = new Map<string, Bar>();
    for (const bar of bars) {
      const key = dayKey(bar.timestamp);
      lookup.set(key, bar);
      priceDays.add(key);
    }
    priceLookup.set(symbol, lookup);
  }

  const empty: PortfolioAnalytics = {
    positions: [],
    unpricedSymbols: [],
    unpricedCostBasis: null,
    cash: 0,
    cashWeight: null,
    investedValue: null,
    holdingsValue: null,
    totalValue: null,
    unrealizedPl: null,
    realizedPl: null,
    totalPl: null,
    totalReturn: null,
    netContributions: 0,
    series: [],
    timeWeightedReturn: null,
    simpleReturnOnContributions: null,
    volatility: null,
    maxDrawdown: null,
    averageCorrelation: null,
    correlation: { symbols: [], matrix: [] },
    effectiveHoldings: null,
    largestWeight: null,
    warnings,
  };

  if (log.length === 0) {
    warnings.push("No transactions recorded.");
    return empty;
  }

  const firstDay = dayKey(log[0].date);
  const days = Array.from(priceDays).filter((day) => day >= firstDay).sort();
  if (days.length === 0) {
    warnings.push("No price history covers the transaction history; the portfolio cannot be valued.");
  }

  // Replay day by day, marking to market at each session close.
  const state = emptyState();
  let cursor = 0;
  const series: PortfolioValuePoint[] = [];
  const unpricedEver = new Set<string>();

  for (const day of days) {
    let externalFlow = 0;
    while (cursor < log.length && dayKey(log[cursor].date) <= day) {
      const transaction = log[cursor];
      if (transaction.type === "deposit") externalFlow += transaction.amount ?? 0;
      if (transaction.type === "withdraw") externalFlow -= transaction.amount ?? 0;
      applyTransaction(state, transaction);
      cursor += 1;
    }

    const holdings = sharesOf(state);
    let holdingsValue = 0;
    const unpricedToday: string[] = [];
    for (const [symbol, shares] of holdings) {
      const bar = priceLookup.get(symbol)?.get(day);
      if (!bar) {
        unpricedToday.push(symbol);
        unpricedEver.add(symbol);
        continue;
      }
      holdingsValue += shares * bar.close;
    }

    series.push({
      timestamp: `${day}T00:00:00.000Z`,
      value: holdingsValue + state.cash,
      holdingsValue,
      cash: state.cash,
      externalFlow,
      unpricedSymbols: unpricedToday,
    });
  }

  // Any transactions dated after the last price bar still affect the final state.
  while (cursor < log.length) {
    applyTransaction(state, log[cursor]);
    cursor += 1;
  }

  const holdings = sharesOf(state);
  const basis = costBasisOf(state);

  const windowStartDay = options.windowStart ? dayKey(options.windowStart) : days[0];
  const windowSeries = series.filter((point) => dayKey(point.timestamp) >= windowStartDay);

  // Value of each symbol at the window's first and last session, for contribution.
  const startDay = windowSeries[0] ? dayKey(windowSeries[0].timestamp) : null;
  const endDay = windowSeries.length > 0 ? dayKey(windowSeries[windowSeries.length - 1].timestamp) : null;
  const startState = emptyState();
  if (startDay) {
    for (const transaction of log) {
      if (dayKey(transaction.date) <= startDay) applyTransaction(startState, transaction);
    }
  }
  const startShares = sharesOf(startState);
  const startTotalValue = windowSeries[0]?.value ?? null;

  // Net cash moved into each symbol inside the window, which must be removed
  // from its value change before that change can be called a contribution.
  const netPurchases = new Map<string, number>();
  if (startDay && endDay) {
    for (const transaction of log) {
      const day = dayKey(transaction.date);
      if (day <= startDay || day > endDay) continue;
      if (transaction.type !== "buy" && transaction.type !== "sell") continue;
      const symbol = transaction.symbol!;
      const gross = transaction.shares! * transaction.price! + (transaction.fees ?? 0) * (transaction.type === "buy" ? 1 : -1);
      netPurchases.set(symbol, (netPurchases.get(symbol) ?? 0) + (transaction.type === "buy" ? gross : -gross));
    }
  }

  const positions: PositionMetrics[] = [];
  let holdingsValue = 0;
  for (const [symbol, shares] of holdings) {
    const bars = prices[symbol] ?? [];
    const lastBar = bars.length > 0 ? bars[bars.length - 1] : null;
    const previousBar = bars.length > 1 ? bars[bars.length - 2] : null;
    const priced = lastBar !== null;
    if (!priced) unpricedEver.add(symbol);
    const lastPrice = lastBar ? lastBar.close : null;
    const marketValue = lastPrice === null ? null : finite(shares * lastPrice);
    if (marketValue !== null) holdingsValue += marketValue;
    const costBasis = basis.get(symbol) ?? 0;
    const dayChangePercent =
      lastBar && previousBar && previousBar.close > 0
        ? finite(lastBar.close / previousBar.close - 1)
        : null;

    const startBar = startDay ? priceLookup.get(symbol)?.get(startDay) ?? null : null;
    const endBar = endDay ? priceLookup.get(symbol)?.get(endDay) ?? null : null;
    const startValue = startBar ? (startShares.get(symbol) ?? 0) * startBar.close : 0;
    const endValue = endBar ? shares * endBar.close : marketValue ?? 0;
    const contribution =
      startTotalValue !== null && startTotalValue > 0
        ? finite((endValue - startValue - (netPurchases.get(symbol) ?? 0)) / startTotalValue)
        : null;

    positions.push({
      symbol,
      shares,
      costBasis: finite(costBasis),
      averageCost: safeDiv(costBasis, shares),
      lastPrice,
      priceAsOf: lastBar ? lastBar.timestamp : null,
      marketValue,
      unrealizedPl: marketValue === null ? null : finite(marketValue - costBasis),
      unrealizedPlPercent: marketValue === null ? null : safeDiv(marketValue - costBasis, costBasis),
      realizedPl: finite(state.realized.get(symbol) ?? 0),
      weight: null,
      dayChangeValue:
        dayChangePercent === null || lastPrice === null
          ? null
          : finite(shares * lastPrice * (dayChangePercent / (1 + dayChangePercent))),
      dayChangePercent,
      contribution,
      priced,
    });
  }

  const totalValue = finite(holdingsValue + state.cash);
  for (const position of positions) {
    position.weight = totalValue !== null && totalValue > 0 ? safeDiv(position.marketValue, totalValue) : null;
  }
  positions.sort((a, b) => (b.marketValue ?? -Infinity) - (a.marketValue ?? -Infinity));

  if (unpricedEver.size > 0) {
    warnings.push(
      `No price data for ${Array.from(unpricedEver).sort().join(", ")}; ${unpricedEver.size === 1 ? "that holding is" : "those holdings are"} excluded from totals.`,
    );
  }

  // Time-weighted return: chain the daily returns, removing external flows so
  // a deposit never registers as a gain.
  const dailyReturns: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const previousValue = series[i - 1].value;
    if (previousValue <= 0) continue;
    const value = (series[i].value - series[i].externalFlow) / previousValue - 1;
    if (isNum(value)) dailyReturns.push(value);
  }
  const timeWeightedReturn =
    dailyReturns.length === 0
      ? null
      : finite(dailyReturns.reduce((growth, value) => growth * (1 + value), 1) - 1);

  const periodicDeviation = stdDev(dailyReturns);
  const portfolioVolatility =
    periodicDeviation === null ? null : finite(periodicDeviation * Math.sqrt(PERIODS_PER_YEAR["1d"]));

  let peak = -Infinity;
  let maxDrawdown: Maybe = series.length > 0 ? 0 : null;
  for (const point of series) {
    if (point.value > peak) peak = point.value;
    if (peak > 0) {
      const value = point.value / peak - 1;
      if (maxDrawdown === null || value < maxDrawdown) maxDrawdown = value;
    }
  }

  const heldSymbols = positions.filter((position) => position.priced).map((position) => position.symbol);
  const matrix = correlationMatrix(
    heldSymbols.map((symbol) => ({ symbol, bars: (prices[symbol] ?? []).filter((bar) => dayKey(bar.timestamp) >= windowStartDay) })),
  );

  const weights = positions.map((position) => position.weight).filter((weight): weight is number => weight !== null);
  /**
   * Effective holdings is the inverse Herfindahl index of the **invested**
   * weights, renormalized to sum to 1.
   *
   * Using weights that are shares of the whole book, cash included, inflates
   * the figure above the number of positions actually held: nine roughly equal
   * holdings beside 9% cash would score above ten, which is nonsense. Cash is
   * reported separately as `cashWeight`.
   */
  const investedWeight = sum(weights);
  const effectiveHoldings =
    weights.length === 0 || investedWeight <= 0
      ? null
      : safeDiv(1, sum(weights.map((weight) => (weight / investedWeight) ** 2)));

  const unrealizedPl = sum(positions.map((position) => position.unrealizedPl ?? 0));
  const realizedPl = sum(Array.from(state.realized.values()));
  const investedValue = sum(Array.from(basis.values()));

  const averageCapital = mean(series.map((point) => point.value));
  const totalPl = finite(unrealizedPl + realizedPl);

  return {
    positions,
    unpricedSymbols: Array.from(unpricedEver).sort(),
    unpricedCostBasis: finite(
      sum(positions.filter((position) => !position.priced).map((position) => position.costBasis ?? 0)),
    ),
    cash: state.cash,
    cashWeight: totalValue !== null && totalValue > 0 ? safeDiv(state.cash, totalValue) : null,
    investedValue: finite(investedValue),
    holdingsValue: finite(holdingsValue),
    totalValue,
    unrealizedPl: finite(unrealizedPl),
    realizedPl: finite(realizedPl),
    totalPl,
    totalReturn:
      state.netContributions > 0 && totalValue !== null
        ? finite((totalValue - state.netContributions) / state.netContributions)
        : null,
    netContributions: state.netContributions,
    series,
    timeWeightedReturn,
    simpleReturnOnContributions: safeDiv(totalPl, averageCapital),
    volatility: portfolioVolatility,
    maxDrawdown,
    averageCorrelation: averagePairwiseCorrelation(matrix.matrix),
    correlation: matrix,
    effectiveHoldings,
    largestWeight: weights.length === 0 ? null : Math.max(...weights),
    warnings,
  };
}

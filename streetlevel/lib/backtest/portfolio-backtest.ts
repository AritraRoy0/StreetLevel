/**
 * Running one strategy across several symbols against a shared cash account.
 *
 * The single-symbol simulator cannot be run once per name and the results
 * added up: each run would spend the same starting cash, so the total would
 * assume capital the portfolio never had. This engine keeps one cash balance
 * and one calendar, and lets positions compete for it.
 *
 * The calendar is the intersection of the constituents' trading days. A
 * positional walk across separate arrays would eventually pair one symbol's
 * Monday with another's Tuesday, which quietly corrupts every portfolio
 * statistic that follows.
 */

import { finite, isNum, mean, safeDiv, stdDev } from "../analytics/math.ts";
import { analyzePortfolio } from "../analytics/portfolio.ts";
import type { PortfolioAnalytics, Transaction } from "../analytics/portfolio.ts";
import { dayKey, isoWeekKey, monthKey } from "../analytics/series.ts";
import { averagePairwiseCorrelation, correlationMatrix } from "../analytics/compare.ts";
import { PERIODS_PER_YEAR } from "../analytics/types.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { buildSignals } from "./signals.ts";
import { curveStatistics } from "./statistics.ts";
import type { EquityPoint, Position, StrategySpec, Trade } from "./types.ts";

export type AllocationPolicy = "equal_weight" | "volatility_target";

export interface PortfolioBacktestSpec extends StrategySpec {
  allocation: AllocationPolicy;
  /** Maximum positions held at once. */
  maxPositions: number;
  /** Annualized volatility target per position, used by `volatility_target`. */
  volatilityTarget: number;
}

export interface SymbolContribution {
  symbol: string;
  /** Fraction of the portfolio's return attributable to this symbol. */
  contribution: Maybe;
  realizedProfit: Maybe;
  unrealizedProfit: Maybe;
  closedTrades: number;
  /** Fraction of bars this symbol was held. */
  exposure: Maybe;
}

export interface PortfolioBacktestResult {
  symbols: string[];
  spec: PortfolioBacktestSpec;
  /** The shared trading calendar, the intersection of every constituent. */
  timestamps: string[];
  equity: EquityPoint[];
  trades: Trade[];
  contributions: SymbolContribution[];
  portfolio: PortfolioAnalytics;

  totalReturn: Maybe;
  cagr: Maybe;
  volatility: Maybe;
  sharpe: Maybe;
  sortino: Maybe;
  maxDrawdown: Maybe;
  calmar: Maybe;
  drawdownSeries: Maybe[];

  /** Average pairwise correlation of the traded legs' daily returns. */
  averageCorrelation: Maybe;
  /** Bars on which a wanted entry was refused for lack of cash or a position slot. */
  rejectedEntries: number;
  warnings: string[];
}

interface Holding {
  symbol: string;
  shares: number;
  entryIndex: number;
  entryTimestamp: string;
  /** Price actually paid, friction included. */
  entryPrice: number;
  /** Mid price before friction, used for the gross figure. */
  entryReferencePrice: number;
  entryCommission: number;
  entryFriction: number;
  lowestLow: number;
  highestHigh: number;
}

function frictionFraction(spec: StrategySpec): number {
  return Math.max(0, spec.costs.slippageBps) / 10_000 + Math.max(0, spec.costs.spreadBps) / 2 / 10_000;
}

function commissionFor(spec: StrategySpec, shares: number, notional: number): number {
  const amount = Math.max(0, spec.costs.commission);
  if (spec.costs.commissionKind === "per_share") return amount * shares;
  if (spec.costs.commissionKind === "bps") return (amount / 10_000) * notional;
  return shares > 0 ? amount : 0;
}

/** Annualized deviation of the trailing 20 returns for a symbol at a bar. */
function trailingVolatility(bars: readonly Bar[], index: number): Maybe {
  const start = Math.max(1, index - 19);
  if (index - start < 2) return null;
  const returns: number[] = [];
  for (let i = start; i <= index; i += 1) {
    const previous = bars[i - 1].adjClose;
    if (previous > 0) returns.push(bars[i].adjClose / previous - 1);
  }
  const deviation = stdDev(returns);
  return deviation === null ? null : finite(deviation * Math.sqrt(PERIODS_PER_YEAR["1d"]));
}

/**
 * Runs the strategy across every supplied symbol with one cash account.
 *
 * Entries are ranked when more of them arrive on one bar than there are free
 * position slots. The ranking is by trailing volatility, lowest first, which is
 * a deterministic tie-break rather than array order; array order would make the
 * result depend on how the caller happened to list the symbols.
 */
export function runPortfolioBacktest(
  priceBook: Readonly<Record<string, readonly Bar[]>>,
  symbols: readonly string[],
  spec: PortfolioBacktestSpec,
): PortfolioBacktestResult {
  const warnings: string[] = [];
  const usable = symbols.filter((symbol) => (priceBook[symbol]?.length ?? 0) > 0);
  const missing = symbols.filter((symbol) => !usable.includes(symbol));
  if (missing.length > 0) {
    warnings.push(`No price history for ${missing.join(", ")}; ${missing.length === 1 ? "it was" : "they were"} excluded.`);
  }

  const empty: PortfolioBacktestResult = {
    symbols: usable,
    spec,
    timestamps: [],
    equity: [],
    trades: [],
    contributions: [],
    portfolio: analyzePortfolio([], {}),
    totalReturn: null,
    cagr: null,
    volatility: null,
    sharpe: null,
    sortino: null,
    maxDrawdown: null,
    calmar: null,
    drawdownSeries: [],
    averageCorrelation: null,
    rejectedEntries: 0,
    warnings,
  };

  if (usable.length === 0) {
    return { ...empty, warnings: [...warnings, "No symbols with price history were supplied."] };
  }

  // Shared calendar: days on which every constituent traded.
  let common = new Set(priceBook[usable[0]].map((bar) => dayKey(bar.timestamp)));
  for (let i = 1; i < usable.length; i += 1) {
    const present = new Set(priceBook[usable[i]].map((bar) => dayKey(bar.timestamp)));
    common = new Set(Array.from(common).filter((day) => present.has(day)));
  }
  const days = Array.from(common).sort();
  if (days.length < 3) {
    return { ...empty, warnings: [...warnings, "The symbols share too few trading days to backtest together."] };
  }
  const dropped = usable.reduce((total, symbol) => total + priceBook[symbol].length, 0) - days.length * usable.length;
  if (dropped > 0) {
    warnings.push(`${dropped} bars fell outside the shared calendar and were excluded.`);
  }

  // Per-symbol bars restricted to the shared calendar, plus their signals.
  const aligned: Record<string, Bar[]> = {};
  const signals: Record<string, Array<Position | null>> = {};
  for (const symbol of usable) {
    const byDay = new Map(priceBook[symbol].map((bar) => [dayKey(bar.timestamp), bar]));
    const bars = days.map((day) => byDay.get(day)!);
    aligned[symbol] = bars;
    const built = buildSignals(bars, spec);
    signals[symbol] = built.desired;
    warnings.push(...built.warnings.map((warning) => `${symbol}: ${warning}`));
  }

  const friction = frictionFraction(spec);
  const maxPositions = Math.max(1, Math.min(spec.maxPositions || usable.length, usable.length));

  let cash = Math.max(0, spec.initialCapital);
  const holdings = new Map<string, Holding>();
  const pending = new Map<string, "buy" | "sell">();
  const transactions: Transaction[] = [
    { id: "seed", date: aligned[usable[0]][0].timestamp, type: "deposit", amount: Math.max(0, spec.initialCapital) },
  ];
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const exposureBars = new Map<string, number>();
  let rejectedEntries = 0;
  let tradeCounter = 0;

  const valueOf = (index: number): number => {
    let total = 0;
    for (const holding of holdings.values()) total += holding.shares * aligned[holding.symbol][index].close;
    return total;
  };

  const closePosition = (symbol: string, index: number, referencePrice: number, reason: Trade["exitReason"]): void => {
    const holding = holdings.get(symbol);
    if (!holding) return;
    const effectivePrice = referencePrice * (1 - friction);
    const notional = holding.shares * effectivePrice;
    const commission = commissionFor(spec, holding.shares, notional);
    const frictionCost = holding.shares * (referencePrice - effectivePrice);
    cash += notional - commission;

    transactions.push({
      id: `s-${symbol}-${index}`,
      date: aligned[symbol][index].timestamp,
      type: "sell",
      symbol,
      shares: holding.shares,
      price: effectivePrice,
      fees: commission,
    });

    // Gross on mid prices, fees on both legs, net as gross less fees. Friction
    // is already inside the effective prices, so it is counted exactly once.
    const gross = holding.shares * (referencePrice - holding.entryReferencePrice);
    const fees = holding.entryCommission + holding.entryFriction + commission + frictionCost;
    tradeCounter += 1;
    trades.push({
      id: `pt-${tradeCounter}`,
      symbol,
      entryIndex: holding.entryIndex,
      entryTimestamp: holding.entryTimestamp,
      entryPrice: holding.entryPrice,
      exitIndex: index,
      exitTimestamp: aligned[symbol][index].timestamp,
      exitPrice: effectivePrice,
      shares: holding.shares,
      fees,
      grossProfit: finite(gross),
      netProfit: finite(gross - fees),
      returnPct: safeDiv(gross - fees, holding.shares * holding.entryPrice),
      holdingBars: index - holding.entryIndex,
      holdingDays: null,
      mae: safeDiv(holding.lowestLow - holding.entryPrice, holding.entryPrice),
      mfe: safeDiv(holding.highestHigh - holding.entryPrice, holding.entryPrice),
      exitReason: reason,
      open: false,
    });
    holdings.delete(symbol);
  };

  const openPosition = (symbol: string, index: number, referencePrice: number, budget: number): boolean => {
    const effectivePrice = referencePrice * (1 + friction);
    if (!isNum(effectivePrice) || effectivePrice <= 0 || budget <= 0) return false;
    const raw = budget / effectivePrice;
    const shares = spec.sizing.wholeShares ? Math.floor(raw) : raw;
    if (shares <= 0) return false;

    const notional = shares * effectivePrice;
    const commission = commissionFor(spec, shares, notional);
    if (notional + commission > cash + 1e-9) return false;

    cash -= notional + commission;
    const frictionCost = shares * (effectivePrice - referencePrice);
    transactions.push({
      id: `b-${symbol}-${index}`,
      date: aligned[symbol][index].timestamp,
      type: "buy",
      symbol,
      shares,
      price: effectivePrice,
      fees: commission,
    });
    holdings.set(symbol, {
      symbol,
      shares,
      entryIndex: index,
      entryTimestamp: aligned[symbol][index].timestamp,
      entryPrice: effectivePrice,
      entryReferencePrice: referencePrice,
      entryCommission: commission,
      entryFriction: frictionCost,
      lowestLow: aligned[symbol][index].low,
      highestHigh: aligned[symbol][index].high,
    });
    return true;
  };

  for (let i = 0; i < days.length; i += 1) {
    const priceAt = (symbol: string) =>
      spec.timing === "next_open" ? aligned[symbol][i].open : aligned[symbol][i].close;

    // 1. Exits queued on the previous bar, before entries, so capital freed by
    //    a sale is available to the same bar's buys.
    for (const [symbol, side] of Array.from(pending.entries())) {
      if (side === "sell" && holdings.has(symbol)) closePosition(symbol, i, priceAt(symbol), "signal");
    }

    // 2. Entries queued on the previous bar, ranked and capped.
    const wantedEntries = Array.from(pending.entries())
      .filter(([symbol, side]) => side === "buy" && !holdings.has(symbol))
      .map(([symbol]) => symbol);
    pending.clear();

    if (wantedEntries.length > 0) {
      const slots = maxPositions - holdings.size;
      if (slots <= 0) {
        rejectedEntries += wantedEntries.length;
      } else {
        // Lowest trailing volatility first: a deterministic ranking that does
        // not depend on the order the caller listed the symbols in.
        const ranked = wantedEntries
          .map((symbol) => ({ symbol, volatility: trailingVolatility(aligned[symbol], i) ?? Number.POSITIVE_INFINITY }))
          .sort((a, b) => a.volatility - b.volatility || a.symbol.localeCompare(b.symbol));

        const taking = ranked.slice(0, slots);
        rejectedEntries += ranked.length - taking.length;

        const markEquity = cash + valueOf(i);
        for (const candidate of taking) {
          let budget: number;
          if (spec.allocation === "volatility_target") {
            const symbolVolatility = trailingVolatility(aligned[candidate.symbol], i);
            const scale =
              symbolVolatility === null || symbolVolatility <= 0
                ? 1
                : Math.min(1, Math.max(0, spec.volatilityTarget) / symbolVolatility);
            budget = Math.min(cash, (markEquity / maxPositions) * scale);
          } else {
            budget = Math.min(cash, markEquity / maxPositions);
          }
          if (!openPosition(candidate.symbol, i, priceAt(candidate.symbol), budget)) rejectedEntries += 1;
        }
      }
    }

    // 3. Track excursions and decide what to queue for the next bar.
    const isRebalanceBar =
      spec.rebalance === "signal" ||
      i === days.length - 1 ||
      (spec.rebalance === "weekly"
        ? isoWeekKey(aligned[usable[0]][i + 1]?.timestamp ?? "") !== isoWeekKey(aligned[usable[0]][i].timestamp)
        : monthKey(aligned[usable[0]][i + 1]?.timestamp ?? "") !== monthKey(aligned[usable[0]][i].timestamp));

    for (const symbol of usable) {
      const holding = holdings.get(symbol);
      if (holding) {
        holding.lowestLow = Math.min(holding.lowestLow, aligned[symbol][i].low);
        holding.highestHigh = Math.max(holding.highestHigh, aligned[symbol][i].high);
        exposureBars.set(symbol, (exposureBars.get(symbol) ?? 0) + 1);
      }

      const desired = signals[symbol][i];
      if (desired === null || i === days.length - 1 || !isRebalanceBar) continue;
      const held: Position = holding ? 1 : 0;
      if (desired !== held) pending.set(symbol, desired === 1 ? "buy" : "sell");
    }

    const holdingsValue = valueOf(i);
    equity.push({
      timestamp: aligned[usable[0]][i].timestamp,
      equity: finite(cash + holdingsValue) ?? 0,
      cash,
      shares: Array.from(holdings.values()).reduce((total, holding) => total + holding.shares, 0),
      exposure: holdingsValue,
      position: holdings.size > 0 ? 1 : 0,
    });
  }

  // Positions still open at the end are reported as open trades.
  const lastIndex = days.length - 1;
  for (const holding of holdings.values()) {
    const lastBar = aligned[holding.symbol][lastIndex];
    const gross = holding.shares * (lastBar.close - holding.entryReferencePrice);
    const fees = holding.entryCommission + holding.entryFriction;
    tradeCounter += 1;
    trades.push({
      id: `pt-${tradeCounter}`,
      symbol: holding.symbol,
      entryIndex: holding.entryIndex,
      entryTimestamp: holding.entryTimestamp,
      entryPrice: holding.entryPrice,
      exitIndex: null,
      exitTimestamp: null,
      exitPrice: null,
      shares: holding.shares,
      fees,
      grossProfit: finite(gross),
      netProfit: finite(gross - fees),
      returnPct: safeDiv(gross - fees, holding.shares * holding.entryPrice),
      holdingBars: lastIndex - holding.entryIndex,
      holdingDays: null,
      mae: safeDiv(holding.lowestLow - holding.entryPrice, holding.entryPrice),
      mfe: safeDiv(holding.highestHigh - holding.entryPrice, holding.entryPrice),
      exitReason: null,
      open: true,
    });
  }

  const portfolio = analyzePortfolio(transactions, aligned);
  const curve = curveStatistics(equity);

  const tradedSymbols = Array.from(new Set(trades.map((trade) => trade.symbol)));
  const matrix = correlationMatrix(tradedSymbols.map((symbol) => ({ symbol, bars: aligned[symbol] })));

  const contributions: SymbolContribution[] = usable.map((symbol) => {
    const symbolTrades = trades.filter((trade) => trade.symbol === symbol);
    const position = portfolio.positions.find((item) => item.symbol === symbol);
    return {
      symbol,
      contribution: position?.contribution ?? null,
      realizedProfit: finite(
        symbolTrades.filter((trade) => !trade.open).reduce((total, trade) => total + (trade.netProfit ?? 0), 0),
      ),
      unrealizedProfit: position?.unrealizedPl ?? null,
      closedTrades: symbolTrades.filter((trade) => !trade.open).length,
      exposure: safeDiv(exposureBars.get(symbol) ?? 0, days.length),
    };
  });

  if (rejectedEntries > 0) {
    warnings.push(
      `${rejectedEntries} wanted ${rejectedEntries === 1 ? "entry was" : "entries were"} refused for lack of cash or a free position slot.`,
    );
  }

  return {
    symbols: usable,
    spec,
    timestamps: equity.map((point) => point.timestamp),
    equity,
    trades,
    contributions,
    portfolio,
    ...curve,
    averageCorrelation: averagePairwiseCorrelation(matrix.matrix),
    rejectedEntries,
    warnings,
  };
}

/** Mean of the defined contributions, used as a sanity read on attribution. */
export function totalContribution(contributions: readonly SymbolContribution[]): Maybe {
  const values = contributions.map((entry) => entry.contribution).filter((value): value is number => value !== null);
  return values.length === 0 ? null : finite(values.reduce((total, value) => total + value, 0));
}

/** Mean exposure across the constituents. */
export function averageExposure(contributions: readonly SymbolContribution[]): Maybe {
  return mean(contributions.map((entry) => entry.exposure).filter((value): value is number => value !== null));
}

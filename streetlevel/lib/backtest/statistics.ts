/**
 * Trade-ledger statistics and the assembled backtest result.
 *
 * The accounting reuses `analyzePortfolio` from the analytics engine: the
 * simulator emits a transaction log, and the portfolio replay already provides
 * FIFO lots, cash, the daily value series, time-weighted return and drawdown,
 * all of it tested. What is added here is what a portfolio view has no reason
 * to know about, which is everything defined per *round trip* rather than per
 * position: win rate, profit factor, expectancy, excursions and exposure.
 */

import { finite, isNum, mean, safeDiv, stdDev, sum } from "../analytics/math.ts";
import { drawdown as drawdownOf, periodicReturns } from "../analytics/returns.ts";
import { daysBetween } from "../analytics/series.ts";
import { DAYS_PER_YEAR, PERIODS_PER_YEAR } from "../analytics/types.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { analyzePortfolio } from "../analytics/portfolio.ts";
import type { PortfolioAnalytics, Transaction } from "../analytics/portfolio.ts";
import { buildSignals } from "./signals.ts";
import { simulate } from "./simulator.ts";
import type {
  BacktestResult,
  EquityPoint,
  Fill,
  StrategySpec,
  Trade,
  TradeStatistics,
} from "./types.ts";

/** Turns the equity curve into a bar series so the analytics engine can read it. */
export function equityToBars(equity: readonly EquityPoint[]): Bar[] {
  return equity.map((point) => ({
    timestamp: point.timestamp,
    open: point.equity,
    high: point.equity,
    low: point.equity,
    close: point.equity,
    adjClose: point.equity,
    volume: 0,
  }));
}

/**
 * Converts fills into the transaction log `analyzePortfolio` consumes.
 *
 * The effective fill price is passed as the transaction price and the
 * commission as its fee, so the cash the portfolio replay derives is identical
 * to the cash the simulator tracked. The opening deposit is dated to the first
 * bar of the window so the equity curve starts there with full cash rather than
 * at the first trade.
 */
export function fillsToTransactions(
  fills: readonly Fill[],
  symbol: string,
  spec: StrategySpec,
  firstTimestamp: string,
): Transaction[] {
  const log: Transaction[] = [
    { id: "seed", date: firstTimestamp, type: "deposit", amount: Math.max(0, spec.initialCapital) },
  ];
  fills.forEach((fill, index) => {
    log.push({
      id: `f-${index}`,
      date: fill.timestamp,
      type: fill.side === "buy" ? "buy" : "sell",
      symbol,
      shares: fill.shares,
      price: fill.effectivePrice,
      fees: fill.commission,
    });
  });
  return log;
}

/** Longest run of consecutive bars with no position. */
function longestFlatRun(equity: readonly EquityPoint[]): number {
  let longest = 0;
  let current = 0;
  for (const point of equity) {
    if (point.position === 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function consecutive(values: readonly number[], predicate: (value: number) => boolean): number {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    if (predicate(value)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Statistics over the trade ledger.
 *
 * Open positions are excluded from every closed-trade figure. A position still
 * running has not yet been right or wrong, and counting its paper profit as a
 * win is how a losing strategy is made to look like a winning one.
 *
 * A trade whose net profit is exactly zero is a scratch and is counted in
 * neither the wins nor the losses, so the win rate is over decided trades.
 */
export function computeStatistics(
  trades: readonly Trade[],
  fills: readonly Fill[],
  equity: readonly EquityPoint[],
): TradeStatistics {
  const closed = trades.filter((trade) => !trade.open);
  const open = trades.filter((trade) => trade.open);
  const profits = closed.map((trade) => trade.netProfit).filter(isNum);

  const wins = profits.filter((value) => value > 0);
  const losses = profits.filter((value) => value < 0);
  const scratches = profits.filter((value) => value === 0);

  const grossWins = sum(wins);
  const grossLosses = Math.abs(sum(losses));

  const barsWithPosition = equity.filter((point) => point.position === 1).length;
  const totalCommission = sum(fills.map((fill) => fill.commission));
  const totalFriction = sum(fills.map((fill) => fill.frictionCost));

  const tradedNotional = sum(fills.map((fill) => fill.shares * fill.effectivePrice));
  const averageEquity = mean(equity.map((point) => point.equity));
  const years =
    equity.length > 1
      ? (daysBetween(equity[0].timestamp, equity[equity.length - 1].timestamp) ?? 0) / DAYS_PER_YEAR
      : 0;

  return {
    closedTrades: closed.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    scratches: scratches.length,
    // Over decided trades: a scratch is neither a win nor a loss.
    winRate: wins.length + losses.length > 0 ? safeDiv(wins.length, wins.length + losses.length) : null,
    // Undefined rather than infinite when a strategy has never lost.
    profitFactor: grossLosses > 0 ? safeDiv(grossWins, grossLosses) : null,
    expectancy: profits.length > 0 ? mean(profits) : null,
    averageWin: wins.length > 0 ? mean(wins) : null,
    averageLoss: losses.length > 0 ? mean(losses) : null,
    payoffRatio:
      wins.length > 0 && losses.length > 0
        ? safeDiv(mean(wins) ?? 0, Math.abs(mean(losses) ?? 0))
        : null,
    largestWin: wins.length > 0 ? Math.max(...wins) : null,
    largestLoss: losses.length > 0 ? Math.min(...losses) : null,
    maxConsecutiveWins: consecutive(profits, (value) => value > 0),
    maxConsecutiveLosses: consecutive(profits, (value) => value < 0),
    averageHoldingBars: closed.length > 0 ? mean(closed.map((trade) => trade.holdingBars)) : null,
    averageMae: closed.length > 0 ? mean(closed.map((trade) => trade.mae).filter(isNum)) : null,
    averageMfe: closed.length > 0 ? mean(closed.map((trade) => trade.mfe).filter(isNum)) : null,
    exposure: equity.length > 0 ? safeDiv(barsWithPosition, equity.length) : null,
    longestFlatBars: longestFlatRun(equity),
    turnover:
      averageEquity !== null && averageEquity > 0 && years > 0
        ? safeDiv(tradedNotional / averageEquity, years)
        : null,
    totalCommission,
    totalFriction,
  };
}

/** Risk and return statistics over an equity curve. */
export function curveStatistics(
  equity: readonly EquityPoint[],
  riskFreeRate = 0,
): {
  totalReturn: Maybe;
  cagr: Maybe;
  volatility: Maybe;
  sharpe: Maybe;
  sortino: Maybe;
  maxDrawdown: Maybe;
  calmar: Maybe;
  drawdownSeries: Maybe[];
} {
  const empty = {
    totalReturn: null,
    cagr: null,
    volatility: null,
    sharpe: null,
    sortino: null,
    maxDrawdown: null,
    calmar: null,
    drawdownSeries: [] as Maybe[],
  };
  if (equity.length < 2) return { ...empty, drawdownSeries: equity.map(() => 0) };

  const bars = equityToBars(equity);
  const first = equity[0].equity;
  const last = equity[equity.length - 1].equity;
  const totalReturn = first > 0 ? finite(last / first - 1) : null;

  const returns = periodicReturns(bars);
  const periodicDeviation = stdDev(returns);
  const volatility = periodicDeviation === null ? null : finite(periodicDeviation * Math.sqrt(PERIODS_PER_YEAR["1d"]));

  const days = daysBetween(equity[0].timestamp, equity[equity.length - 1].timestamp);
  /**
   * CAGR is reported for any window here, unlike the analytics page which
   * withholds it below eleven months. A backtest's whole purpose is the
   * annualized figure, and suppressing it would leave the primary column
   * blank. The short-window caveat is carried by the UI instead.
   */
  const cagr =
    days !== null && days > 0 && first > 0 && last > 0
      ? finite((last / first) ** (DAYS_PER_YEAR / days) - 1)
      : null;

  const averageReturn = mean(returns);
  const sharpe =
    averageReturn === null || periodicDeviation === null || periodicDeviation === 0
      ? null
      : safeDiv(
          averageReturn * PERIODS_PER_YEAR["1d"] - riskFreeRate,
          periodicDeviation * Math.sqrt(PERIODS_PER_YEAR["1d"]),
        );

  const downside = Math.sqrt(mean(returns.map((value) => Math.min(value, 0) ** 2)) ?? 0);
  const sortino =
    averageReturn === null || !isNum(downside) || downside === 0
      ? null
      : safeDiv(averageReturn * PERIODS_PER_YEAR["1d"] - riskFreeRate, downside * Math.sqrt(PERIODS_PER_YEAR["1d"]));

  const risk = drawdownOf(bars);
  const calmar =
    cagr === null || risk.maxDrawdown === null || risk.maxDrawdown === 0
      ? null
      : safeDiv(cagr, Math.abs(risk.maxDrawdown));

  return {
    totalReturn,
    cagr,
    volatility,
    sharpe,
    sortino,
    maxDrawdown: risk.maxDrawdown,
    calmar,
    drawdownSeries: risk.series.map((point) => point.value),
  };
}

/**
 * Runs a full backtest and assembles the result, including a buy-and-hold
 * benchmark computed under the same cost model.
 *
 * Charging the benchmark the same entry cost matters. Comparing a strategy that
 * pays commission and slippage against a frictionless benchmark understates the
 * strategy by exactly the amount the comparison is supposed to measure.
 */
export function runBacktest(
  bars: readonly Bar[],
  spec: StrategySpec,
  options: { symbol?: string; riskFreeRate?: number } = {},
): BacktestResult {
  const symbol = options.symbol ?? "ASSET";
  const riskFreeRate = options.riskFreeRate ?? 0;

  const signals = buildSignals(bars, spec);
  const run = simulate(bars, spec, { symbol, signals });
  const curve = curveStatistics(run.equity, riskFreeRate);

  const benchmarkSpec: StrategySpec = {
    ...spec,
    rule: "buy_and_hold",
    params: {},
    exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
    rebalance: "signal",
  };
  const benchmarkRun = simulate(bars, benchmarkSpec, { symbol });
  const benchmarkCurve = curveStatistics(benchmarkRun.equity, riskFreeRate);

  const warnings = [...run.warnings];
  if (bars.length < 60) {
    warnings.push(`The window holds ${bars.length} bars, which is far too few to infer anything about the rule.`);
  }
  if (run.trades.filter((trade) => !trade.open).length < 10 && run.trades.length > 0) {
    warnings.push(
      "Fewer than ten closed trades. Win rate, profit factor and expectancy are dominated by noise at this sample size.",
    );
  }
  if (run.trades.length === 0) {
    warnings.push("The strategy never opened a position over this window.");
  }

  return {
    symbol,
    spec,
    bars: bars.slice(),
    signals,
    fills: run.fills,
    trades: run.trades,
    equity: run.equity,
    statistics: computeStatistics(run.trades, run.fills, run.equity),
    ...curve,
    benchmarkEquity: benchmarkRun.equity,
    benchmarkTotalReturn: benchmarkCurve.totalReturn,
    unfilledOrders: run.unfilledOrders,
    warnings,
  };
}

/**
 * Replays the run's fills through the portfolio engine.
 *
 * This is the accounting cross-check. The simulator tracks cash and equity in
 * its own loop; `analyzePortfolio` derives them independently from the
 * transaction log using FIFO lots. If the two disagree, one of them is wrong,
 * and the disagreement is measurable rather than a matter of opinion.
 */
export function portfolioViewOf(result: BacktestResult): PortfolioAnalytics {
  const firstTimestamp = result.bars[0]?.timestamp ?? new Date(0).toISOString();
  const log = fillsToTransactions(result.fills, result.symbol, result.spec, firstTimestamp);
  return analyzePortfolio(log, { [result.symbol]: result.bars });
}

/**
 * Largest absolute difference between the simulator's equity curve and the one
 * the portfolio engine derives from the same fills.
 *
 * Should be zero to within floating-point noise. Anything larger means the two
 * accountings have diverged and the result cannot be trusted.
 */
export function reconcileEquity(result: BacktestResult): {
  maxDifference: number;
  atTimestamp: string | null;
  comparedPoints: number;
} {
  const portfolio = portfolioViewOf(result);
  const byDay = new Map(portfolio.series.map((point) => [point.timestamp.slice(0, 10), point.value]));

  let maxDifference = 0;
  let atTimestamp: string | null = null;
  let comparedPoints = 0;

  for (const point of result.equity) {
    const counterpart = byDay.get(point.timestamp.slice(0, 10));
    if (counterpart === undefined) continue;
    comparedPoints += 1;
    const difference = Math.abs(counterpart - point.equity);
    if (difference > maxDifference) {
      maxDifference = difference;
      atTimestamp = point.timestamp;
    }
  }

  return { maxDifference, atTimestamp, comparedPoints };
}

/**
 * The same strategy with every cost switched off, used to report cost drag.
 *
 * Whether a rule survives its own transaction costs is usually the question
 * that decides it, and that answer is only visible by running it twice.
 */
export function costDragOf(
  bars: readonly Bar[],
  spec: StrategySpec,
  options: { symbol?: string } = {},
): { withCosts: Maybe; withoutCosts: Maybe; drag: Maybe; commission: number; friction: number } {
  const withCosts = runBacktest(bars, spec, options);
  const frictionless = runBacktest(
    bars,
    { ...spec, costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 } },
    options,
  );
  return {
    withCosts: withCosts.totalReturn,
    withoutCosts: frictionless.totalReturn,
    drag:
      withCosts.totalReturn === null || frictionless.totalReturn === null
        ? null
        : finite(withCosts.totalReturn - frictionless.totalReturn),
    commission: withCosts.statistics.totalCommission,
    friction: withCosts.statistics.totalFriction,
  };
}

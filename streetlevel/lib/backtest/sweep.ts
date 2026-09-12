/**
 * Parameter sweeps, walk-forward validation, and the correction that stops a
 * sweep from lying about itself.
 *
 * A grid search over a single year of one symbol will always return a winner.
 * That is a property of searching, not of the winner. So every sweep here
 * reports three things together: the best cell, the *distribution* across all
 * cells, and a deflated Sharpe ratio that prices in how many times the coin was
 * flipped. A best cell shown alone is a number with no information in it.
 */

import { finite, mean, median, safeDiv, stdDev } from "../analytics/math.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { runBacktest } from "./statistics.ts";
import type { StrategySpec } from "./types.ts";

/** Upper bound on grid cells, so a sweep cannot lock the page. */
export const MAX_SWEEP_CELLS = 400;

export interface SweepAxis {
  param: string;
  values: number[];
}

export interface SweepCell {
  params: Record<string, number>;
  totalReturn: Maybe;
  cagr: Maybe;
  sharpe: Maybe;
  maxDrawdown: Maybe;
  volatility: Maybe;
  closedTrades: number;
  exposure: Maybe;
  winRate: Maybe;
}

export interface SweepResult {
  axes: SweepAxis[];
  cells: SweepCell[];
  /** Cell with the highest Sharpe, or null when no cell produced one. */
  best: SweepCell | null;
  /** Cell with the highest total return. */
  bestByReturn: SweepCell | null;
  /** Distribution of Sharpe across the grid. */
  distribution: {
    count: number;
    withTrades: number;
    medianSharpe: Maybe;
    meanSharpe: Maybe;
    sharpeSpread: Maybe;
    fractionProfitable: Maybe;
    bestSharpe: Maybe;
    worstSharpe: Maybe;
  };
  /**
   * Probability that the best cell's Sharpe is genuinely above zero once the
   * number of trials is accounted for.
   */
  deflatedSharpe: Maybe;
  /** Expected best Sharpe from this many trials if every rule were worthless. */
  expectedMaxSharpeUnderNull: Maybe;
  /** Best Sharpe less the expected best under the null. */
  sharpeHaircut: Maybe;
  truncated: boolean;
  warnings: string[];
}

/** Cartesian product of up to two axes. */
function gridOf(axes: readonly SweepAxis[]): Array<Record<string, number>> {
  if (axes.length === 0) return [{}];
  if (axes.length === 1) return axes[0].values.map((value) => ({ [axes[0].param]: value }));
  const [first, second] = axes;
  const out: Array<Record<string, number>> = [];
  for (const a of first.values) {
    for (const b of second.values) out.push({ [first.param]: a, [second.param]: b });
  }
  return out;
}

/**
 * Inverse standard normal cumulative distribution, via Acklam's rational
 * approximation. Accurate to about 1.15e-9 across the open interval, which is
 * far beyond what is needed here and avoids pulling in a statistics library.
 */
export function normalInverse(p: number): number {
  if (!(p > 0 && p < 1)) return Number.NaN;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Standard normal cumulative distribution, via the error function. */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return Number.NaN;
  // Abramowitz and Stegun 7.1.26 applied to erf.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

const EULER_MASCHERONI = 0.5772156649015329;

/**
 * Expected maximum Sharpe ratio across `trials` independent worthless
 * strategies, in units of the Sharpe's own standard error.
 *
 * This is the order-statistic result used by the deflated Sharpe ratio: the
 * maximum of many draws from a zero-mean distribution is not zero, it grows
 * with the number of draws. Searching a hundred parameter cells and reporting
 * the best one without this adjustment presents that growth as skill.
 */
export function expectedMaxZ(trials: number): number {
  const n = Math.max(1, Math.floor(trials));
  if (n === 1) return 0;
  return (
    (1 - EULER_MASCHERONI) * normalInverse(1 - 1 / n) +
    EULER_MASCHERONI * normalInverse(1 - 1 / (n * Math.E))
  );
}

/**
 * Standard error of an **annualized** Sharpe ratio estimated from
 * `observations` periodic returns, assuming the returns are serially
 * independent.
 *
 * The textbook expression `sqrt((1 + SR^2 / 2) / (n - 1))` applies to a Sharpe
 * measured at the same frequency as the returns. Applying it directly to an
 * annualized figure understates the error by the annualization factor, which
 * for daily data is nearly fourteen: it would claim a year of daily bars pins
 * an annualized Sharpe to about ±0.07 when the true figure is nearer ±1.
 *
 * So the error is computed per period and then annualized the same way the
 * Sharpe itself was.
 */
export function sharpeStandardError(
  annualizedSharpe: number,
  observations: number,
  periodsPerYear = 252,
): Maybe {
  if (observations < 3 || periodsPerYear <= 0) return null;
  const perPeriod = annualizedSharpe / Math.sqrt(periodsPerYear);
  const errorPerPeriod = Math.sqrt((1 + (perPeriod * perPeriod) / 2) / (observations - 1));
  return finite(errorPerPeriod * Math.sqrt(periodsPerYear));
}

/**
 * Deflated Sharpe ratio: the probability that the best of `trials` results has
 * a genuinely positive Sharpe.
 *
 * Returns `null` when there are too few observations to estimate the standard
 * error. A value near 0.5 or below means the best cell is indistinguishable
 * from the best of that many coin flips.
 */
export function deflatedSharpe(
  bestSharpe: number,
  observations: number,
  trials: number,
): { probability: Maybe; expectedMax: Maybe; haircut: Maybe } {
  const standardError = sharpeStandardError(bestSharpe, observations);
  if (standardError === null || standardError === 0) {
    return { probability: null, expectedMax: null, haircut: null };
  }
  const expectedMax = expectedMaxZ(trials) * standardError;
  const haircut = bestSharpe - expectedMax;
  const probability = normalCdf(haircut / standardError);
  return {
    probability: finite(probability),
    expectedMax: finite(expectedMax),
    haircut: finite(haircut),
  };
}

/**
 * Runs a strategy across a parameter grid.
 *
 * Cells whose parameters are invalid, such as a fast average that is not
 * shorter than the slow one, still appear in the grid with null statistics.
 * Silently dropping them would make the heatmap lie about its own axes.
 */
export function sweep(
  bars: readonly Bar[],
  base: StrategySpec,
  axes: readonly SweepAxis[],
  options: { symbol?: string; maxCells?: number } = {},
): SweepResult {
  const maxCells = options.maxCells ?? MAX_SWEEP_CELLS;
  const warnings: string[] = [];
  const usableAxes = axes.slice(0, 2).map((axis) => ({ ...axis, values: axis.values.slice() }));
  if (axes.length > 2) warnings.push("Only the first two axes are swept; the rest are held at their base value.");

  let combinations = gridOf(usableAxes);
  let truncated = false;
  if (combinations.length > maxCells) {
    combinations = combinations.slice(0, maxCells);
    truncated = true;
    warnings.push(`The grid was capped at ${maxCells} cells; narrow the ranges to sweep the rest.`);
  }

  const cells: SweepCell[] = combinations.map((params) => {
    const spec: StrategySpec = { ...base, params: { ...base.params, ...params } };
    const result = runBacktest(bars, spec, { symbol: options.symbol });
    return {
      params,
      totalReturn: result.totalReturn,
      cagr: result.cagr,
      sharpe: result.sharpe,
      maxDrawdown: result.maxDrawdown,
      volatility: result.volatility,
      closedTrades: result.statistics.closedTrades,
      exposure: result.statistics.exposure,
      winRate: result.statistics.winRate,
    };
  });

  const traded = cells.filter((cell) => cell.closedTrades > 0 || cell.totalReturn !== null);
  const sharpes = cells.map((cell) => cell.sharpe).filter((value): value is number => value !== null);
  const returns = cells.map((cell) => cell.totalReturn).filter((value): value is number => value !== null);

  const best =
    sharpes.length === 0
      ? null
      : cells.reduce((winner, cell) =>
          (cell.sharpe ?? -Infinity) > (winner?.sharpe ?? -Infinity) ? cell : winner,
        cells[0]);
  const bestByReturn =
    returns.length === 0
      ? null
      : cells.reduce((winner, cell) =>
          (cell.totalReturn ?? -Infinity) > (winner?.totalReturn ?? -Infinity) ? cell : winner,
        cells[0]);

  // The trial count is the number of cells that actually produced a statistic,
  // not the nominal grid size: an invalid cell was never a coin flip.
  const trials = Math.max(1, sharpes.length);
  const observations = Math.max(0, bars.length - 1);
  const deflated =
    best?.sharpe !== null && best?.sharpe !== undefined
      ? deflatedSharpe(best.sharpe, observations, trials)
      : { probability: null, expectedMax: null, haircut: null };

  if (trials > 1 && deflated.probability !== null && deflated.probability < 0.6) {
    warnings.push(
      `Across ${trials} parameter cells the best Sharpe is not distinguishable from the best of that many worthless rules.`,
    );
  }

  return {
    axes: usableAxes,
    cells,
    best,
    bestByReturn,
    distribution: {
      count: cells.length,
      withTrades: traded.length,
      medianSharpe: median(sharpes),
      meanSharpe: mean(sharpes),
      sharpeSpread: stdDev(sharpes),
      fractionProfitable: returns.length > 0 ? safeDiv(returns.filter((value) => value > 0).length, returns.length) : null,
      bestSharpe: sharpes.length > 0 ? Math.max(...sharpes) : null,
      worstSharpe: sharpes.length > 0 ? Math.min(...sharpes) : null,
    },
    deflatedSharpe: deflated.probability,
    expectedMaxSharpeUnderNull: deflated.expectedMax,
    sharpeHaircut: deflated.haircut,
    truncated,
    warnings,
  };
}

export interface WalkForwardFold {
  index: number;
  inSampleStart: string;
  inSampleEnd: string;
  outOfSampleStart: string;
  outOfSampleEnd: string;
  /** Parameters chosen on the in-sample slice. */
  chosenParams: Record<string, number>;
  inSampleSharpe: Maybe;
  inSampleReturn: Maybe;
  outOfSampleSharpe: Maybe;
  outOfSampleReturn: Maybe;
  outOfSampleTrades: number;
}

export interface WalkForwardResult {
  folds: WalkForwardFold[];
  /** Mean out-of-sample return across folds. */
  meanOutOfSampleReturn: Maybe;
  meanOutOfSampleSharpe: Maybe;
  /** Mean in-sample return, for the degradation comparison. */
  meanInSampleReturn: Maybe;
  /**
   * Out-of-sample mean return divided by in-sample mean return. Well below 1
   * means the parameter choice did not generalise.
   */
  efficiency: Maybe;
  /** Fraction of folds whose out-of-sample return was positive. */
  hitRate: Maybe;
  warnings: string[];
}

/**
 * Rolling walk-forward validation.
 *
 * Each fold picks parameters on an in-sample slice and then measures them on
 * the slice that immediately follows, which the choice never saw. This is the
 * only construction here that produces a number not contaminated by the search
 * that produced it.
 *
 * With a single year of daily bars, three folds leave roughly two months of
 * out-of-sample data each. That is disclosed rather than smoothed over: the
 * result is a demonstration of the method, not evidence about the rule.
 */
export function walkForward(
  bars: readonly Bar[],
  base: StrategySpec,
  axes: readonly SweepAxis[],
  options: { folds?: number; symbol?: string; minBarsPerSlice?: number } = {},
): WalkForwardResult {
  const foldCount = Math.max(1, options.folds ?? 3);
  const minBars = options.minBarsPerSlice ?? 30;
  const warnings: string[] = [];

  // Each fold needs an in-sample and an out-of-sample slice, so the window is
  // divided into foldCount + 1 blocks and the folds walk forward across them.
  const blockSize = Math.floor(bars.length / (foldCount + 1));
  if (blockSize < minBars) {
    warnings.push(
      `Each slice would hold about ${blockSize} bars, below the ${minBars} needed for a usable estimate. Reduce the fold count or widen the window.`,
    );
  }
  if (blockSize < 2) {
    return {
      folds: [],
      meanOutOfSampleReturn: null,
      meanOutOfSampleSharpe: null,
      meanInSampleReturn: null,
      efficiency: null,
      hitRate: null,
      warnings: [...warnings, "The window is too short to split into folds."],
    };
  }

  const folds: WalkForwardFold[] = [];
  for (let fold = 0; fold < foldCount; fold += 1) {
    const inStart = 0;
    const inEnd = blockSize * (fold + 1);
    const outStart = inEnd;
    const outEnd = Math.min(bars.length, outStart + blockSize);
    if (outEnd - outStart < 2) break;

    const inSample = bars.slice(inStart, inEnd);
    const outOfSample = bars.slice(outStart, outEnd);

    const inSweep = sweep(inSample, base, axes, { symbol: options.symbol });
    const chosen = inSweep.best?.params ?? {};
    const chosenSpec: StrategySpec = { ...base, params: { ...base.params, ...chosen } };
    const outRun = runBacktest(outOfSample, chosenSpec, { symbol: options.symbol });

    folds.push({
      index: fold,
      inSampleStart: inSample[0].timestamp,
      inSampleEnd: inSample[inSample.length - 1].timestamp,
      outOfSampleStart: outOfSample[0].timestamp,
      outOfSampleEnd: outOfSample[outOfSample.length - 1].timestamp,
      chosenParams: chosen,
      inSampleSharpe: inSweep.best?.sharpe ?? null,
      inSampleReturn: inSweep.best?.totalReturn ?? null,
      outOfSampleSharpe: outRun.sharpe,
      outOfSampleReturn: outRun.totalReturn,
      outOfSampleTrades: outRun.statistics.closedTrades,
    });
  }

  const outReturns = folds.map((fold) => fold.outOfSampleReturn).filter((value): value is number => value !== null);
  const inReturns = folds.map((fold) => fold.inSampleReturn).filter((value): value is number => value !== null);
  const meanOut = mean(outReturns);
  const meanIn = mean(inReturns);

  if (meanIn !== null && meanOut !== null && meanIn > 0 && meanOut < meanIn * 0.3) {
    warnings.push("Out-of-sample returns fall well short of in-sample; the parameter choice did not generalise.");
  }

  return {
    folds,
    meanOutOfSampleReturn: meanOut,
    meanOutOfSampleSharpe: mean(
      folds.map((fold) => fold.outOfSampleSharpe).filter((value): value is number => value !== null),
    ),
    meanInSampleReturn: meanIn,
    efficiency: meanIn !== null && meanIn !== 0 && meanOut !== null ? safeDiv(meanOut, meanIn) : null,
    hitRate: outReturns.length > 0 ? safeDiv(outReturns.filter((value) => value > 0).length, outReturns.length) : null,
    warnings,
  };
}

/** Evenly spaced integer values for a sweep axis. */
export function integerRange(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  const lower = Math.min(from, to);
  const upper = Math.max(from, to);
  const increment = Math.max(1, Math.round(step));
  for (let value = lower; value <= upper; value += increment) out.push(value);
  return out;
}

/**
 * Benchmark comparison.
 *
 * Everything here operates on the **intersection** of the two trading
 * calendars. Two assets can differ in listing date, exchange holiday schedule
 * and trading halts, so a positional zip of the two arrays would eventually
 * pair mismatched dates and quietly corrupt correlation and beta. Alignment is
 * done once, up front, by `alignSeries`.
 */

import { correlation, covariance, finite, mean, safeDiv, simpleReturn, stdDev, variance } from "./math.ts";
import { alignSeries } from "./series.ts";
import { PERIODS_PER_YEAR } from "./types.ts";
import type { Bar, Interval, Maybe } from "./types.ts";
import { cagr, drawdown, periodicReturns, totalReturn, volatility } from "./returns.ts";

export interface NormalizedPoint {
  timestamp: string;
  /** Asset rebased so the first aligned bar is 100. */
  base: Maybe;
  /** Benchmark rebased so the first aligned bar is 100. */
  benchmark: Maybe;
}

export interface ComparisonResult {
  /** Symbol labels, echoed back so the chart legend cannot drift from the data. */
  baseSymbol: string;
  benchmarkSymbol: string;
  /** Rebased series, both starting at 100 on the first common date. */
  normalized: NormalizedPoint[];
  /** Number of dates present in both series. */
  alignedPoints: number;
  /** Bars discarded because the other series had no bar that day. */
  droppedPoints: number;
  /** First and last date common to both series. */
  windowStart: string | null;
  windowEnd: string | null;
  baseReturn: Maybe;
  benchmarkReturn: Maybe;
  /** `baseReturn - benchmarkReturn`, in fraction terms. Positive means outperformance. */
  excessReturn: Maybe;
  /** Growth of 1 unit in the asset divided by growth in the benchmark, minus 1. */
  relativeGrowth: Maybe;
  /** Pearson correlation of the two aligned periodic-return series. */
  correlation: Maybe;
  /** Slope of asset returns regressed on benchmark returns. */
  beta: Maybe;
  /** Annualized CAPM alpha, using the aligned window's CAGR figures. */
  alpha: Maybe;
  /** Annualized standard deviation of the return difference. */
  trackingError: Maybe;
  /** Annualized excess return divided by tracking error. */
  informationRatio: Maybe;
  baseVolatility: Maybe;
  benchmarkVolatility: Maybe;
  baseMaxDrawdown: Maybe;
  benchmarkMaxDrawdown: Maybe;
  /** True when the asset's total return over the aligned window beats the benchmark. */
  outperforming: boolean | null;
  /** Reasons the comparison is partial or unavailable. */
  warnings: string[];
}

/** Minimum aligned observations before correlation and beta are reported. */
export const MIN_COMPARISON_OBSERVATIONS = 20;

/**
 * Compares an asset against a benchmark over their common trading days.
 *
 * The normalized series rebases **both** legs to 100 at the first shared date,
 * which is the only way the two lines answer "what would a dollar have done".
 * Rebasing each leg to its own first bar, when those bars fall on different
 * days, produces a chart that looks right and is wrong.
 *
 * Correlation, beta, tracking error and the information ratio are withheld
 * below `MIN_COMPARISON_OBSERVATIONS` aligned returns and a note is added to
 * `warnings`; a beta computed from four days is noise with a decimal point.
 */
export function compareToBenchmark(
  base: readonly Bar[],
  benchmark: readonly Bar[],
  options: {
    baseSymbol?: string;
    benchmarkSymbol?: string;
    interval?: Interval;
    riskFreeRate?: number;
  } = {},
): ComparisonResult {
  const { baseSymbol = "Asset", benchmarkSymbol = "Benchmark", interval = "1d", riskFreeRate = 0 } = options;
  const warnings: string[] = [];

  const empty: ComparisonResult = {
    baseSymbol,
    benchmarkSymbol,
    normalized: [],
    alignedPoints: 0,
    droppedPoints: 0,
    windowStart: null,
    windowEnd: null,
    baseReturn: null,
    benchmarkReturn: null,
    excessReturn: null,
    relativeGrowth: null,
    correlation: null,
    beta: null,
    alpha: null,
    trackingError: null,
    informationRatio: null,
    baseVolatility: null,
    benchmarkVolatility: null,
    baseMaxDrawdown: null,
    benchmarkMaxDrawdown: null,
    outperforming: null,
    warnings,
  };

  if (base.length === 0 || benchmark.length === 0) {
    warnings.push("One of the two series has no price history.");
    return empty;
  }

  const aligned = alignSeries(base, benchmark);
  if (aligned.timestamps.length < 2) {
    warnings.push("The two series share fewer than two trading days; they cannot be compared.");
    return { ...empty, alignedPoints: aligned.timestamps.length, droppedPoints: aligned.dropped };
  }
  if (aligned.dropped > 0) {
    warnings.push(
      `${aligned.dropped} ${aligned.dropped === 1 ? "bar was" : "bars were"} dropped where the two trading calendars differ.`,
    );
  }

  const baseStart = aligned.left[0].adjClose;
  const benchStart = aligned.right[0].adjClose;
  if (baseStart <= 0 || benchStart <= 0) {
    warnings.push("Starting price is not positive; the series cannot be rebased.");
    return { ...empty, alignedPoints: aligned.timestamps.length, droppedPoints: aligned.dropped };
  }

  const normalized: NormalizedPoint[] = aligned.timestamps.map((timestamp, index) => ({
    timestamp,
    base: finite((aligned.left[index].adjClose / baseStart) * 100),
    benchmark: finite((aligned.right[index].adjClose / benchStart) * 100),
  }));

  const baseTotal = totalReturn(aligned.left);
  const benchTotal = totalReturn(aligned.right);
  const excessReturn = baseTotal !== null && benchTotal !== null ? finite(baseTotal - benchTotal) : null;
  const relativeGrowth =
    baseTotal !== null && benchTotal !== null ? safeDiv(1 + baseTotal, 1 + benchTotal) : null;

  const baseReturns = periodicReturns(aligned.left);
  const benchReturns = periodicReturns(aligned.right);
  const enoughObservations = Math.min(baseReturns.length, benchReturns.length) >= MIN_COMPARISON_OBSERVATIONS;
  if (!enoughObservations) {
    warnings.push(
      `Correlation and beta need at least ${MIN_COMPARISON_OBSERVATIONS} common sessions; this window has ${Math.min(baseReturns.length, benchReturns.length)}.`,
    );
  }

  const periodsPerYear = PERIODS_PER_YEAR[interval] ?? PERIODS_PER_YEAR["1d"];
  const pairCount = Math.min(baseReturns.length, benchReturns.length);
  const baseSlice = baseReturns.slice(0, pairCount);
  const benchSlice = benchReturns.slice(0, pairCount);
  const differences = baseSlice.map((value, index) => value - benchSlice[index]);

  const beta = enoughObservations
    ? safeDiv(covariance(baseSlice, benchSlice), variance(benchSlice))
    : null;

  const baseGrowth = cagr(aligned.left);
  const benchGrowth = cagr(aligned.right);
  const alpha =
    beta !== null && baseGrowth.value !== null && benchGrowth.value !== null
      ? finite(baseGrowth.value - (riskFreeRate + beta * (benchGrowth.value - riskFreeRate)))
      : null;

  const trackingErrorPeriodic = enoughObservations ? stdDev(differences) : null;
  const trackingError =
    trackingErrorPeriodic === null ? null : finite(trackingErrorPeriodic * Math.sqrt(periodsPerYear));
  const meanDifference = enoughObservations ? mean(differences) : null;
  const informationRatio =
    meanDifference === null || trackingError === null || trackingError === 0
      ? null
      : safeDiv(meanDifference * periodsPerYear, trackingError);

  return {
    baseSymbol,
    benchmarkSymbol,
    normalized,
    alignedPoints: aligned.timestamps.length,
    droppedPoints: aligned.dropped,
    windowStart: aligned.timestamps[0],
    windowEnd: aligned.timestamps[aligned.timestamps.length - 1],
    baseReturn: baseTotal,
    benchmarkReturn: benchTotal,
    excessReturn,
    relativeGrowth: relativeGrowth === null ? null : finite(relativeGrowth - 1),
    correlation: enoughObservations ? correlation(baseSlice, benchSlice) : null,
    beta,
    alpha,
    trackingError,
    informationRatio,
    baseVolatility: volatility(aligned.left, interval).annualized,
    benchmarkVolatility: volatility(aligned.right, interval).annualized,
    baseMaxDrawdown: drawdown(aligned.left).maxDrawdown,
    benchmarkMaxDrawdown: drawdown(aligned.right).maxDrawdown,
    outperforming: excessReturn === null ? null : excessReturn > 0,
    warnings,
  };
}

/**
 * Correlation matrix over a set of named series, aligned pairwise.
 *
 * Each pair is aligned independently rather than reducing every series to one
 * global intersection, so a single short-history name does not shrink the
 * sample for all the others. The diagonal is 1 by definition; a cell is `null`
 * when the pair has too few common sessions.
 */
export function correlationMatrix(
  entries: readonly { symbol: string; bars: readonly Bar[] }[],
  minObservations = MIN_COMPARISON_OBSERVATIONS,
): { symbols: string[]; matrix: Maybe[][] } {
  const symbols = entries.map((entry) => entry.symbol);
  const matrix: Maybe[][] = symbols.map(() => symbols.map(() => null));

  for (let i = 0; i < entries.length; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < entries.length; j += 1) {
      const aligned = alignSeries(entries[i].bars, entries[j].bars);
      const left = periodicReturns(aligned.left);
      const right = periodicReturns(aligned.right);
      const value =
        Math.min(left.length, right.length) >= minObservations
          ? correlation(left.slice(0, right.length), right.slice(0, left.length))
          : null;
      matrix[i][j] = value;
      matrix[j][i] = value;
    }
  }

  return { symbols, matrix };
}

/**
 * Average of the off-diagonal entries of a correlation matrix.
 * A lower number means the holdings move more independently, which is the
 * diversification signal the portfolio page reports.
 */
export function averagePairwiseCorrelation(matrix: readonly Maybe[][]): Maybe {
  const values: number[] = [];
  for (let i = 0; i < matrix.length; i += 1) {
    for (let j = i + 1; j < matrix.length; j += 1) {
      const value = matrix[i][j];
      if (value !== null) values.push(value);
    }
  }
  return values.length === 0 ? null : mean(values);
}

/**
 * Rebases a single series to 100 at its first bar. Exposed separately from the
 * comparison so the chart can normalize an arbitrary number of overlay series.
 */
export function rebase(bars: readonly Bar[]): Array<{ timestamp: string; value: Maybe }> {
  if (bars.length === 0) return [];
  const base = bars[0].adjClose;
  if (base <= 0) return bars.map((bar) => ({ timestamp: bar.timestamp, value: null }));
  return bars.map((bar) => ({ timestamp: bar.timestamp, value: finite((bar.adjClose / base) * 100) }));
}

/** Total return of a series between two explicit prices, kept for symmetry with `rebase`. */
export function growthOf(from: number, to: number): Maybe {
  return simpleReturn(from, to);
}

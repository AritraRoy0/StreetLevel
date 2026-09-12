/**
 * Return, risk and volume statistics.
 *
 * Convention: every return is a **fraction**, not a percentage. `0.0512` means
 * +5.12%. Converting to percent happens once, in `format.ts`. Mixing the two
 * representations is the most common source of hundred-fold errors in this
 * kind of code, so the boundary is kept deliberately sharp.
 */

import {
  MIN_CAGR_DAYS,
  MIN_VOLATILITY_OBSERVATIONS,
  finite,
  isNum,
  maxOf,
  mean,
  minOf,
  safeDiv,
  simpleReturn,
  stdDev,
  sum,
} from "./math.ts";
import { daysBetween, isoWeekKey, monthKey } from "./series.ts";
import { DAYS_PER_YEAR, PERIODS_PER_YEAR } from "./types.ts";
import type { Bar, DrawdownResult, Extreme, Interval, Maybe, PeriodReturn, VolatilityResult } from "./types.ts";

/** Adjusted closes of a bar series, the input to every return calculation. */
export function closes(bars: readonly Bar[]): number[] {
  return bars.map((bar) => bar.adjClose);
}

/**
 * Total return across the whole window: first adjusted close to last.
 *
 * Returns `null` for fewer than two bars, because a single observation cannot
 * express a change, and for a non-positive starting price.
 */
export function totalReturn(bars: readonly Bar[]): Maybe {
  if (bars.length < 2) return null;
  return simpleReturn(bars[0].adjClose, bars[bars.length - 1].adjClose);
}

/**
 * Absolute price change across the window in currency units.
 *
 * Uses the **unadjusted** close so the number reconciles with what a quote
 * screen shows. The percentage return uses adjusted closes, so the two can
 * legitimately disagree across a dividend or split; that is correct, not a bug.
 */
export function absoluteChange(bars: readonly Bar[]): Maybe {
  if (bars.length < 2) return null;
  return finite(bars[bars.length - 1].close - bars[0].close);
}

/**
 * Periodic simple returns, one per bar transition. Length is `bars.length - 1`.
 * Transitions where the earlier price is not strictly positive are skipped
 * rather than emitted as `null`, because the downstream statistics operate on
 * a dense sample.
 */
export function periodicReturns(bars: readonly Bar[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const value = simpleReturn(bars[i - 1].adjClose, bars[i].adjClose);
    if (value !== null) out.push(value);
  }
  return out;
}

/** Periodic returns paired with the timestamp of the later bar. */
export function datedReturns(bars: readonly Bar[]): PeriodReturn[] {
  const out: PeriodReturn[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const value = simpleReturn(bars[i - 1].adjClose, bars[i].adjClose);
    if (value === null) continue;
    out.push({ key: bars[i].timestamp.slice(0, 10), timestamp: bars[i].timestamp, value });
  }
  return out;
}

/**
 * Groups bars into calendar buckets and returns the close-to-close return of
 * each bucket, measured from the **previous bucket's** last close so no part
 * of the move is dropped at the boundary.
 *
 * The first bucket has no predecessor and is therefore omitted. This is why a
 * three-month window yields two or three monthly returns rather than four.
 */
function bucketReturns(bars: readonly Bar[], keyFor: (timestamp: string) => string): PeriodReturn[] {
  if (bars.length < 2) return [];
  const lastOfBucket = new Map<string, Bar>();
  const order: string[] = [];
  for (const bar of bars) {
    const key = keyFor(bar.timestamp);
    if (!lastOfBucket.has(key)) order.push(key);
    lastOfBucket.set(key, bar);
  }
  const out: PeriodReturn[] = [];
  for (let i = 1; i < order.length; i += 1) {
    const previous = lastOfBucket.get(order[i - 1])!;
    const current = lastOfBucket.get(order[i])!;
    const value = simpleReturn(previous.adjClose, current.adjClose);
    if (value === null) continue;
    out.push({ key: order[i], timestamp: current.timestamp, value });
  }
  return out;
}

/** Week-over-week returns keyed by ISO week, measured on each week's last session. */
export function weeklyReturns(bars: readonly Bar[]): PeriodReturn[] {
  return bucketReturns(bars, isoWeekKey);
}

/** Month-over-month returns keyed by calendar month, measured on each month's last session. */
export function monthlyReturns(bars: readonly Bar[]): PeriodReturn[] {
  return bucketReturns(bars, monthKey);
}

/** Daily returns keyed by UTC calendar day. Equivalent to `datedReturns` on daily bars. */
export function dailyReturns(bars: readonly Bar[]): PeriodReturn[] {
  return datedReturns(bars);
}

/**
 * Compound annual growth rate.
 *
 * `CAGR = (end / start)^(365.25 / days) - 1` where `days` is the actual
 * calendar span of the window.
 *
 * Returns `null` when the window is shorter than `MIN_CAGR_DAYS` (330 days by
 * default). Annualizing a one-month move produces figures like +900% that are
 * arithmetically correct and analytically meaningless, so the metric is
 * withheld rather than shown with a caveat. Callers surface the reason through
 * `insufficientHistory`.
 */
export function cagr(bars: readonly Bar[], minDays = MIN_CAGR_DAYS): {
  value: Maybe;
  days: Maybe;
  insufficientHistory: boolean;
} {
  if (bars.length < 2) return { value: null, days: null, insufficientHistory: true };
  const first = bars[0];
  const last = bars[bars.length - 1];
  const days = daysBetween(first.timestamp, last.timestamp);
  if (days === null || days <= 0) return { value: null, days: null, insufficientHistory: true };
  if (days < minDays) return { value: null, days, insufficientHistory: true };
  if (first.adjClose <= 0 || last.adjClose <= 0) return { value: null, days, insufficientHistory: false };
  const value = finite((last.adjClose / first.adjClose) ** (DAYS_PER_YEAR / days) - 1);
  return { value, days, insufficientHistory: false };
}

/**
 * Annualized volatility: the sample standard deviation of periodic returns,
 * scaled by the square root of the number of periods in a year.
 *
 * `σ_annual = σ_periodic * sqrt(P)` with `P` = 252 for daily bars, 52 for
 * weekly and 12 for monthly. The square-root rule assumes returns are serially
 * independent, which is the standard working assumption for this metric.
 *
 * A value is produced from two returns onward, since that is the minimum for a
 * sample deviation, but `sufficient` is false below
 * `MIN_VOLATILITY_OBSERVATIONS` so the UI can mark the estimate as noisy
 * instead of presenting a three-day figure as an annual risk number.
 */
export function volatility(bars: readonly Bar[], interval: Interval = "1d"): VolatilityResult {
  const returns = periodicReturns(bars);
  const periodic = stdDev(returns);
  const periodsPerYear = PERIODS_PER_YEAR[interval] ?? PERIODS_PER_YEAR["1d"];
  return {
    periodic,
    annualized: periodic === null ? null : finite(periodic * Math.sqrt(periodsPerYear)),
    observations: returns.length,
    sufficient: returns.length >= MIN_VOLATILITY_OBSERVATIONS,
  };
}

/**
 * Drawdown series and the worst peak-to-trough decline in the window.
 *
 * At each bar, `dd_t = C_t / max(C_0..C_t) - 1`, so the series is 0 at every
 * new high and negative in between. Max drawdown is the minimum of that
 * series. The peak is the running-maximum bar that preceded the worst trough,
 * and recovery is the first later bar that closes at or above that peak.
 *
 * Drawdown is computed on adjusted closes. Using intraday lows would give a
 * deeper and equally defensible number, but mixing the two across a page is
 * what makes two cards disagree, so closes are used everywhere.
 */
export function drawdown(bars: readonly Bar[]): DrawdownResult {
  const empty: DrawdownResult = {
    series: [],
    maxDrawdown: null,
    peakTimestamp: null,
    troughTimestamp: null,
    recoveryTimestamp: null,
    drawdownDays: null,
    recoveryDays: null,
    currentDrawdown: null,
  };
  if (bars.length === 0) return empty;

  let peak = -Infinity;
  let peakIndex = 0;
  let worst = 0;
  let worstPeakIndex = 0;
  let worstTroughIndex = 0;
  const series: DrawdownResult["series"] = [];

  for (let i = 0; i < bars.length; i += 1) {
    const price = bars[i].adjClose;
    if (!isNum(price) || price <= 0) {
      series.push({ timestamp: bars[i].timestamp, value: null });
      continue;
    }
    if (price > peak) {
      peak = price;
      peakIndex = i;
    }
    const value = peak > 0 ? price / peak - 1 : null;
    series.push({ timestamp: bars[i].timestamp, value });
    if (value !== null && value < worst) {
      worst = value;
      worstPeakIndex = peakIndex;
      worstTroughIndex = i;
    }
  }

  if (peak === -Infinity) return { ...empty, series };

  const peakBar = bars[worstPeakIndex];
  const troughBar = bars[worstTroughIndex];
  let recoveryTimestamp: string | null = null;
  if (worst < 0) {
    for (let i = worstTroughIndex + 1; i < bars.length; i += 1) {
      if (bars[i].adjClose >= peakBar.adjClose) {
        recoveryTimestamp = bars[i].timestamp;
        break;
      }
    }
  }

  const currentValue = series[series.length - 1]?.value ?? null;

  return {
    series,
    maxDrawdown: worst,
    peakTimestamp: worst < 0 ? peakBar.timestamp : null,
    troughTimestamp: worst < 0 ? troughBar.timestamp : null,
    recoveryTimestamp,
    drawdownDays: worst < 0 ? daysBetween(peakBar.timestamp, troughBar.timestamp) : null,
    recoveryDays: recoveryTimestamp ? daysBetween(troughBar.timestamp, recoveryTimestamp) : null,
    currentDrawdown: currentValue,
  };
}

export interface RangeExtremes {
  high: Extreme;
  low: Extreme;
  /** Where the latest close sits inside the high-low range, 0 at the low and 1 at the high. */
  position: Maybe;
  /** `high / low - 1`, the width of the range as a fraction of the low. */
  spread: Maybe;
}

/**
 * Highest high and lowest low across the window, using **intraday** extremes
 * rather than closes. A "52-week high" that ignores the wick is not the number
 * anyone means by that phrase.
 */
export function rangeExtremes(bars: readonly Bar[]): RangeExtremes {
  if (bars.length === 0) {
    return { high: { value: null, timestamp: null }, low: { value: null, timestamp: null }, position: null, spread: null };
  }
  let high = -Infinity;
  let low = Infinity;
  let highAt: string | null = null;
  let lowAt: string | null = null;
  for (const bar of bars) {
    if (bar.high > high) {
      high = bar.high;
      highAt = bar.timestamp;
    }
    if (bar.low < low) {
      low = bar.low;
      lowAt = bar.timestamp;
    }
  }
  const last = bars[bars.length - 1].close;
  return {
    high: { value: finite(high), timestamp: highAt },
    low: { value: finite(low), timestamp: lowAt },
    position: high === low ? null : safeDiv(last - low, high - low),
    spread: simpleReturn(low, high),
  };
}

export interface VolumeSummary {
  /** Mean volume across the window. */
  average: Maybe;
  /** Median volume, which is less distorted by a single earnings-day spike. */
  median: Maybe;
  /** Volume on the most recent bar. */
  latest: Maybe;
  /** Latest volume against the trailing average of the prior `lookback` bars, as a fraction. */
  latestVsAverage: Maybe;
  /** Average volume this window against the immediately preceding window of equal length. */
  periodOverPeriod: Maybe;
  /** Total volume traded across the window. */
  total: Maybe;
}

/**
 * Volume statistics for a window.
 *
 * `latestVsAverage` deliberately excludes the latest bar from its own baseline;
 * including it dampens exactly the spike the metric exists to detect.
 * `periodOverPeriod` needs `history` (the full series) to look at the window
 * immediately before the selected one, and is `null` when that earlier window
 * does not exist.
 */
export function volumeSummary(
  bars: readonly Bar[],
  history: readonly Bar[] = bars,
  lookback = 20,
): VolumeSummary {
  if (bars.length === 0) {
    return { average: null, median: null, latest: null, latestVsAverage: null, periodOverPeriod: null, total: null };
  }
  const volumes = bars.map((bar) => bar.volume);
  const latestVolume = volumes[volumes.length - 1];

  const priorWindow = volumes.slice(Math.max(0, volumes.length - 1 - lookback), volumes.length - 1);
  const priorAverage = priorWindow.length > 0 ? mean(priorWindow) : null;

  let periodOverPeriod: Maybe = null;
  const startIndex = history.findIndex((bar) => bar.timestamp === bars[0].timestamp);
  if (startIndex > 0) {
    const previousWindow = history.slice(Math.max(0, startIndex - bars.length), startIndex);
    if (previousWindow.length > 0) {
      const previousAverage = mean(previousWindow.map((bar) => bar.volume));
      const currentAverage = mean(volumes);
      if (previousAverage !== null && previousAverage > 0 && currentAverage !== null) {
        periodOverPeriod = finite(currentAverage / previousAverage - 1);
      }
    }
  }

  const sorted = volumes.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return {
    average: mean(volumes),
    median: sorted.length % 2 === 1 ? sorted[mid] : finite((sorted[mid - 1] + sorted[mid]) / 2),
    latest: latestVolume,
    latestVsAverage: priorAverage !== null && priorAverage > 0 ? finite(latestVolume / priorAverage - 1) : null,
    periodOverPeriod,
    total: sum(volumes),
  };
}

/**
 * Annualized Sharpe ratio.
 *
 * `(mean(r) * P - rf) / (σ * sqrt(P))` with `rf` the annual risk-free rate as
 * a fraction. Returns `null` when volatility is zero or undefined; a risk-free
 * asset has no Sharpe ratio, and reporting `Infinity` would break every
 * downstream format call.
 */
export function sharpe(bars: readonly Bar[], riskFreeRate = 0, interval: Interval = "1d"): Maybe {
  const returns = periodicReturns(bars);
  if (returns.length < 2) return null;
  const periodsPerYear = PERIODS_PER_YEAR[interval] ?? PERIODS_PER_YEAR["1d"];
  const averageReturn = mean(returns);
  const deviation = stdDev(returns);
  if (averageReturn === null || deviation === null || deviation === 0) return null;
  return safeDiv(averageReturn * periodsPerYear - riskFreeRate, deviation * Math.sqrt(periodsPerYear));
}

/**
 * Annualized Sortino ratio: like Sharpe, but the denominator counts only
 * returns below the minimum acceptable return (0 by default).
 *
 * Downside deviation is `sqrt(mean(min(r - MAR, 0)^2))` over **all** returns,
 * not only the negative ones. Dividing by the count of negative returns is a
 * common shortcut that inflates the ratio for assets that rarely fall.
 */
export function sortino(bars: readonly Bar[], riskFreeRate = 0, interval: Interval = "1d", mar = 0): Maybe {
  const returns = periodicReturns(bars);
  if (returns.length < 2) return null;
  const periodsPerYear = PERIODS_PER_YEAR[interval] ?? PERIODS_PER_YEAR["1d"];
  const averageReturn = mean(returns);
  if (averageReturn === null) return null;
  const downside = Math.sqrt(mean(returns.map((value) => Math.min(value - mar, 0) ** 2)) ?? 0);
  if (!isNum(downside) || downside === 0) return null;
  return safeDiv(averageReturn * periodsPerYear - riskFreeRate, downside * Math.sqrt(periodsPerYear));
}

/**
 * Calmar ratio: annualized return divided by the magnitude of max drawdown.
 * Returns `null` when the window is too short for a CAGR or there was no
 * drawdown to divide by.
 */
export function calmar(bars: readonly Bar[]): Maybe {
  const growth = cagr(bars);
  const risk = drawdown(bars);
  if (growth.value === null || risk.maxDrawdown === null || risk.maxDrawdown === 0) return null;
  return safeDiv(growth.value, Math.abs(risk.maxDrawdown));
}

export interface ReturnDistribution {
  best: PeriodReturn | null;
  worst: PeriodReturn | null;
  average: Maybe;
  positive: number;
  negative: number;
  flat: number;
  /** Share of periods with a strictly positive return, as a fraction. */
  hitRate: Maybe;
}

/** Best, worst, mean and win rate across a set of period returns. */
export function distribution(periods: readonly PeriodReturn[]): ReturnDistribution {
  if (periods.length === 0) {
    return { best: null, worst: null, average: null, positive: 0, negative: 0, flat: 0, hitRate: null };
  }
  let best = periods[0];
  let worst = periods[0];
  let positive = 0;
  let negative = 0;
  let flat = 0;
  for (const period of periods) {
    if (period.value > best.value) best = period;
    if (period.value < worst.value) worst = period;
    if (period.value > 0) positive += 1;
    else if (period.value < 0) negative += 1;
    else flat += 1;
  }
  return {
    best,
    worst,
    average: mean(periods.map((period) => period.value)),
    positive,
    negative,
    flat,
    hitRate: safeDiv(positive, periods.length),
  };
}

/** Highest and lowest of a plain numeric series, used for chart domains. */
export function extent(values: readonly number[]): { min: Maybe; max: Maybe } {
  return { min: minOf(values), max: maxOf(values) };
}

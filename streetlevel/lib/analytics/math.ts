/**
 * Numeric primitives for the analytics engine.
 *
 * Every function here is total: it returns `null` instead of throwing, and it
 * never returns `NaN` or `±Infinity`. This is the single place where division
 * by zero, empty inputs and non-finite provider values are handled, so the
 * layers above can stay readable.
 *
 * Rounding policy
 * ---------------
 * Calculations keep full double precision end to end. Rounding happens only at
 * the presentation boundary (`format.ts`), so chained metrics such as
 * "volatility of daily returns" never compound rounding error. `round()` is
 * exported for tests and for the rare case where a rounded value is genuinely
 * part of the contract (for example an exported CSV column).
 */

/** Minimum periodic returns required before a volatility estimate is trustworthy. */
export const MIN_VOLATILITY_OBSERVATIONS = 20;

/** Minimum calendar days a window must span before CAGR is reported. */
export const MIN_CAGR_DAYS = 330;

/** Weekdays the newest bar may lag `asOf` before the dataset is flagged stale. */
export const MAX_FRESH_WEEKDAYS = 3;

/** True for real, finite JavaScript numbers. Rejects NaN, ±Infinity, and non-numbers. */
export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Coerces anything into a finite number or `null`.
 * Accepts numeric strings because JSON providers sometimes quote numbers.
 */
export function toNum(value: unknown): number | null {
  if (isNum(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Guards a computed number. Returns `null` for `NaN` and `±Infinity`.
 * This is the last line of defence before a value reaches the UI.
 */
export function finite(value: number | null | undefined): number | null {
  return isNum(value) ? value : null;
}

/**
 * Division that yields `null` instead of `Infinity` or `NaN`.
 * A zero denominator is treated as "undefined", not as "infinitely large".
 */
export function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (!isNum(numerator) || !isNum(denominator) || denominator === 0) return null;
  return finite(numerator / denominator);
}

/**
 * Rounds half away from zero to `digits` decimal places.
 * `Math.round` rounds half up, which is asymmetric for negatives: it turns
 * -0.5 into -0 rather than -1. Percent changes are frequently negative, so the
 * symmetric rule is the correct one here.
 */
export function round(value: number | null | undefined, digits = 2): number | null {
  if (!isNum(value)) return null;
  const factor = 10 ** digits;
  const scaled = value * factor;
  // Correct for binary representation error before rounding, e.g. 1.005 * 100.
  const corrected = Number(scaled.toPrecision(15));
  const rounded = corrected < 0 ? -Math.round(-corrected) : Math.round(corrected);
  const result = rounded / factor;
  // Normalize -0 to 0 so formatted output never shows "-0.00".
  return result === 0 ? 0 : result;
}

/** Restricts `value` to `[min, max]`. Returns `null` for non-finite input. */
export function clamp(value: number | null, min: number, max: number): number | null {
  if (!isNum(value)) return null;
  return Math.min(Math.max(value, min), max);
}

/** Sum of a numeric array. Returns 0 for an empty array. Non-finite entries are skipped. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) if (isNum(value)) total += value;
  return total;
}

/** Arithmetic mean. Returns `null` for an empty array or one with no finite entries. */
export function mean(values: readonly number[]): number | null {
  const clean = values.filter(isNum);
  if (clean.length === 0) return null;
  return finite(sum(clean) / clean.length);
}

/** Median. Returns `null` for an empty array. Even-length arrays average the middle pair. */
export function median(values: readonly number[]): number | null {
  const clean = values.filter(isNum).slice().sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[mid] : finite((clean[mid - 1] + clean[mid]) / 2);
}

/**
 * Sample standard deviation, dividing by `n - 1` (Bessel's correction).
 * This is the right estimator for a return series, which is a sample drawn
 * from an unknown distribution rather than a complete population.
 * Returns `null` when fewer than 2 finite values are supplied.
 */
export function stdDev(values: readonly number[]): number | null {
  const clean = values.filter(isNum);
  if (clean.length < 2) return null;
  const average = mean(clean);
  if (average === null) return null;
  const variance = sum(clean.map((value) => (value - average) ** 2)) / (clean.length - 1);
  return finite(Math.sqrt(variance));
}

/**
 * Population standard deviation, dividing by `n`.
 * Bollinger Bands are defined on the population deviation of the lookback
 * window, so that indicator uses this rather than `stdDev`.
 * Returns `null` for an empty array.
 */
export function stdDevPopulation(values: readonly number[]): number | null {
  const clean = values.filter(isNum);
  if (clean.length === 0) return null;
  const average = mean(clean);
  if (average === null) return null;
  return finite(Math.sqrt(sum(clean.map((value) => (value - average) ** 2)) / clean.length));
}

/** Sample variance, dividing by `n - 1`. Returns `null` for fewer than 2 values. */
export function variance(values: readonly number[]): number | null {
  const deviation = stdDev(values);
  return deviation === null ? null : finite(deviation ** 2);
}

/**
 * Sample covariance of two equal-length series, dividing by `n - 1`.
 * Returns `null` when the lengths differ or fewer than 2 pairs are finite.
 */
export function covariance(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) return null;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i += 1) {
    if (isNum(xs[i]) && isNum(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 2) return null;
  const meanX = mean(pairs.map((pair) => pair[0]));
  const meanY = mean(pairs.map((pair) => pair[1]));
  if (meanX === null || meanY === null) return null;
  const total = sum(pairs.map(([x, y]) => (x - meanX) * (y - meanY)));
  return finite(total / (pairs.length - 1));
}

/**
 * Pearson correlation coefficient, in `[-1, 1]`.
 * Returns `null` when the lengths differ, fewer than 2 finite pairs exist, or
 * either series is constant (zero variance makes correlation undefined, not 0).
 * The result is clamped to `[-1, 1]` because floating point can overshoot.
 */
export function correlation(xs: readonly number[], ys: readonly number[]): number | null {
  const cov = covariance(xs, ys);
  if (cov === null) return null;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i += 1) {
    if (isNum(xs[i]) && isNum(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  const sdX = stdDev(pairs.map((pair) => pair[0]));
  const sdY = stdDev(pairs.map((pair) => pair[1]));
  if (sdX === null || sdY === null || sdX === 0 || sdY === 0) return null;
  return clamp(safeDiv(cov, sdX * sdY), -1, 1);
}

/** Largest finite value, or `null` when none exist. */
export function maxOf(values: readonly number[]): number | null {
  const clean = values.filter(isNum);
  return clean.length === 0 ? null : clean.reduce((a, b) => (b > a ? b : a));
}

/** Smallest finite value, or `null` when none exist. */
export function minOf(values: readonly number[]): number | null {
  const clean = values.filter(isNum);
  return clean.length === 0 ? null : clean.reduce((a, b) => (b < a ? b : a));
}

/**
 * Simple return from `from` to `to`, as a fraction (0.05 meaning +5%).
 * Returns `null` when either value is non-finite or the base is not strictly
 * positive. A zero or negative base price is bad data, not a 100% loss.
 */
export function simpleReturn(from: number | null, to: number | null): number | null {
  if (!isNum(from) || !isNum(to) || from <= 0) return null;
  return finite((to - from) / from);
}

/**
 * Natural log return, `ln(to / from)`.
 * Used where returns must be additive across time, such as aggregating
 * intraday bars. Returns `null` unless both values are strictly positive.
 */
export function logReturn(from: number | null, to: number | null): number | null {
  if (!isNum(from) || !isNum(to) || from <= 0 || to <= 0) return null;
  return finite(Math.log(to / from));
}

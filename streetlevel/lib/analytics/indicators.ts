/**
 * Technical indicators.
 *
 * Every series function returns an array the same length as its input, with
 * `null` in the warm-up positions where the indicator is not yet defined.
 * Keeping the arrays index-aligned with the bars is what lets the chart layer
 * plot an overlay without re-deriving offsets, and it makes the
 * insufficient-history case explicit rather than implicit in a shorter array.
 *
 * All price-based indicators here consume a plain `number[]` of closes so they
 * can be unit-tested against published reference series without constructing
 * bars. `adjClose` is the right input for trend work; the summary layer passes
 * it in.
 */

import { isNum, mean, safeDiv, stdDevPopulation } from "./math.ts";
import type { Bar, CrossEvent, Maybe } from "./types.ts";

/**
 * Simple moving average.
 *
 * `SMA_t = (1/n) * Σ C_(t-n+1..t)`
 *
 * Defined from index `n - 1` onward; earlier positions are `null`.
 * A period below 1, or a period longer than the series, yields all `null`.
 */
export function sma(values: readonly number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 1) return out;
  let running = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (!isNum(value)) return out.map(() => null);
    running += value;
    if (i >= period) running -= values[i - period];
    if (i >= period - 1) out[i] = running / period;
  }
  return out;
}

/**
 * Exponential moving average with the conventional smoothing factor
 * `k = 2 / (n + 1)`.
 *
 * The series is seeded at index `n - 1` with the simple average of the first
 * `n` values, then `EMA_t = C_t * k + EMA_(t-1) * (1 - k)`. Seeding with an SMA
 * rather than with the first close is what makes the output match the values
 * charting packages publish; seeding with `C_0` leaves a visible bias for the
 * first few multiples of the period.
 */
export function ema(values: readonly number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 1 || values.length < period) return out;
  if (values.some((value) => !isNum(value))) return out;

  const k = 2 / (period + 1);
  let previous = values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  out[period - 1] = previous;
  for (let i = period; i < values.length; i += 1) {
    previous = values[i] * k + previous * (1 - k);
    out[i] = previous;
  }
  return out;
}

/**
 * Wilder's smoothed moving average, `RMA_t = (RMA_(t-1) * (n - 1) + x_t) / n`.
 * Used internally by RSI and ATR. Seeded with the simple average of the first
 * `n` values, matching Wilder's original formulation.
 */
function wilderSmooth(values: readonly number[], period: number): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 1 || values.length < period) return out;
  let previous = values.slice(0, period).reduce((total, value) => total + value, 0) / period;
  out[period - 1] = previous;
  for (let i = period; i < values.length; i += 1) {
    previous = (previous * (period - 1) + values[i]) / period;
    out[i] = previous;
  }
  return out;
}

/**
 * Relative Strength Index, Wilder's 14-period definition.
 *
 * Gains and losses are the positive and negative parts of the close-to-close
 * change. Both are smoothed with Wilder's RMA, then
 * `RS = avgGain / avgLoss` and `RSI = 100 - 100 / (1 + RS)`.
 *
 * Needs `period + 1` closes; everything before index `period` is `null`.
 *
 * Edge cases, which the naive formula gets wrong:
 * - `avgLoss = 0` with a positive `avgGain` divides by zero. RSI is defined as
 *   100 there, the maximum of the scale.
 * - `avgGain = 0` with a positive `avgLoss` gives RS 0, so RSI is 0.
 * - Both zero means the price has not moved across the whole window. RS is
 *   genuinely undefined; RSI is reported as the neutral 50 rather than 100,
 *   which is what a divide-by-zero shortcut would produce and would read as a
 *   maximally overbought flat line.
 */
export function rsi(values: readonly number[], period = 14): Maybe[] {
  const out: Maybe[] = new Array(values.length).fill(null);
  if (!Number.isInteger(period) || period < 1 || values.length < period + 1) return out;
  if (values.some((value) => !isNum(value))) return out;

  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    gains.push(Math.max(change, 0));
    losses.push(Math.max(-change, 0));
  }

  const avgGain = wilderSmooth(gains, period);
  const avgLoss = wilderSmooth(losses, period);

  for (let i = 0; i < gains.length; i += 1) {
    const gain = avgGain[i];
    const loss = avgLoss[i];
    if (gain === null || loss === null) continue;
    let value: number;
    if (loss === 0 && gain === 0) value = 50;
    else if (loss === 0) value = 100;
    else if (gain === 0) value = 0;
    else value = 100 - 100 / (1 + gain / loss);
    // `gains` is offset by one bar from `values`.
    out[i + 1] = value;
  }
  return out;
}

export interface MacdResult {
  macd: Maybe[];
  signal: Maybe[];
  histogram: Maybe[];
}

/**
 * Moving Average Convergence Divergence, default 12/26/9.
 *
 * `MACD = EMA(fast) - EMA(slow)`, `signal = EMA(MACD, signalPeriod)`, and the
 * histogram is their difference. The signal EMA is seeded from the first
 * `signalPeriod` defined MACD values, so it begins at
 * `slow + signalPeriod - 2` and `null` fills everything before it.
 */
export function macd(values: readonly number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const empty: Maybe[] = new Array(values.length).fill(null);
  if (fast >= slow) return { macd: empty, signal: empty.slice(), histogram: empty.slice() };

  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const line: Maybe[] = values.map((_, index) => {
    const f = fastEma[index];
    const s = slowEma[index];
    return f === null || s === null ? null : f - s;
  });

  const firstDefined = line.findIndex((value) => value !== null);
  const signal: Maybe[] = new Array(values.length).fill(null);
  if (firstDefined >= 0) {
    const dense = line.slice(firstDefined).filter((value): value is number => value !== null);
    const signalDense = ema(dense, signalPeriod);
    for (let i = 0; i < signalDense.length; i += 1) signal[firstDefined + i] = signalDense[i];
  }

  const histogram: Maybe[] = line.map((value, index) => {
    const sig = signal[index];
    return value === null || sig === null ? null : value - sig;
  });

  return { macd: line, signal, histogram };
}

export interface BollingerResult {
  middle: Maybe[];
  upper: Maybe[];
  lower: Maybe[];
  /** Position of price within the band: 0 at the lower band, 1 at the upper. */
  percentB: Maybe[];
  /** Band width as a fraction of the middle band, a squeeze/expansion gauge. */
  bandwidth: Maybe[];
}

/**
 * Bollinger Bands, default 20-period with 2 standard deviations.
 *
 * The deviation is the **population** standard deviation of the lookback
 * window, which is Bollinger's original definition; using the sample estimator
 * widens the bands slightly and would not match published charts.
 *
 * `%B` is `(C - lower) / (upper - lower)` and is `null` when the bands touch,
 * which happens only on a perfectly flat window.
 */
export function bollinger(values: readonly number[], period = 20, multiplier = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: Maybe[] = new Array(values.length).fill(null);
  const lower: Maybe[] = new Array(values.length).fill(null);
  const percentB: Maybe[] = new Array(values.length).fill(null);
  const bandwidth: Maybe[] = new Array(values.length).fill(null);

  for (let i = 0; i < values.length; i += 1) {
    const center = middle[i];
    if (center === null) continue;
    const deviation = stdDevPopulation(values.slice(i - period + 1, i + 1));
    if (deviation === null) continue;
    const top = center + multiplier * deviation;
    const bottom = center - multiplier * deviation;
    upper[i] = top;
    lower[i] = bottom;
    percentB[i] = safeDiv(values[i] - bottom, top - bottom);
    bandwidth[i] = safeDiv(top - bottom, center);
  }

  return { middle, upper, lower, percentB, bandwidth };
}

/**
 * Average True Range, Wilder's 14-period definition.
 *
 * True range is `max(H - L, |H - C_prev|, |L - C_prev|)`, which accounts for
 * overnight gaps that a plain high-minus-low ignores. The first bar has no
 * previous close, so the series starts at index `period`.
 */
export function atr(bars: readonly Bar[], period = 14): Maybe[] {
  const out: Maybe[] = new Array(bars.length).fill(null);
  if (bars.length < period + 1) return out;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];
    const previousClose = bars[i - 1].close;
    trueRanges.push(
      Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose)),
    );
  }
  const smoothed = wilderSmooth(trueRanges, period);
  for (let i = 0; i < smoothed.length; i += 1) out[i + 1] = smoothed[i];
  return out;
}

/**
 * On-Balance Volume: a running total that adds the day's volume on an up close
 * and subtracts it on a down close. Unchanged closes contribute nothing. The
 * first bar seeds the total at 0, so only the shape of the line is meaningful,
 * not its level.
 */
export function obv(bars: readonly Bar[]): Maybe[] {
  if (bars.length === 0) return [];
  const out: Maybe[] = [0];
  let running = 0;
  for (let i = 1; i < bars.length; i += 1) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) running += bars[i].volume;
    else if (change < 0) running -= bars[i].volume;
    out.push(running);
  }
  return out;
}

/**
 * Finds the most recent crossover between a fast and a slow moving average.
 *
 * A golden cross is the fast average moving from at or below the slow average
 * to strictly above it; a death cross is the reverse. Bars where either
 * average is still in warm-up are skipped. Returns `null` when no cross occurs
 * within the window, or when `lookback` bars have passed since the last one.
 */
export function lastCross(
  fast: readonly Maybe[],
  slow: readonly Maybe[],
  timestamps: readonly string[],
  fastPeriod: number,
  slowPeriod: number,
  lookback = 120,
): CrossEvent | null {
  const end = Math.min(fast.length, slow.length, timestamps.length);
  for (let i = end - 1; i > 0; i -= 1) {
    const currentFast = fast[i];
    const currentSlow = slow[i];
    const previousFast = fast[i - 1];
    const previousSlow = slow[i - 1];
    if (currentFast === null || currentSlow === null || previousFast === null || previousSlow === null) continue;
    const barsAgo = end - 1 - i;
    if (barsAgo > lookback) return null;
    if (previousFast <= previousSlow && currentFast > currentSlow) {
      return { kind: "golden", timestamp: timestamps[i], fastPeriod, slowPeriod, barsAgo };
    }
    if (previousFast >= previousSlow && currentFast < currentSlow) {
      return { kind: "death", timestamp: timestamps[i], fastPeriod, slowPeriod, barsAgo };
    }
  }
  return null;
}

/**
 * Rolling mean of volume over `period` bars, index-aligned with the bars.
 * Shares the SMA definition so "average volume" on a card and the volume
 * overlay on the chart can never disagree.
 */
export function volumeAverage(bars: readonly Bar[], period = 20): Maybe[] {
  return sma(bars.map((bar) => bar.volume), period);
}

/** Latest defined value of an indicator series, or `null` if it never warmed up. */
export function latest(series: readonly Maybe[]): Maybe {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i] !== null) return series[i];
  }
  return null;
}

/** Mean of the defined values in an indicator series. */
export function averageOf(series: readonly Maybe[]): Maybe {
  return mean(series.filter((value): value is number => value !== null));
}

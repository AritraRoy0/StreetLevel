/**
 * Shared fixtures for the analytics test suite.
 *
 * The suite runs on Node's built-in test runner with type stripping, so every
 * import inside `tests/` and `lib/analytics/` carries an explicit `.ts`
 * extension. That keeps the whole thing dependency-free.
 */

import type { Bar } from "../lib/analytics/types.ts";

/** Sequential UTC weekdays starting at `start`, skipping Saturday and Sunday. */
export function tradingDays(count: number, start = "2026-01-05"): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  while (out.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.push(cursor.toISOString());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Builds bars from a list of closes. Open, high and low are derived so the
 * bar is internally consistent and survives validation; volume is constant
 * unless overridden.
 */
export function barsFromCloses(
  values: readonly number[],
  options: { start?: string; volumes?: readonly number[]; spread?: number } = {},
): Bar[] {
  const { start = "2026-01-05", volumes, spread = 0.01 } = options;
  const days = tradingDays(values.length, start);
  return values.map((close, index) => {
    const previous = index === 0 ? close : values[index - 1];
    const open = previous;
    const high = Math.max(open, close) * (1 + spread);
    const low = Math.min(open, close) * (1 - spread);
    return {
      timestamp: days[index],
      open,
      high,
      low,
      close,
      adjClose: close,
      volume: volumes ? volumes[index] : 1_000_000,
    };
  });
}

/** Bars on explicit calendar days, for trading-calendar alignment tests. */
export function barsOnDays(entries: readonly [day: string, close: number][]): Bar[] {
  return entries.map(([day, close]) => ({
    timestamp: `${day}T00:00:00.000Z`,
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    adjClose: close,
    volume: 1_000_000,
  }));
}

/** Deterministic pseudo-random walk, so tests never flake. */
export function randomWalk(count: number, seed = 42, startPrice = 100): number[] {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const out: number[] = [startPrice];
  for (let i = 1; i < count; i += 1) {
    out.push(Math.max(1, out[i - 1] * (1 + (next() - 0.5) * 0.04)));
  }
  return out;
}

/** Asserts two numbers agree to `digits` decimal places. */
export function closeTo(actual: number | null, expected: number, digits = 6): boolean {
  if (actual === null || !Number.isFinite(actual)) return false;
  return Math.abs(actual - expected) < 0.5 * 10 ** -digits;
}

/**
 * An independent, deliberately naive transcription of Wilder's RSI.
 *
 * This exists so the suite checks the production implementation against a
 * second implementation written from the formula rather than against its own
 * output. It is intentionally not optimized and not shared with `lib/`.
 */
export function referenceRsi(closes: readonly number[], period = 14): Array<number | null> {
  const out: Array<number | null> = closes.map(() => null);
  if (closes.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0 && avgGain === 0) out[i] = 50;
    else if (avgLoss === 0) out[i] = 100;
    else if (avgGain === 0) out[i] = 0;
    else out[i] = 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** Independent transcription of the EMA recurrence, seeded with an SMA. */
export function referenceEma(values: readonly number[], period: number): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i += 1) seed += values[i];
  let current = seed / period;
  out[period - 1] = current;
  for (let i = period; i < values.length; i += 1) {
    current = (values[i] - current) * k + current;
    out[i] = current;
  }
  return out;
}

/**
 * Wilder's published worked example for RSI(14), the dataset reproduced in
 * every standard reference for the indicator. Used as an external check that
 * the implementation matches the literature, not just itself.
 */
export const WILDER_CLOSES = [
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433,
  46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282, 46.0028, 46.0328, 46.4116,
  46.2222, 45.6439, 46.2122, 46.2521, 45.7137, 46.4515, 45.7835, 45.3548, 44.0288,
  44.1783, 44.2181, 44.5672, 43.4205, 42.6628, 43.1314,
];

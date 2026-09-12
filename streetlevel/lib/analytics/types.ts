/**
 * Shared types for the StreetLevel analytics engine.
 *
 * Everything in `lib/analytics` is pure: functions take plain data in and
 * return plain data out. No network access, no React, no Date.now() except
 * where explicitly documented (staleness checks).
 *
 * Null contract
 * -------------
 * Every metric returns `null` rather than `NaN`, `Infinity`, or a silently
 * wrong number when it cannot be computed. Callers render `null` as an em
 * dash. `NaN` must never escape this module.
 */

/** A single normalized OHLCV bar. Timestamps are ISO-8601 UTC. */
export interface Bar {
  /** ISO-8601 UTC instant for the start of the bar, e.g. `2026-09-01T00:00:00.000Z`. */
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /**
   * Split- and dividend-adjusted close. Return, volatility, drawdown and
   * moving-average math uses this field; OHLC candles are drawn from the raw
   * fields so the candles match what a trader saw on the day.
   * Falls back to `close` when the provider does not supply it.
   */
  adjClose: number;
  volume: number;
}

export type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w" | "1mo";

/** Every interval the type allows, in ascending order of bar length. */
export const INTERVALS: Interval[] = ["1m", "5m", "15m", "30m", "1h", "1d", "1w", "1mo"];

export const INTERVAL_LABELS: Record<Interval, string> = {
  "1m": "1 min",
  "5m": "5 min",
  "15m": "15 min",
  "30m": "30 min",
  "1h": "1 hour",
  "1d": "Daily",
  "1w": "Weekly",
  "1mo": "Monthly",
};

export type RangeKey = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

/** Number of bars in a calendar year, used to annualize volatility and returns. */
export const PERIODS_PER_YEAR: Record<Interval, number> = {
  "1m": 252 * 390,
  "5m": 252 * 78,
  "15m": 252 * 26,
  "30m": 252 * 13,
  "1h": 252 * 7,
  "1d": 252,
  "1w": 52,
  "1mo": 12,
};

/** Mean number of calendar days in a year, used for CAGR. */
export const DAYS_PER_YEAR = 365.25;

/** A value that may be unavailable. */
export type Maybe = number | null;

export interface DatedValue {
  timestamp: string;
  value: Maybe;
}

export interface Extreme {
  value: Maybe;
  timestamp: string | null;
}

export interface DrawdownResult {
  /** Drawdown at each bar as a fraction, 0 at a new high, negative below it. */
  series: DatedValue[];
  /** Most negative value of `series`, as a fraction. `null` for empty input. */
  maxDrawdown: Maybe;
  /** Bar that set the peak preceding the worst trough. */
  peakTimestamp: string | null;
  /** Bar at the worst trough. */
  troughTimestamp: string | null;
  /** First bar at or above the prior peak after the trough, or `null` if never recovered. */
  recoveryTimestamp: string | null;
  /** Calendar days from peak to trough, or `null`. */
  drawdownDays: Maybe;
  /** Calendar days from trough back to the peak level, or `null` if not recovered. */
  recoveryDays: Maybe;
  /** Drawdown of the final bar, as a fraction. */
  currentDrawdown: Maybe;
}

export interface VolatilityResult {
  /** Annualized standard deviation of periodic returns, as a fraction. */
  annualized: Maybe;
  /** Non-annualized standard deviation of periodic returns, as a fraction. */
  periodic: Maybe;
  /** Number of returns the estimate is based on (bars - 1). */
  observations: number;
  /** False when `observations` is below `MIN_VOLATILITY_OBSERVATIONS`. */
  sufficient: boolean;
}

export interface PeriodReturn {
  /** Label for the period, e.g. `2026-W12` or `2026-03`. */
  key: string;
  /** ISO timestamp of the last bar in the period. */
  timestamp: string;
  /** Simple return across the period, as a fraction. */
  value: number;
}

export interface MovingAverageSummary {
  label: string;
  kind: "SMA" | "EMA";
  period: number;
  /** Latest value of the average, or `null` when history is too short. */
  value: Maybe;
  /** `(price / ma) - 1`, as a fraction. */
  priceVsMa: Maybe;
  /** Whether the latest close sits above the average. */
  above: boolean | null;
  /** Bars available vs bars required, for the insufficient-history message. */
  available: number;
  required: number;
}

export interface CrossEvent {
  kind: "golden" | "death";
  timestamp: string;
  fastPeriod: number;
  slowPeriod: number;
  /** Bars since the cross, 0 meaning it happened on the latest bar. */
  barsAgo: number;
}

export interface DataQuality {
  /** Bars accepted after validation. */
  pointCount: number;
  /** Bars dropped because a field was missing, non-finite, negative or inconsistent. */
  rejected: number;
  /** Duplicate timestamps collapsed to the last occurrence. */
  duplicates: number;
  /** Bars that were out of chronological order before sorting. */
  reordered: number;
  /** Trading days (Mon-Fri) with no bar inside the covered window. */
  missingSessions: number;
  /** ISO timestamp of the newest bar, or `null`. */
  lastBar: string | null;
  /** Weekdays between the newest bar and `asOf`. */
  staleWeekdays: Maybe;
  /** True when `staleWeekdays` exceeds `MAX_FRESH_WEEKDAYS`. */
  stale: boolean;
  /** Human-readable notes for the UI. */
  warnings: string[];
}

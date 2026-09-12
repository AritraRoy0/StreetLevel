/**
 * Series hygiene: validating provider payloads, resolving ranges, resampling
 * intervals, and aligning two assets that may not share a trading calendar.
 *
 * Time handling
 * -------------
 * Every timestamp in this module is ISO-8601 UTC. Daily bars are keyed by
 * their UTC calendar day (`2026-09-01`). The charts plot bars by array index
 * rather than by elapsed time, which is what makes weekends and market
 * holidays disappear from the x-axis instead of leaving dead space.
 */

import { MAX_FRESH_WEEKDAYS, isNum, toNum } from "./math.ts";
import type { Bar, DataQuality, Interval, RangeKey } from "./types.ts";

const MS_PER_DAY = 86_400_000;

/** The UTC calendar day of a timestamp, as `YYYY-MM-DD`. */
export function dayKey(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** True for Saturday and Sunday in UTC. Market holidays are not covered. */
export function isWeekend(timestamp: string | Date): boolean {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Counts weekdays strictly after `from` and up to and including `to`.
 * Used to measure staleness in sessions rather than in raw elapsed days, so a
 * Friday close read on a Sunday is not reported as two days stale.
 */
export function weekdaysBetween(from: string | Date, to: string | Date): number | null {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor < last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) count += 1;
  }
  return count;
}

/** Whole calendar days between two timestamps, fractional part kept. */
export function daysBetween(from: string | Date, to: string | Date): number | null {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return (end.getTime() - start.getTime()) / MS_PER_DAY;
}

/**
 * Accepts one raw provider row and returns a `Bar`, or `null` if the row is
 * unusable. A row is rejected when any price is missing, non-finite or not
 * strictly positive, when volume is negative, or when the high/low bounds are
 * inconsistent with the open/close. Rejecting here is what stops a single bad
 * row from turning an entire metric into `NaN`.
 */
export function toBar(raw: unknown): Bar | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const rawTimestamp = row.timestamp ?? row.date ?? row.time;
  if (typeof rawTimestamp !== "string" && !(rawTimestamp instanceof Date)) return null;
  const date = rawTimestamp instanceof Date ? rawTimestamp : new Date(
    // Bare `YYYY-MM-DD` is parsed as UTC midnight by spec; keep that explicit.
    /^\d{4}-\d{2}-\d{2}$/.test(rawTimestamp) ? `${rawTimestamp}T00:00:00.000Z` : rawTimestamp,
  );
  if (Number.isNaN(date.getTime())) return null;

  const open = toNum(row.open);
  const high = toNum(row.high);
  const low = toNum(row.low);
  const close = toNum(row.close ?? row.price);
  const volume = toNum(row.volume) ?? 0;
  const adjCandidate = toNum(row.adjClose ?? row.adjustedClose);

  if (open === null || high === null || low === null || close === null) return null;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return null;
  if (!isNum(volume) || volume < 0) return null;
  if (low > high) return null;
  // Open and close must sit inside the day's range; a violation means the feed
  // mixed adjusted and unadjusted fields, which corrupts candles silently.
  const tolerance = high * 1e-6;
  if (open < low - tolerance || open > high + tolerance) return null;
  if (close < low - tolerance || close > high + tolerance) return null;

  const adjClose = adjCandidate !== null && adjCandidate > 0 ? adjCandidate : close;

  return {
    timestamp: date.toISOString(),
    open,
    high,
    low,
    close,
    adjClose,
    volume,
  };
}

export interface NormalizeResult {
  bars: Bar[];
  quality: Omit<DataQuality, "staleWeekdays" | "stale" | "warnings"> & {
    staleWeekdays: number | null;
    stale: boolean;
    warnings: string[];
  };
}

/**
 * Validates, de-duplicates and sorts a raw provider payload.
 *
 * Duplicate timestamps keep the last occurrence, matching how providers issue
 * corrections. Rows arriving out of order are sorted ascending and counted.
 * `asOf` defaults to the current time and is only used for the staleness check.
 */
export function normalizeBars(raw: unknown, asOf: Date = new Date()): NormalizeResult {
  const rows = Array.isArray(raw) ? raw : [];
  const byKey = new Map<string, Bar>();
  let rejected = 0;
  let duplicates = 0;
  let reordered = 0;
  let previous = -Infinity;

  for (const row of rows) {
    const bar = toBar(row);
    if (!bar) {
      rejected += 1;
      continue;
    }
    const time = new Date(bar.timestamp).getTime();
    if (time < previous) reordered += 1;
    previous = time;
    if (byKey.has(bar.timestamp)) duplicates += 1;
    byKey.set(bar.timestamp, bar);
  }

  const bars = Array.from(byKey.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const lastBar = bars.length > 0 ? bars[bars.length - 1].timestamp : null;
  const staleWeekdays = lastBar ? weekdaysBetween(lastBar, asOf) : null;
  const stale = staleWeekdays !== null && staleWeekdays > MAX_FRESH_WEEKDAYS;

  let missingSessions = 0;
  if (bars.length > 1) {
    const covered = new Set(bars.map((bar) => dayKey(bar.timestamp)));
    const cursor = new Date(bars[0].timestamp);
    const end = new Date(bars[bars.length - 1].timestamp);
    while (cursor <= end) {
      if (!isWeekend(cursor) && !covered.has(dayKey(cursor))) missingSessions += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const warnings: string[] = [];
  if (rejected > 0) warnings.push(`${rejected} malformed ${rejected === 1 ? "bar" : "bars"} discarded.`);
  if (duplicates > 0) warnings.push(`${duplicates} duplicate ${duplicates === 1 ? "timestamp" : "timestamps"} collapsed.`);
  if (reordered > 0) warnings.push("Provider returned bars out of order; series re-sorted.");
  if (missingSessions > 0) warnings.push(`${missingSessions} weekday ${missingSessions === 1 ? "session is" : "sessions are"} missing from the window.`);
  if (stale && staleWeekdays !== null) warnings.push(`Latest bar is ${staleWeekdays} trading ${staleWeekdays === 1 ? "day" : "days"} old.`);
  if (bars.length === 0) warnings.push("No usable price history for this symbol.");

  return {
    bars,
    quality: {
      pointCount: bars.length,
      rejected,
      duplicates,
      reordered,
      missingSessions,
      lastBar,
      staleWeekdays,
      stale,
      warnings,
    },
  };
}

/** Subtracts months in UTC, clamping the day so 31 Mar minus 1 month is 28/29 Feb. */
function subtractMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month - months, 1));
  const lastDayOfTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTarget));
  target.setUTCHours(date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
  return target;
}

export const RANGE_KEYS: RangeKey[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];

export const RANGE_LABELS: Record<RangeKey, string> = {
  "1D": "1D",
  "1W": "1W",
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  YTD: "YTD",
  "1Y": "1Y",
  "5Y": "5Y",
  MAX: "Max",
};

export const RANGE_DESCRIPTIONS: Record<RangeKey, string> = {
  "1D": "Latest session",
  "1W": "Past week",
  "1M": "Past month",
  "3M": "Past three months",
  "6M": "Past six months",
  YTD: "Year to date",
  "1Y": "Past year",
  "5Y": "Past five years",
  MAX: "Full history",
};

export interface ResolvedRange {
  key: RangeKey;
  /** Inclusive lower bound actually applied after clamping to the data. */
  start: string;
  /** Inclusive upper bound, the newest bar in the dataset. */
  end: string;
  /** What the range key asked for before clamping. */
  requestedStart: string;
  /**
   * True when the window is materially shorter than the range asked for.
   *
   * Not simply "the data starts later than requested": a one-year request
   * against exactly one year of daily bars begins a day or two late, because
   * the first session of the window is not the calendar anniversary. Flagging
   * that would put a warning on a complete chart, so the shortfall has to
   * exceed `TRUNCATION_TOLERANCE` of the requested span before it counts.
   */
  truncated: boolean;
  /** Fraction of the requested calendar span the window actually covers. */
  coverage: number;
  bars: Bar[];
}

/** A window covering at least this fraction of the requested span is not truncated. */
export const TRUNCATION_TOLERANCE = 0.97;

/**
 * Slices `bars` to a named range.
 *
 * The window is anchored on the newest bar in the dataset, not on wall-clock
 * time. Anchoring on `Date.now()` would return an empty chart whenever the
 * feed is a few days behind, which is exactly when a user most wants to look.
 * Staleness is reported separately by `normalizeBars`.
 *
 * When a range resolves to fewer than two bars the window is widened to the
 * last two bars, because a single point cannot express a change and a
 * one-point chart is not worth drawing. Daily data with a `1D` range always
 * hits this path.
 */
export function resolveRange(bars: readonly Bar[], key: RangeKey): ResolvedRange | null {
  if (bars.length === 0) return null;
  const first = bars[0];
  const anchor = new Date(bars[bars.length - 1].timestamp);

  let requested: Date;
  switch (key) {
    case "1D":
      requested = new Date(anchor.getTime() - MS_PER_DAY);
      break;
    case "1W":
      requested = new Date(anchor.getTime() - 7 * MS_PER_DAY);
      break;
    case "1M":
      requested = subtractMonths(anchor, 1);
      break;
    case "3M":
      requested = subtractMonths(anchor, 3);
      break;
    case "6M":
      requested = subtractMonths(anchor, 6);
      break;
    case "YTD":
      requested = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1));
      break;
    case "1Y":
      requested = subtractMonths(anchor, 12);
      break;
    case "5Y":
      requested = subtractMonths(anchor, 60);
      break;
    case "MAX":
    default:
      requested = new Date(first.timestamp);
      break;
  }

  const requestedTime = requested.getTime();
  let selected = bars.filter((bar) => new Date(bar.timestamp).getTime() >= requestedTime);
  if (selected.length < 2) selected = bars.slice(-2);

  const anchorTime = anchor.getTime();
  const requestedSpan = anchorTime - requestedTime;
  const actualSpan = anchorTime - new Date(selected[0].timestamp).getTime();
  const coverage = requestedSpan > 0 ? Math.min(1, actualSpan / requestedSpan) : 1;

  return {
    key,
    start: selected[0].timestamp,
    end: selected[selected.length - 1].timestamp,
    requestedStart: requested.toISOString(),
    truncated: coverage < TRUNCATION_TOLERANCE,
    coverage,
    bars: selected,
  };
}

/** Inclusive slice by explicit ISO bounds. Invalid bounds yield an empty array. */
export function sliceByDate(bars: readonly Bar[], start: string | Date, end: string | Date): Bar[] {
  const from = start instanceof Date ? start : new Date(start);
  const to = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  return bars.filter((bar) => {
    const time = new Date(bar.timestamp).getTime();
    return time >= from.getTime() && time <= to.getTime();
  });
}

/** ISO-8601 week key, `2026-W12`. Weeks start Monday and belong to the year of their Thursday. */
export function isoWeekKey(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to the Thursday of the current week; ISO weeks are numbered by it.
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Calendar month key, `2026-03`. */
export function monthKey(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aggregates daily bars into weekly or monthly bars.
 *
 * Open is the first open of the bucket, close the last close, high and low the
 * extremes, volume the sum, and the timestamp is the bucket's **last** bar so
 * a partial final week or month plots at the date it actually covers.
 * Intervals finer than `1d` cannot be produced from daily input and are
 * returned unchanged.
 */
export function resample(bars: readonly Bar[], interval: Interval): Bar[] {
  if (interval !== "1w" && interval !== "1mo") return bars.slice();
  const keyFor = interval === "1w" ? isoWeekKey : monthKey;
  const buckets = new Map<string, Bar[]>();
  for (const bar of bars) {
    const key = keyFor(bar.timestamp);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(bar);
    else buckets.set(key, [bar]);
  }
  return Array.from(buckets.values()).map((bucket) => {
    const last = bucket[bucket.length - 1];
    return {
      timestamp: last.timestamp,
      open: bucket[0].open,
      high: Math.max(...bucket.map((bar) => bar.high)),
      low: Math.min(...bucket.map((bar) => bar.low)),
      close: last.close,
      adjClose: last.adjClose,
      volume: bucket.reduce((total, bar) => total + bar.volume, 0),
    };
  });
}

export interface AlignedPair {
  timestamps: string[];
  left: Bar[];
  right: Bar[];
  /** Bars dropped from either side because the other had no bar that day. */
  dropped: number;
}

/**
 * Inner-joins two series on UTC calendar day.
 *
 * Two assets can differ in listing date, exchange holidays and halts. Aligning
 * on the intersection is the only safe basis for correlation, beta or a
 * normalized comparison chart: a positional zip would silently pair Monday's
 * close for one asset with Tuesday's for the other. Days missing on either
 * side are dropped and counted rather than forward-filled, because carrying a
 * stale price forward manufactures a zero return and biases correlation up.
 */
export function alignSeries(left: readonly Bar[], right: readonly Bar[]): AlignedPair {
  const rightByDay = new Map(right.map((bar) => [dayKey(bar.timestamp), bar]));
  const timestamps: string[] = [];
  const leftOut: Bar[] = [];
  const rightOut: Bar[] = [];
  let matched = 0;

  for (const bar of left) {
    const counterpart = rightByDay.get(dayKey(bar.timestamp));
    if (!counterpart) continue;
    matched += 1;
    timestamps.push(bar.timestamp);
    leftOut.push(bar);
    rightOut.push(counterpart);
  }

  return {
    timestamps,
    left: leftOut,
    right: rightOut,
    dropped: left.length + right.length - 2 * matched,
  };
}

/**
 * Builds an equal-weight composite index from several symbols' bars.
 *
 * Each constituent is rebased to 100 at the first day on which **every**
 * constituent has a bar, then the composite is the arithmetic mean of the
 * rebased levels. This gives a benchmark that can be charted and compared even
 * though no index series ships with the dataset. Volume is summed; open, high
 * and low are derived from the same rebasing so candle rendering stays valid.
 */
export function buildCompositeIndex(seriesList: readonly (readonly Bar[])[]): Bar[] {
  const usable = seriesList.filter((series) => series.length > 0);
  if (usable.length === 0) return [];

  let commonDays = new Set(usable[0].map((bar) => dayKey(bar.timestamp)));
  for (let i = 1; i < usable.length; i += 1) {
    const present = new Set(usable[i].map((bar) => dayKey(bar.timestamp)));
    commonDays = new Set(Array.from(commonDays).filter((day) => present.has(day)));
  }
  const days = Array.from(commonDays).sort();
  if (days.length === 0) return [];

  const lookups = usable.map((series) => new Map(series.map((bar) => [dayKey(bar.timestamp), bar])));
  const bases = lookups.map((lookup) => lookup.get(days[0]));
  if (bases.some((bar) => !bar || bar.adjClose <= 0)) return [];

  return days.map((day) => {
    const scaled = lookups.map((lookup, index) => {
      const bar = lookup.get(day)!;
      const base = bases[index]!;
      const factor = 100 / base.adjClose;
      return {
        open: (bar.open / base.close) * 100,
        high: (bar.high / base.close) * 100,
        low: (bar.low / base.close) * 100,
        close: (bar.close / base.close) * 100,
        adjClose: bar.adjClose * factor,
        volume: bar.volume,
      };
    });
    const average = (pick: (item: (typeof scaled)[number]) => number) =>
      scaled.reduce((total, item) => total + pick(item), 0) / scaled.length;
    return {
      timestamp: `${day}T00:00:00.000Z`,
      open: average((item) => item.open),
      high: average((item) => item.high),
      low: average((item) => item.low),
      close: average((item) => item.close),
      adjClose: average((item) => item.adjClose),
      volume: scaled.reduce((total, item) => total + item.volume, 0),
    };
  });
}

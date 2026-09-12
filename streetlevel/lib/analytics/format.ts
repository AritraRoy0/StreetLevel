/**
 * Presentation formatting.
 *
 * This is the only place rounding happens. Every metric arrives here at full
 * double precision and leaves as a string. Two rules make the page readable:
 *
 * 1. An unavailable value always renders as an em dash, never as "0", "NaN",
 *    "null" or "-". One placeholder means a reader can scan a column and see
 *    instantly which cells have data.
 * 2. Returns arrive as fractions and are multiplied by 100 exactly once, here.
 */

import { isNum, round } from "./math.ts";

/** Rendered in place of any value that could not be computed. */
export const EMPTY = "—";

const FIXED_UTC: Intl.DateTimeFormatOptions = { timeZone: "UTC" };

/**
 * Currency. Prices below $1 keep four decimals because two would collapse
 * distinct quotes onto the same string.
 */
export function formatPrice(value: number | null | undefined, currency = "USD"): string {
  if (!isNum(value)) return EMPTY;
  const digits = Math.abs(value) < 1 && value !== 0 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Signed currency delta, e.g. `+$1.24` or `-$0.98`.
 *
 * Always two decimals, unlike `formatPrice`. A price *level* below a dollar
 * needs four decimals to stay distinct, but a *change* of 98 cents is 98 cents
 * and rendering it as `$0.9800` only adds noise.
 */
export function formatPriceChange(value: number | null | undefined, currency = "USD"): string {
  if (!isNum(value)) return EMPTY;
  const rendered = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  if (value > 0) return `+${rendered}`;
  if (value < 0) return `-${rendered}`;
  return rendered;
}

/**
 * A fraction rendered as a percentage. `0.0512` becomes `5.12%`.
 * Pass `signed` to prefix a `+` on positive values, which is what every
 * performance figure on the site does.
 */
export function formatPercent(
  value: number | null | undefined,
  { digits = 2, signed = false }: { digits?: number; signed?: boolean } = {},
): string {
  if (!isNum(value)) return EMPTY;
  const scaled = round(value * 100, digits);
  if (scaled === null) return EMPTY;
  const rendered = scaled.toFixed(digits);
  return signed && scaled > 0 ? `+${rendered}%` : `${rendered}%`;
}

/** A value already expressed in percentage points, e.g. an RSI reading. */
export function formatPoints(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return EMPTY;
  const rounded = round(value, digits);
  return rounded === null ? EMPTY : rounded.toFixed(digits);
}

/** A plain ratio such as beta or Sharpe, to two decimals. */
export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return EMPTY;
  const rounded = round(value, digits);
  return rounded === null ? EMPTY : rounded.toFixed(digits);
}

const VOLUME_UNITS = [
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" },
  { threshold: 1e3, suffix: "K" },
];

/**
 * Share volume in compact notation: `65.4M`, `1.24B`.
 * Values under a thousand are printed whole, because `0.4K` helps nobody.
 */
export function formatVolume(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  const magnitude = Math.abs(value);
  for (const unit of VOLUME_UNITS) {
    if (magnitude >= unit.threshold) {
      const scaled = value / unit.threshold;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits)}${unit.suffix}`;
    }
  }
  return Math.round(value).toLocaleString("en-US");
}

/** Currency in compact notation, for market capitalisation. */
export function formatCompactCurrency(value: number | null | undefined, currency = "USD"): string {
  if (!isNum(value)) return EMPTY;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    // Currency style otherwise forces two decimals, giving "$815.40B".
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Whole number with thousands separators. */
export function formatCount(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  return Math.round(value).toLocaleString("en-US");
}

/** `Sep 1, 2026`. All dates on the site are rendered in UTC to match the data. */
export function formatDate(timestamp: string | null | undefined): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat("en-US", { ...FIXED_UTC, month: "short", day: "numeric", year: "numeric" }).format(date);
}

/** `Sep 1`, for dense axis labels where the year is implied by a neighbour. */
export function formatDayMonth(timestamp: string | null | undefined): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return new Intl.DateTimeFormat("en-US", { ...FIXED_UTC, month: "short", day: "numeric" }).format(date);
}

/** `Sep '26`, for multi-year axes. */
export function formatMonthYear(timestamp: string | null | undefined): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const month = new Intl.DateTimeFormat("en-US", { ...FIXED_UTC, month: "short" }).format(date);
  return `${month} '${String(date.getUTCFullYear()).slice(2)}`;
}

/** `Sep 1, 2026, 14:32 UTC`, for "last updated" lines. */
export function formatDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const formatted = new Intl.DateTimeFormat("en-US", {
    ...FIXED_UTC,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatted} UTC`;
}

/**
 * Coarse relative time, e.g. `12m ago`, `3h ago`, `2d ago`.
 * Anything older than 30 days falls back to an absolute date, because
 * "437d ago" is harder to read than the date itself.
 */
export function formatRelativeTime(timestamp: string | null | undefined, now: Date = new Date()): string {
  if (!timestamp) return EMPTY;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return formatDate(timestamp);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d ago`;
  return formatDate(timestamp);
}

/** Chooses a date formatter appropriate to how many days an axis spans. */
export function axisDateFormatter(spanDays: number): (timestamp: string) => string {
  if (spanDays > 730) return formatMonthYear;
  if (spanDays > 120) return formatMonthYear;
  return formatDayMonth;
}

/** `+` for positive, `-` for negative, empty for zero and unavailable values. */
export function signOf(value: number | null | undefined): "positive" | "negative" | "flat" | "none" {
  if (!isNum(value)) return "none";
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "flat";
}

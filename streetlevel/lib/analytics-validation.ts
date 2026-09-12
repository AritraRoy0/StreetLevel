/**
 * Request validation for the analytics API.
 *
 * Every value that reaches a route handler from the network is treated as
 * hostile until it has passed through here. Each failure carries a stable
 * machine code alongside a message written for a developer reading a response
 * body, so a client can branch on the code and show the message.
 */

// Relative, extension-qualified imports so this module is loadable both by the
// bundler and by Node's test runner under type stripping.
import { INTERVALS } from "./analytics/types.ts";
import { RANGE_KEYS } from "./analytics/series.ts";
import type { Interval, RangeKey } from "./analytics/types.ts";

export type AnalyticsErrorCode =
  | "INVALID_SYMBOL"
  | "INVALID_DATE"
  | "INVALID_RANGE"
  | "INVALID_INTERVAL"
  | "INVALID_PARAMETER"
  | "TOO_MANY_SYMBOLS"
  | "NOT_FOUND"
  | "UNAVAILABLE_INTERVAL"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR";

/** HTTP status for each error code, so routes never pick one ad hoc. */
export const ERROR_STATUS: Record<AnalyticsErrorCode, number> = {
  INVALID_SYMBOL: 400,
  INVALID_DATE: 400,
  INVALID_RANGE: 400,
  INVALID_INTERVAL: 400,
  INVALID_PARAMETER: 400,
  TOO_MANY_SYMBOLS: 400,
  NOT_FOUND: 404,
  UNAVAILABLE_INTERVAL: 422,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AnalyticsError extends Error {
  readonly code: AnalyticsErrorCode;
  /** Optional hint the UI can show verbatim as a recovery action. */
  readonly action?: string;

  constructor(code: AnalyticsErrorCode, message: string, action?: string) {
    super(message);
    this.name = "AnalyticsError";
    this.code = code;
    this.action = action;
  }
}

/** Maximum symbols accepted by the batch quote endpoint in one request. */
export const MAX_BATCH_SYMBOLS = 25;

/**
 * Which intervals the current data source can actually serve.
 *
 * The bundled dataset is daily, so weekly and monthly are produced by
 * aggregation and everything intraday is unavailable. Declaring this in one
 * table means the API and the UI's interval picker cannot disagree about what
 * is offered.
 */
export const INTERVAL_SUPPORT: Record<Interval, {
  available: boolean;
  derivedFrom: Interval | null;
  maxRangeDays: number;
  reason?: string;
}> = {
  "1m": { available: false, derivedFrom: null, maxRangeDays: 7, reason: "Intraday data is not part of the bundled dataset." },
  "5m": { available: false, derivedFrom: null, maxRangeDays: 30, reason: "Intraday data is not part of the bundled dataset." },
  "15m": { available: false, derivedFrom: null, maxRangeDays: 90, reason: "Intraday data is not part of the bundled dataset." },
  "30m": { available: false, derivedFrom: null, maxRangeDays: 180, reason: "Intraday data is not part of the bundled dataset." },
  "1h": { available: false, derivedFrom: null, maxRangeDays: 365, reason: "Intraday data is not part of the bundled dataset." },
  "1d": { available: true, derivedFrom: null, maxRangeDays: 3650 },
  "1w": { available: true, derivedFrom: "1d", maxRangeDays: 7300 },
  "1mo": { available: true, derivedFrom: "1d", maxRangeDays: 10_950 },
};

/**
 * Accepts 1 to 12 characters: a leading letter followed by letters, digits,
 * dots or hyphens. This covers ordinary tickers, class shares such as `BRK.B`
 * and exchange suffixes such as `SHOP.TO`, and rejects path traversal,
 * wildcards and injection payloads.
 */
export function validateSymbol(value: unknown): string {
  if (typeof value !== "string") {
    throw new AnalyticsError("INVALID_SYMBOL", "Symbol must be a string.");
  }
  const symbol = value.trim().toUpperCase();
  if (!symbol || symbol.length > 12 || !/^[A-Z][A-Z0-9.-]*$/.test(symbol)) {
    throw new AnalyticsError(
      "INVALID_SYMBOL",
      "Symbol must be 1 to 12 characters, start with a letter, and contain only letters, digits, dots or hyphens.",
    );
  }
  return symbol;
}

/** Parses a comma-separated symbol list, rejecting empty and oversized batches. */
export function validateSymbolList(value: string | null): string[] {
  if (!value || value.trim() === "") {
    throw new AnalyticsError("INVALID_SYMBOL", "The symbols parameter must contain at least one symbol.");
  }
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new AnalyticsError("INVALID_SYMBOL", "The symbols parameter must contain at least one symbol.");
  }
  if (parts.length > MAX_BATCH_SYMBOLS) {
    throw new AnalyticsError(
      "TOO_MANY_SYMBOLS",
      `Request at most ${MAX_BATCH_SYMBOLS} symbols at a time; received ${parts.length}.`,
      `Split the request into batches of ${MAX_BATCH_SYMBOLS}.`,
    );
  }
  const symbols = parts.map(validateSymbol);
  return Array.from(new Set(symbols));
}

/** Defaults to daily. Rejects anything outside the known interval set. */
export function validateInterval(value: string | null): Interval {
  const interval = (value ?? "1d") as Interval;
  if (!INTERVALS.includes(interval)) {
    throw new AnalyticsError(
      "INVALID_INTERVAL",
      `Unsupported interval "${value}". Valid values are ${INTERVALS.join(", ")}.`,
    );
  }
  return interval;
}

/** Rejects an interval the current data source cannot serve, with the reason. */
export function requireAvailableInterval(interval: Interval): Interval {
  const support = INTERVAL_SUPPORT[interval];
  if (!support.available) {
    throw new AnalyticsError(
      "UNAVAILABLE_INTERVAL",
      support.reason ?? `Interval ${interval} is not available from the current data source.`,
      "Use 1d, 1w or 1mo.",
    );
  }
  return interval;
}

/** Defaults to one year. Rejects anything outside the known range set. */
export function validateRange(value: string | null): RangeKey {
  const range = (value ?? "1Y") as RangeKey;
  if (!RANGE_KEYS.includes(range)) {
    throw new AnalyticsError(
      "INVALID_RANGE",
      `Unsupported range "${value}". Valid values are ${RANGE_KEYS.join(", ")}.`,
    );
  }
  return range;
}

/**
 * Requires a full ISO-8601 UTC timestamp rather than accepting anything
 * `new Date()` will swallow. `new Date("2026-02-31")` and
 * `new Date("tomorrow")` both produce values that silently skew a window.
 */
export function validateDate(value: string, name: "start" | "end"): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new AnalyticsError(
      "INVALID_DATE",
      `Parameter "${name}" must be an ISO-8601 UTC timestamp, for example 2026-01-01T00:00:00Z.`,
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AnalyticsError("INVALID_DATE", `Parameter "${name}" is not a real date.`);
  }
  // Round-trip check catches overflow dates such as 2026-02-31, which parse.
  if (!date.toISOString().startsWith(value.slice(0, 10))) {
    throw new AnalyticsError("INVALID_DATE", `Parameter "${name}" is not a real calendar date.`);
  }
  return date;
}

/**
 * Validates an explicit window: ordered, inside the interval's maximum span,
 * and not reaching implausibly far into the future.
 */
export function validateDateRange(startValue: string, endValue: string, interval: Interval, now: Date = new Date()) {
  const start = validateDate(startValue, "start");
  const end = validateDate(endValue, "end");
  if (start >= end) {
    throw new AnalyticsError("INVALID_RANGE", "Parameter \"start\" must be earlier than \"end\".");
  }
  const maxRangeMs = INTERVAL_SUPPORT[interval].maxRangeDays * 86_400_000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new AnalyticsError(
      "INVALID_RANGE",
      `The maximum window for interval ${interval} is ${INTERVAL_SUPPORT[interval].maxRangeDays} days.`,
      "Request a shorter window or a coarser interval.",
    );
  }
  if (end.getTime() > now.getTime() + 86_400_000) {
    throw new AnalyticsError("INVALID_RANGE", "Parameter \"end\" cannot be more than one day in the future.");
  }
  return { start, end };
}

/** Parses a bounded positive integer query parameter. */
export function validateLimit(value: string | null, fallback: number, max: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AnalyticsError("INVALID_PARAMETER", `Parameter "limit" must be an integer between 1 and ${max}.`);
  }
  return parsed;
}

/** Shape of every error body the API returns. */
export interface AnalyticsErrorBody {
  error: { code: AnalyticsErrorCode; message: string; action?: string };
}

/** Converts any thrown value into a status and a stable error body. */
export function toErrorResponse(error: unknown): { status: number; body: AnalyticsErrorBody } {
  if (error instanceof AnalyticsError) {
    return {
      status: ERROR_STATUS[error.code],
      body: { error: { code: error.code, message: error.message, ...(error.action ? { action: error.action } : {}) } },
    };
  }
  return {
    status: ERROR_STATUS.INTERNAL_ERROR,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to load analytics data.",
        action: "Retry in a few seconds. If the problem persists the market data source may be down.",
      },
    },
  };
}

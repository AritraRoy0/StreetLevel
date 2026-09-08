import type { AnalyticsInterval } from "./types";

export const INTERVAL_CONFIG: Record<AnalyticsInterval, {
  maxRangeDays: number;
  databaseAvailable: boolean;
  providerAvailable: boolean;
  aggregationRequired: boolean;
}> = {
  "1m": { maxRangeDays: 7, databaseAvailable: false, providerAvailable: false, aggregationRequired: false },
  "5m": { maxRangeDays: 30, databaseAvailable: false, providerAvailable: false, aggregationRequired: false },
  "15m": { maxRangeDays: 90, databaseAvailable: false, providerAvailable: false, aggregationRequired: false },
  "30m": { maxRangeDays: 180, databaseAvailable: false, providerAvailable: false, aggregationRequired: false },
  "1h": { maxRangeDays: 365, databaseAvailable: false, providerAvailable: false, aggregationRequired: false },
  "1d": { maxRangeDays: 3650, databaseAvailable: false, providerAvailable: true, aggregationRequired: false },
  "1w": { maxRangeDays: 7300, databaseAvailable: false, providerAvailable: false, aggregationRequired: true },
};

export class AnalyticsValidationError extends Error {
  constructor(public readonly code: "INVALID_SYMBOL" | "INVALID_DATE" | "INVALID_RANGE" | "INVALID_INTERVAL", message: string) {
    super(message);
  }
}

export function validateSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  if (!symbol || symbol.length > 12 || !/^[A-Z][A-Z0-9.-]*$/.test(symbol)) {
    throw new AnalyticsValidationError("INVALID_SYMBOL", "Symbol must contain 1-12 letters, numbers, dots, or hyphens.");
  }
  return symbol;
}

export function validateInterval(value: string | null): AnalyticsInterval {
  const interval = value ?? "1d";
  if (!Object.prototype.hasOwnProperty.call(INTERVAL_CONFIG, interval)) {
    throw new AnalyticsValidationError("INVALID_INTERVAL", `Unsupported interval: ${interval}.`);
  }
  return interval as AnalyticsInterval;
}

export function validateDate(value: string, name: "start" | "end") {
  const date = new Date(value);
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || Number.isNaN(date.getTime())) {
    throw new AnalyticsValidationError("INVALID_DATE", `${name} must be an ISO-8601 UTC timestamp.`);
  }
  return date;
}

export function validateDateRange(startValue: string, endValue: string, interval: AnalyticsInterval) {
  const start = validateDate(startValue, "start");
  const end = validateDate(endValue, "end");
  if (start >= end) {
    throw new AnalyticsValidationError("INVALID_RANGE", "start must be before end.");
  }
  const maxRangeMs = INTERVAL_CONFIG[interval].maxRangeDays * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    throw new AnalyticsValidationError("INVALID_RANGE", `The maximum range for ${interval} is ${INTERVAL_CONFIG[interval].maxRangeDays} days.`);
  }
  if (end.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new AnalyticsValidationError("INVALID_RANGE", "end cannot be more than one day in the future.");
  }
  return { start, end };
}
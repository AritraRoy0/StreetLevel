/**
 * The data-access boundary the API routes call.
 *
 * Routes never reach into the price book directly. Everything goes through
 * these functions, so validation, the "symbol exists" check and the
 * stale-data assessment happen in exactly one place.
 */

import {
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  getBars,
  getProfile,
  hasSymbol,
  SYMBOLS,
} from "./market-data";
import { buildSummary, resample, resolveRange, sliceByDate } from "@/lib/analytics";
import type { AnalyticsSummary, Bar, DataQuality, Interval, RangeKey } from "@/lib/analytics";
import { AnalyticsError, INTERVAL_SUPPORT } from "./analytics-validation";

export interface LatestQuote {
  symbol: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number;
  timestamp: string;
  timezone: "UTC";
  stale: boolean;
  staleWeekdays: number | null;
}

export interface HistoryPayload {
  symbol: string;
  interval: Interval;
  start: string;
  end: string;
  timezone: "UTC";
  data: Bar[];
  metadata: {
    source: string;
    derivedFrom: Interval | null;
    pointCount: number;
    truncated: boolean;
    quality: DataQuality;
  };
}

/** Throws a 404-shaped error when the symbol is not covered. */
export function requireSymbol(symbol: string): string {
  if (!hasSymbol(symbol)) {
    throw new AnalyticsError(
      "NOT_FOUND",
      `No coverage for symbol ${symbol}.`,
      `Covered symbols are ${SYMBOLS.join(", ")} and the ${COMPOSITE_SYMBOL} composite.`,
    );
  }
  return symbol;
}

/** Validated bars for a symbol, throwing when the series is empty. */
export function requireBars(symbol: string): Bar[] {
  const bars = getBars(requireSymbol(symbol));
  if (bars.length === 0) {
    throw new AnalyticsError(
      "UPSTREAM_UNAVAILABLE",
      `Price history for ${symbol} is empty or failed validation.`,
      "Check the market-data source and retry.",
    );
  }
  return bars;
}

export function qualityFor(symbol: string): DataQuality {
  return (
    DATA_QUALITY[symbol] ?? {
      pointCount: getBars(symbol).length,
      rejected: 0,
      duplicates: 0,
      reordered: 0,
      missingSessions: 0,
      lastBar: getBars(symbol).at(-1)?.timestamp ?? null,
      staleWeekdays: null,
      stale: false,
      warnings: [],
    }
  );
}

/** History for an explicit window, or for a named range when no window is given. */
export function getHistory(
  symbol: string,
  options: { interval: Interval; start?: Date; end?: Date; range?: RangeKey },
): HistoryPayload {
  const bars = requireBars(symbol);
  const support = INTERVAL_SUPPORT[options.interval];
  const resampled = resample(bars, options.interval);

  let selected: Bar[];
  let truncated = false;
  if (options.start && options.end) {
    selected = sliceByDate(resampled, options.start, options.end);
    truncated = selected.length > 0 && new Date(resampled[0].timestamp) > options.start;
  } else {
    const resolved = resolveRange(resampled, options.range ?? "1Y");
    selected = resolved?.bars ?? [];
    truncated = resolved?.truncated ?? false;
  }

  return {
    symbol,
    interval: options.interval,
    start: selected[0]?.timestamp ?? resampled[0].timestamp,
    end: selected[selected.length - 1]?.timestamp ?? resampled[resampled.length - 1].timestamp,
    timezone: "UTC",
    data: selected,
    metadata: {
      source: DATASET.source,
      derivedFrom: support.derivedFrom,
      pointCount: selected.length,
      truncated,
      quality: qualityFor(symbol),
    },
  };
}

/** The most recent bar, expressed as a quote with its one-session change. */
export function getQuote(symbol: string): LatestQuote {
  const bars = requireBars(symbol);
  const latest = bars[bars.length - 1];
  const previous = bars.length > 1 ? bars[bars.length - 2] : null;
  const quality = qualityFor(symbol);
  const change = previous ? latest.close - previous.close : null;
  const changePercent = previous && previous.close > 0 ? latest.close / previous.close - 1 : null;

  return {
    symbol,
    name: getProfile(symbol).name,
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    previousClose: previous?.close ?? null,
    change,
    changePercent,
    volume: latest.volume,
    timestamp: latest.timestamp,
    timezone: "UTC",
    stale: quality.stale,
    staleWeekdays: quality.staleWeekdays,
  };
}

/** A full analytics snapshot, the same object the page renders from. */
export function getSummary(symbol: string, range: RangeKey, interval: Interval): AnalyticsSummary {
  return buildSummary(symbol, requireBars(symbol), { range, interval });
}

/** Earliest and latest bar available for a symbol. */
export function getDatasetBounds(symbol: string): { start: string | null; end: string | null } {
  const bars = getBars(symbol);
  return { start: bars[0]?.timestamp ?? null, end: bars[bars.length - 1]?.timestamp ?? null };
}

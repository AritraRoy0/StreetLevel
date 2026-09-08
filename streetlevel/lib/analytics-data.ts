import { HISTORICAL_PRICES } from "./market-data";
import type { HistoricalDataPoint, LatestQuote } from "./types";

type RawPrice = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function toTimestamp(date: string) {
  return `${date}T00:00:00.000Z`;
}

function rowsFor(symbol: string) {
  return (HISTORICAL_PRICES[symbol] ?? []) as RawPrice[];
}

export function getHistoricalRows(symbol: string, start: Date, end: Date): HistoricalDataPoint[] {
  return rowsFor(symbol)
    .map((row) => ({ ...row, timestamp: toTimestamp(row.date) }))
    .filter((row) => {
      const timestamp = new Date(row.timestamp).getTime();
      return timestamp >= start.getTime() && timestamp <= end.getTime();
    })
    .map(({ timestamp, open, high, low, close, volume }) => ({ timestamp, open, high, low, close, volume }));
}

export function getLatestQuote(symbol: string): LatestQuote | null {
  const rows = rowsFor(symbol);
  const latest = rows.at(-1);
  if (!latest) return null;
  const previous = rows.at(-2);
  return {
    symbol,
    price: latest.close,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    previousClose: previous?.close,
    volume: latest.volume,
    timestamp: toTimestamp(latest.date),
    timezone: "UTC",
  };
}

export function hasSymbol(symbol: string) {
  return Object.prototype.hasOwnProperty.call(HISTORICAL_PRICES, symbol);
}

export function getDatasetBounds(symbol: string) {
  const rows = rowsFor(symbol);
  return {
    start: rows[0] ? new Date(toTimestamp(rows[0].date)) : null,
    end: rows.at(-1) ? new Date(toTimestamp(rows.at(-1)!.date)) : null,
  };
}
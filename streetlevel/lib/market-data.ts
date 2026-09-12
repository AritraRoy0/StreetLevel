/**
 * The market-data access layer.
 *
 * The bundled dataset is a daily Yahoo Finance download checked into
 * `lib/data/historical-prices.json`. Everything the app renders flows through
 * `normalizeBars` first, so a malformed row in the file is treated exactly the
 * way a malformed row from a live provider would be: rejected, counted, and
 * reported in the data-quality banner rather than allowed to poison a metric.
 *
 * Swapping the file for a live provider means replacing `loadRawSymbols` and
 * nothing else.
 */

import historicalPrices from "./data/historical-prices.json";
import { buildCompositeIndex, buildSummary, normalizeBars } from "@/lib/analytics";
import type { AnalyticsSummary, Bar, DataQuality } from "@/lib/analytics";

interface RawPriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
}

interface PriceFile {
  source: string;
  downloadedAt: string;
  interval: string;
  from: string;
  to: string;
  symbols: Record<string, RawPriceRow[]>;
}

export interface SymbolProfile {
  symbol: string;
  name: string;
  sector: string;
  /** Market capitalisation in USD. */
  marketCap: number;
  peRatio: number;
  description: string;
}

const priceFile = historicalPrices as PriceFile;

function loadRawSymbols(): Record<string, RawPriceRow[]> {
  return priceFile.symbols ?? {};
}

export const PROFILES: Record<string, SymbolProfile> = {
  NVDA: {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Semiconductors",
    marketCap: 3.16e12,
    peRatio: 74.2,
    description: "Designs the accelerators and networking that most large-scale AI training runs on.",
  },
  AAPL: {
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Consumer Electronics",
    marketCap: 3.52e12,
    peRatio: 34.5,
    description: "Hardware, silicon and a services business with recurring, high-margin revenue.",
  },
  MSFT: {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    sector: "Software & Cloud",
    marketCap: 3.28e12,
    peRatio: 38.9,
    description: "Enterprise software and Azure, with AI capacity now the swing factor in growth.",
  },
  AMZN: {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    sector: "E-Commerce & Cloud",
    marketCap: 1.94e12,
    peRatio: 51.4,
    description: "Retail logistics at scale plus AWS, which carries most of the operating income.",
  },
  GOOGL: {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Internet & Services",
    marketCap: 2.22e12,
    peRatio: 27.8,
    description: "Search advertising funding cloud, YouTube and a large research portfolio.",
  },
  META: {
    symbol: "META",
    name: "Meta Platforms, Inc.",
    sector: "Internet & Services",
    marketCap: 1.54e12,
    peRatio: 28.1,
    description: "Social advertising with heavy reinvestment into ranking models and compute.",
  },
  TSLA: {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    sector: "Automotive & Clean Energy",
    marketCap: 8.154e11,
    peRatio: 92.1,
    description: "Vehicle manufacturing and energy storage, valued largely on future autonomy.",
  },
  AVGO: {
    symbol: "AVGO",
    name: "Broadcom Inc.",
    sector: "Semiconductors",
    marketCap: 7.62e11,
    peRatio: 42.1,
    description: "Custom silicon and infrastructure software, levered to hyperscaler capital spending.",
  },
  AMD: {
    symbol: "AMD",
    name: "Advanced Micro Devices, Inc.",
    sector: "Semiconductors",
    marketCap: 2.492e11,
    peRatio: 115.4,
    description: "CPU and GPU designer competing for data-centre accelerator share.",
  },
  PLTR: {
    symbol: "PLTR",
    name: "Palantir Technologies Inc.",
    sector: "Software & AI",
    marketCap: 6.68e11,
    peRatio: 82,
    description: "Data integration and decision software sold to governments and large enterprises.",
  },
};

function profileFor(symbol: string): SymbolProfile {
  return (
    PROFILES[symbol] ?? {
      symbol,
      name: symbol,
      sector: "Unclassified",
      marketCap: Number.NaN,
      peRatio: Number.NaN,
      description: "No profile on file for this symbol.",
    }
  );
}

const rawSymbols = loadRawSymbols();

const normalized = Object.fromEntries(
  Object.entries(rawSymbols).map(([symbol, rows]) => [symbol, normalizeBars(rows)]),
);

/** Validated bar history for every covered symbol. */
export const PRICE_BOOK: Record<string, Bar[]> = Object.fromEntries(
  Object.entries(normalized).map(([symbol, result]) => [symbol, result.bars]),
);

/** Validation outcome per symbol, surfaced in the data-quality banner. */
export const DATA_QUALITY: Record<string, DataQuality> = Object.fromEntries(
  Object.entries(normalized).map(([symbol, result]) => [symbol, result.quality]),
);

export const SYMBOLS: string[] = Object.keys(PRICE_BOOK).filter((symbol) => PRICE_BOOK[symbol].length > 0).sort();

export const SECTORS: string[] = Array.from(new Set(SYMBOLS.map((symbol) => profileFor(symbol).sector))).sort();

/**
 * An equal-weight composite of every covered name, rebased to 100 at the first
 * date all constituents trade.
 *
 * The dataset ships no index series, so this stands in as the house benchmark.
 * It is an honest equal-weight basket of the coverage list, not a proxy for
 * the S&P 500, and the UI labels it that way.
 */
export const COMPOSITE_SYMBOL = "SL10";

export const COMPOSITE_BARS: Bar[] = buildCompositeIndex(SYMBOLS.map((symbol) => PRICE_BOOK[symbol]));

export const BENCHMARKS: Array<{ symbol: string; label: string; description: string }> = [
  { symbol: COMPOSITE_SYMBOL, label: "SL10 composite", description: "Equal-weight basket of all ten covered names" },
  ...SYMBOLS.map((symbol) => ({
    symbol,
    label: symbol,
    description: profileFor(symbol).name,
  })),
];

/** Bars for any symbol including the composite benchmark. */
export function getBars(symbol: string): Bar[] {
  if (symbol === COMPOSITE_SYMBOL) return COMPOSITE_BARS;
  return PRICE_BOOK[symbol] ?? [];
}

export function getProfile(symbol: string): SymbolProfile {
  if (symbol === COMPOSITE_SYMBOL) {
    return {
      symbol: COMPOSITE_SYMBOL,
      name: "StreetLevel 10 composite",
      sector: "Composite index",
      marketCap: Number.NaN,
      peRatio: Number.NaN,
      description: "Equal-weight index of the ten names covered by this workspace, rebased to 100 at inception.",
    };
  }
  return profileFor(symbol);
}

export function hasSymbol(symbol: string): boolean {
  return symbol === COMPOSITE_SYMBOL || Object.prototype.hasOwnProperty.call(PRICE_BOOK, symbol);
}

/** Metadata about the bundled dataset, shown in the footer and the freshness badge. */
export const DATASET = {
  source: priceFile.source,
  downloadedAt: priceFile.downloadedAt,
  interval: priceFile.interval,
  from: priceFile.from,
  to: priceFile.to,
  symbolCount: SYMBOLS.length,
};

/**
 * One-year snapshots for every symbol, used by the coverage tables and the
 * signal board. Built once at module load; the dataset is static, so there is
 * nothing to invalidate and no reason to recompute per request.
 */
export const SNAPSHOTS: Record<string, AnalyticsSummary> = Object.fromEntries(
  SYMBOLS.map((symbol) => [symbol, buildSummary(symbol, PRICE_BOOK[symbol], { range: "1Y" })]),
);

export interface SymbolRow {
  symbol: string;
  profile: SymbolProfile;
  summary: AnalyticsSummary;
}

export const SYMBOL_ROWS: SymbolRow[] = SYMBOLS.map((symbol) => ({
  symbol,
  profile: getProfile(symbol),
  summary: SNAPSHOTS[symbol],
}));

/** Closing prices of the last `count` sessions, for sparklines. */
export function sparklineFor(symbol: string, count = 40): number[] {
  const bars = getBars(symbol);
  return bars.slice(-count).map((bar) => bar.adjClose);
}

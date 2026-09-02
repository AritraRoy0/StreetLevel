import historicalPrices from "./data/historical-prices.json";
import type { HistoricalPoint, StockItem } from "./types";

type RawPrice = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
};

type HistoricalPriceFile = {
  source: string;
  downloadedAt: string;
  interval: string;
  from: string;
  to: string;
  symbols: Record<string, RawPrice[]>;
};

const priceFile = historicalPrices as HistoricalPriceFile;

const STOCK_DETAILS: Record<string, Pick<StockItem, "name" | "sector" | "marketCap" | "peRatio">> = {
  NVDA: { name: "NVIDIA Corporation", sector: "Semiconductors", marketCap: "$3.16T", peRatio: 74.2 },
  AAPL: { name: "Apple Inc.", sector: "Consumer Electronics", marketCap: "$3.52T", peRatio: 34.5 },
  MSFT: { name: "Microsoft Corporation", sector: "Software & Cloud", marketCap: "$3.28T", peRatio: 38.9 },
  AMZN: { name: "Amazon.com, Inc.", sector: "E-Commerce & Cloud", marketCap: "$1.94T", peRatio: 51.4 },
  GOOGL: { name: "Alphabet Inc.", sector: "Internet & Services", marketCap: "$2.22T", peRatio: 27.8 },
  META: { name: "Meta Platforms Inc.", sector: "Internet & Services", marketCap: "$1.54T", peRatio: 28.1 },
  TSLA: { name: "Tesla, Inc.", sector: "Automotive & Clean Energy", marketCap: "$815.4B", peRatio: 92.1 },
  AVGO: { name: "Broadcom Inc.", sector: "Semiconductors", marketCap: "$76.2B", peRatio: 42.1 },
  AMD: { name: "Advanced Micro Devices", sector: "Semiconductors", marketCap: "$249.2B", peRatio: 115.4 },
  PLTR: { name: "Palantir Technologies Inc.", sector: "Software & AI", marketCap: "$66.8B", peRatio: 82 },
};

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function buildHistory(rows: RawPrice[]): HistoricalPoint[] {
  let peak = rows[0]?.adjustedClose ?? 0;

  return rows.map((row, index) => {
    const closes = rows.slice(Math.max(0, index - 19), index + 1).map((item) => item.adjustedClose);
    const returns = rows.slice(Math.max(1, index - 19), index + 1).map((item, returnIndex) => {
      const previous = rows[Math.max(0, index - 19) + returnIndex]?.adjustedClose ?? item.adjustedClose;
      return previous ? (item.adjustedClose - previous) / previous : 0;
    });
    const price = row.adjustedClose;
    const sma20 = average(closes);
    const gains = returns.filter((value) => value > 0);
    const losses = returns.filter((value) => value < 0).map((value) => Math.abs(value));
    const relativeStrength = average(gains) / Math.max(average(losses), 0.000001);
    const rsi = returns.length ? 100 - 100 / (1 + relativeStrength) : 50;
    peak = Math.max(peak, price);

    return {
      timestamp: row.date,
      price: Number(price.toFixed(2)),
      open: Number(row.open.toFixed(2)),
      high: Number(row.high.toFixed(2)),
      low: Number(row.low.toFixed(2)),
      volume: row.volume,
      rsi: Number(Math.max(0, Math.min(100, rsi)).toFixed(1)),
      sma20: Number(sma20.toFixed(2)),
      volatility: Number((standardDeviation(returns) * Math.sqrt(252) * 100).toFixed(1)),
      drawdown: Number((((price - peak) / peak) * 100).toFixed(2)),
    };
  });
}

function toStockItem(symbol: string, rows: RawPrice[]): StockItem {
  const details = STOCK_DETAILS[symbol];
  const history = buildHistory(rows);
  const latest = history.at(-1);
  if (!latest) throw new Error(`No historical data available for ${symbol}`);
  const previous = history.at(-2) ?? latest;
  const closes = history.map((point) => point.price);
  const changeAmount = (latest?.price ?? 0) - (previous?.price ?? 0);
  const change = previous?.price ? (changeAmount / previous.price) * 100 : 0;
  const sma50 = average(closes.slice(-50));
  const zScore = standardDeviation(closes.slice(-20)) ? (latest.price - average(closes.slice(-20))) / standardDeviation(closes.slice(-20)) : 0;
  const sentiment = zScore > 0.75 ? "Bullish" : zScore < -0.75 ? "Bearish" : "Neutral";
  const bollinger = latest.price > latest.sma20 + standardDeviation(closes.slice(-20)) ? "Upper" : latest.price < latest.sma20 - standardDeviation(closes.slice(-20)) ? "Lower" : "Middle";

  return {
    symbol,
    ...details,
    price: latest.price,
    change: Number(change.toFixed(2)),
    changeAmount: Number(changeAmount.toFixed(2)),
    volume: `${(latest.volume / 1_000_000).toFixed(1)}M`,
    high52: Math.max(...rows.map((row) => row.high)),
    low52: Math.min(...rows.map((row) => row.low)),
    sparkline: closes.slice(-20),
    history,
    signals: {
      rsi: latest.rsi,
      sma50: Number(sma50.toFixed(2)),
      bollinger,
      zScore: Number(zScore.toFixed(2)),
      sentiment,
    },
  };
}

export const HISTORICAL_PRICES = priceFile.symbols;
export const HISTORICAL_SOURCE = priceFile.source;
export const HISTORICAL_DOWNLOADED_AT = priceFile.downloadedAt;
export const STOCKS: StockItem[] = Object.entries(HISTORICAL_PRICES).map(([symbol, rows]) => toStockItem(symbol, rows));
export const HISTORY: Record<string, HistoricalPoint[]> = Object.fromEntries(STOCKS.map((stock) => [stock.symbol, stock.history ?? []]));

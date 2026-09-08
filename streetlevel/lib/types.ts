export type TabType =
  | "overview"
  | "watchlist"
  | "analytics"
  | "signals"
  | "portfolio"
  | "performance"
  | "insights"
  | "settings";

export interface StockItem {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changeAmount: number;
  volume: string;
  marketCap: string;
  peRatio: number;
  high52: number;
  low52: number;
  sparkline: number[];
  history?: HistoricalPoint[];
  signals: {
    rsi: number;
    sma50: number;
    bollinger: "Upper" | "Middle" | "Lower";
    zScore: number;
    sentiment: "Bullish" | "Bearish" | "Neutral";
  };
}

export interface HistoricalPoint {
  timestamp: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  rsi: number;
  sma20: number;
  volatility: number;
  drawdown: number;
}

export type AnalyticsInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w";

export interface HistoricalDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalSeriesResponse {
  symbol: string;
  interval: AnalyticsInterval;
  start: string;
  end: string;
  timezone: "UTC";
  data: HistoricalDataPoint[];
  metadata: {
    source: "mysql" | "provider" | "aggregated";
    cached: boolean;
    pointCount: number;
  };
}

export interface LatestQuote {
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  timestamp: string;
  timezone: "UTC";
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  category: string;
  sentiment: "positive" | "negative" | "neutral";
  relatedSymbol: string;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  totalValue: number;
  unrealizedPl: number;
  unrealizedPlPercent: number;
}

export interface AlertRule {
  id: string;
  symbol: string;
  condition: "above" | "below" | "crosses_sma";
  targetValue: number;
  active: boolean;
  createdAt: string;
}

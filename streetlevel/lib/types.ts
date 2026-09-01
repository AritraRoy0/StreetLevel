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
  signals: {
    rsi: number;
    sma50: number;
    bollinger: "Upper" | "Middle" | "Lower";
    zScore: number;
    sentiment: "Bullish" | "Bearish" | "Neutral";
  };
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

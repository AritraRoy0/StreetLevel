"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Compass,
  Cpu,
  Database,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  History,
  Home,
  Layers,
  LayoutDashboard,
  LineChart,
  Lock,
  Maximize2,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Newspaper,
  PieChart,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Sun,
  Terminal,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  User,
  Volume2,
  VolumeX,
  Wifi,
  Workflow,
  X,
  Zap,
} from "lucide-react";

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export type TabType =
  | "overview"
  | "watchlist"
  | "analytics"
  | "signals"
  | "portfolio"
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

// ============================================================================
// 2. MOCK DATA REPOSITORY
// ============================================================================

const MOCK_STOCKS: StockItem[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Semiconductors",
    price: 128.44,
    change: 2.14,
    changeAmount: 2.69,
    volume: "65.4M",
    marketCap: "$3.16T",
    peRatio: 74.2,
    high52: 140.76,
    low52: 40.86,
    sparkline: [118, 121, 119, 124, 126, 123, 128],
    signals: {
      rsi: 68,
      sma50: 122.4,
      bollinger: "Upper",
      zScore: 2.3,
      sentiment: "Bullish",
    },
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Consumer Electronics",
    price: 231.09,
    change: -0.42,
    changeAmount: -0.98,
    volume: "42.1M",
    marketCap: "$3.52T",
    peRatio: 34.5,
    high52: 237.23,
    low52: 165.67,
    sparkline: [233, 232, 234, 231, 230, 232, 231],
    signals: {
      rsi: 54,
      sma50: 228.1,
      bollinger: "Middle",
      zScore: 0.4,
      sentiment: "Neutral",
    },
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    sector: "Automotive & Clean Energy",
    price: 256.77,
    change: 1.03,
    changeAmount: 2.62,
    volume: "88.9M",
    marketCap: "$815.4B",
    peRatio: 92.1,
    high52: 271.0,
    low52: 138.8,
    sparkline: [249, 251, 253, 250, 254, 255, 257],
    signals: {
      rsi: 72,
      sma50: 242.0,
      bollinger: "Upper",
      zScore: 2.8,
      sentiment: "Bullish",
    },
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    sector: "Software & Cloud",
    price: 441.2,
    change: 0.18,
    changeAmount: 0.79,
    volume: "19.3M",
    marketCap: "$3.28T",
    peRatio: 38.9,
    high52: 468.35,
    low52: 309.45,
    sparkline: [438, 440, 439, 441, 440, 442, 441],
    signals: {
      rsi: 51,
      sma50: 439.5,
      bollinger: "Middle",
      zScore: 0.1,
      sentiment: "Neutral",
    },
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    sector: "E-Commerce & Cloud",
    price: 186.5,
    change: -1.35,
    changeAmount: -2.55,
    volume: "35.2M",
    marketCap: "$1.94T",
    peRatio: 51.4,
    high52: 201.2,
    low52: 118.35,
    sparkline: [190, 189, 191, 188, 187, 185, 186.5],
    signals: {
      rsi: 42,
      sma50: 189.2,
      bollinger: "Lower",
      zScore: -1.1,
      sentiment: "Bearish",
    },
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Internet & Services",
    price: 179.3,
    change: 0.65,
    changeAmount: 1.16,
    volume: "22.8M",
    marketCap: "$2.22T",
    peRatio: 27.8,
    high52: 191.75,
    low52: 120.21,
    sparkline: [176, 177, 178, 177, 179, 178, 179.3],
    signals: {
      rsi: 59,
      sma50: 177.0,
      bollinger: "Middle",
      zScore: 0.9,
      sentiment: "Bullish",
    },
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    sector: "Semiconductors",
    price: 154.2,
    change: 1.82,
    changeAmount: 2.76,
    volume: "48.1M",
    marketCap: "$249.2B",
    peRatio: 115.4,
    high52: 227.3,
    low52: 95.5,
    sparkline: [148, 150, 151, 152, 151, 153, 154.2],
    signals: {
      rsi: 63,
      sma50: 150.1,
      bollinger: "Upper",
      zScore: 1.7,
      sentiment: "Bullish",
    },
  },
  {
    symbol: "PLTR",
    name: "Palantir Technologies Inc.",
    sector: "Software & AI",
    price: 29.85,
    change: 3.21,
    changeAmount: 0.93,
    volume: "74.6M",
    marketCap: "$66.8B",
    peRatio: 82.0,
    high52: 31.5,
    low52: 13.68,
    sparkline: [27, 27.5, 28, 28.5, 29, 29.2, 29.85],
    signals: {
      rsi: 78,
      sma50: 26.5,
      bollinger: "Upper",
      zScore: 3.1,
      sentiment: "Bullish",
    },
  },
];

const MOCK_NEWS: NewsItem[] = [
  {
    id: "news-1",
    title:
      "NVIDIA Announces Next-Generation Blackwell Architecture Deployment Schedules",
    source: "Bloomberg",
    time: "12m ago",
    category: "Semiconductors",
    sentiment: "positive",
    relatedSymbol: "NVDA",
  },
  {
    id: "news-2",
    title:
      "Federal Reserve Signals Potential Rate Cut Amid Cooling Inflation Metrics",
    source: "Wall Street Journal",
    time: "38m ago",
    category: "Macroeconomics",
    sentiment: "positive",
    relatedSymbol: "SPY",
  },
  {
    id: "news-3",
    title:
      "Tesla Expands Full Self-Driving Beta Trials Across European Regulatory Markets",
    source: "Reuters",
    time: "1h ago",
    category: "Automotive",
    sentiment: "positive",
    relatedSymbol: "TSLA",
  },
  {
    id: "news-4",
    title:
      "Cloud Infrastructure Spending Growth Moderates Across Enterprise Accounts",
    source: "Financial Times",
    time: "2h ago",
    category: "Cloud",
    sentiment: "negative",
    relatedSymbol: "MSFT",
  },
  {
    id: "news-5",
    title:
      "Apple Intelligence Rollout Dates Confirmed for Fall Hardware Ecosystem Event",
    source: "TechCrunch",
    time: "3h ago",
    category: "Consumer Tech",
    sentiment: "positive",
    relatedSymbol: "AAPL",
  },
];

const INITIAL_PORTFOLIO: PortfolioPosition[] = [
  {
    id: "pos-1",
    symbol: "NVDA",
    shares: 150,
    avgCost: 95.2,
    currentPrice: 128.44,
    totalValue: 19266.0,
    unrealizedPl: 4986.0,
    unrealizedPlPercent: 34.83,
  },
  {
    id: "pos-2",
    symbol: "AAPL",
    shares: 80,
    avgCost: 182.5,
    currentPrice: 231.09,
    totalValue: 18487.2,
    unrealizedPl: 3887.2,
    unrealizedPlPercent: 26.61,
  },
  {
    id: "pos-3",
    symbol: "TSLA",
    shares: 60,
    avgCost: 210.0,
    currentPrice: 256.77,
    totalValue: 15406.2,
    unrealizedPl: 2806.2,
    unrealizedPlPercent: 22.27,
  },
  {
    id: "pos-4",
    symbol: "MSFT",
    shares: 45,
    avgCost: 410.0,
    currentPrice: 441.2,
    totalValue: 19854.0,
    unrealizedPl: 1404.0,
    unrealizedPlPercent: 7.61,
  },
];

// ============================================================================
// 3. UTILITY COMPONENTS (SPARKLINE, BADGES, TOGGLES)
// ============================================================================

const SparklineSVG = React.memo(
  ({ values, isPositive }: { values: number[]; isPositive: boolean }) => {
    const path = useMemo(() => {
      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = max - min || 1;
      const step = 80 / (values.length - 1);
      return values
        .map((v, i) => {
          const x = (i * step).toFixed(1);
          const y = (28 - ((v - min) / range) * 24).toFixed(1);
          return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
    }, [values]);

    const color = isPositive ? "#3ECF8E" : "#E5484D";
    return (
      <svg viewBox="0 0 80 32" className="h-8 w-24 shrink-0 overflow-visible">
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  },
);
SparklineSVG.displayName = "SparklineSVG";

// ============================================================================
// 4. SUB-VIEWS & MODULES
// ============================================================================

// --- Overview / Dashboard Tab ---
function OverviewTab({
  stocks,
  news,
  onSelectStock,
}: {
  stocks: StockItem[];
  news: NewsItem[];
  onSelectStock: (stock: StockItem) => void;
}) {
  const topGainers = [...stocks]
    .sort((a, b) => b.change - a.change)
    .slice(0, 4);
  const activeAlertsCount = 12;
  const portfolioTotal = 73013.4;
  const portfolioDailyChange = 1245.8;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Metric Cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Portfolio Value
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="font-mono text-2xl font-bold text-white">
              ${portfolioTotal.toLocaleString()}
            </h3>
            <span className="flex items-center gap-0.5 font-mono text-xs font-semibold text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" /> +1.74%
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            +$1,245.80 past 24 hours
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Signals
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="font-mono text-2xl font-bold text-white">
              24 Flagged
            </h3>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              Optimal
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            4 high-conviction Z-score breakouts
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Watchlist Status
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Star className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="font-mono text-2xl font-bold text-white">
              {stocks.length} Tracked
            </h3>
            <span className="font-mono text-xs text-emerald-400 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />{" "}
              Live
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Ingest latency: ≤ 150ms</p>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-lg transition-all hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Alerts
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Bell className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="font-mono text-2xl font-bold text-white">
              {activeAlertsCount} Rules
            </h3>
            <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400 border border-rose-500/20">
              Triggered (2)
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Next check in 45 seconds
          </p>
        </div>
      </div>

      {/* Main Grid: Top Gainers & Live News */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Top Gainers Table */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">
                Top Momentum Gainers
              </h3>
              <p className="text-xs text-slate-400">
                Highest relative volume and intraday price spread
              </p>
            </div>
            <button className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
              View all {stocks.length} symbols →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2">Symbol</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">Change</th>
                  <th className="pb-3">Trend</th>
                  <th className="pb-3 pr-2 text-right">Z-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono text-sm">
                {topGainers.map((stock) => (
                  <tr
                    key={stock.symbol}
                    onClick={() => onSelectStock(stock)}
                    className="group cursor-pointer transition-colors hover:bg-slate-800/40"
                  >
                    <td className="py-4 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-white border border-slate-700/60 group-hover:border-amber-500/40 transition-colors">
                          {stock.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-white">{stock.symbol}</p>
                          <p className="text-[11px] text-slate-400 font-sans">
                            {stock.name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-semibold text-white">
                      ${stock.price.toFixed(2)}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-bold ${
                          stock.change >= 0
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {stock.change >= 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(stock.change).toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-4">
                      <SparklineSVG
                        values={stock.sparkline}
                        isPositive={stock.change >= 0}
                      />
                    </td>
                    <td className="py-4 pr-2 text-right font-bold text-amber-400">
                      +{stock.signals.zScore}σ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live News Stream */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Live Market Wire</h3>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <div className="space-y-4">
              {news.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="group rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 transition-all hover:border-slate-700 hover:bg-slate-950/80"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
                    <span className="font-bold text-amber-400">
                      {item.source}
                    </span>
                    <span>{item.time}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                    {item.title}
                  </h4>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                      {item.relatedSymbol}
                    </span>
                    <span
                      className={`font-semibold ${
                        item.sentiment === "positive"
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {item.sentiment.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="mt-6 w-full rounded-xl border border-slate-800 bg-slate-800/50 py-3 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">
            Open Full News Terminal →
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Watchlist Tab ---
function WatchlistTab({
  stocks,
  onSelectStock,
}: {
  stocks: StockItem[];
  onSelectStock: (stock: StockItem) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState("All");

  const sectors = [
    "All",
    "Semiconductors",
    "Consumer Electronics",
    "Automotive & Clean Energy",
    "Software & Cloud",
  ];

  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      const matchesSearch =
        s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector =
        selectedSector === "All" || s.sector === selectedSector;
      return matchesSearch && matchesSector;
    });
  }, [stocks, searchTerm, selectedSector]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Controls Header */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search symbol or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSelectedSector(sec)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                selectedSector === sec
                  ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)]"
                  : "border border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-white"
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredStocks.map((stock) => (
          <div
            key={stock.symbol}
            onClick={() => onSelectStock(stock)}
            className="group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <span className="font-mono text-xs font-bold tracking-wider text-amber-400">
                  {stock.symbol}
                </span>
                <h4 className="text-base font-bold text-white mt-0.5">
                  {stock.name}
                </h4>
              </div>
              <button className="text-slate-500 hover:text-amber-400 transition-colors">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              </button>
            </div>

            <div className="flex items-baseline justify-between mb-6">
              <span className="font-mono text-2xl font-extrabold text-white">
                ${stock.price.toFixed(2)}
              </span>
              <span
                className={`flex items-center gap-0.5 font-mono text-xs font-bold px-2 py-1 rounded-lg ${
                  stock.change >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {stock.change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(stock.change).toFixed(2)}%
              </span>
            </div>

            <div className="mb-6 flex justify-center py-2 bg-slate-950/40 rounded-2xl border border-slate-800/50">
              <SparklineSVG
                values={stock.sparkline}
                isPositive={stock.change >= 0}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">
                  RSI (14)
                </span>
                <span className="font-bold text-slate-200">
                  {stock.signals.rsi}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px] uppercase">
                  Z-Score
                </span>
                <span className="font-bold text-amber-400">
                  +{stock.signals.zScore}σ
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Analytics Tab ---
function AnalyticsTab({ stocks }: { stocks: StockItem[] }) {
  const [selectedStockSymbol, setSelectedStockSymbol] = useState(
    stocks[0].symbol,
  );
  const currentStock =
    stocks.find((s) => s.symbol === selectedStockSymbol) || stocks[0];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Symbol Picker Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl">
        <div>
          <h3 className="text-lg font-bold text-white">
            Technical Indicator Suite
          </h3>
          <p className="text-xs text-slate-400">
            Real-time moving averages, RSI divergence, and Bollinger bands
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stocks.map((s) => (
            <button
              key={s.symbol}
              onClick={() => setSelectedStockSymbol(s.symbol)}
              className={`rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
                selectedStockSymbol === s.symbol
                  ? "bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)]"
                  : "border border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-white"
              }`}
            >
              {s.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Main Analytics Display */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-amber-400 font-bold">
                {currentStock.symbol} / USD
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-1">
                ${currentStock.price.toFixed(2)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                {currentStock.signals.sentiment} Signal
              </span>
            </div>
          </div>

          {/* Simulated Candlestick / Area Chart View */}
          <div className="relative h-72 w-full rounded-2xl border border-slate-800/80 bg-slate-950/80 p-6 flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center justify-between z-10">
              <span className="font-mono text-xs text-slate-400">
                52W High: ${currentStock.high52} | Low: ${currentStock.low52}
              </span>
              <span className="font-mono text-xs text-amber-400">
                SMA(50): ${currentStock.signals.sma50}
              </span>
            </div>
            <div className="my-auto flex items-center justify-center">
              <div className="w-full space-y-2">
                <div className="flex justify-between font-mono text-xs text-slate-400">
                  <span>Volume Z-Score Distribution</span>
                  <span className="text-emerald-400">
                    +{currentStock.signals.zScore}σ Sigma
                  </span>
                </div>
                <div className="h-4 w-full rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-1000"
                    style={{
                      width: `${Math.min(currentStock.signals.rsi, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between font-mono text-xs text-slate-500 z-10">
              <span>09:30 EST</span>
              <span>12:00 EST</span>
              <span>16:00 EST</span>
            </div>
          </div>
        </div>

        {/* Indicator Sidebar Breakdown */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-6">
              Indicator Metrics
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm font-semibold mb-2">
                  <span className="text-slate-400">RSI (14-period)</span>
                  <span className="font-mono text-white">
                    {currentStock.signals.rsi} / 100
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      currentStock.signals.rsi > 70
                        ? "bg-rose-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${currentStock.signals.rsi}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Bollinger Position</span>
                  <span className="font-bold text-amber-400">
                    {currentStock.signals.bollinger} Band
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">P/E Ratio</span>
                  <span className="font-bold text-white">
                    {currentStock.peRatio}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Market Cap</span>
                  <span className="font-bold text-white">
                    {currentStock.marketCap}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily Volume</span>
                  <span className="font-bold text-white">
                    {currentStock.volume}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button className="mt-8 w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)] transition-all hover:bg-amber-400">
            Export Signal Data (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Signals & Alerts Tab ---
function SignalsTab() {
  const [alerts, setAlerts] = useState<AlertRule[]>([
    {
      id: "alt-1",
      symbol: "NVDA",
      condition: "above",
      targetValue: 135.0,
      active: true,
      createdAt: "2026-09-01",
    },
    {
      id: "alt-2",
      symbol: "TSLA",
      condition: "crosses_sma",
      targetValue: 250.0,
      active: true,
      createdAt: "2026-08-28",
    },
    {
      id: "alt-3",
      symbol: "AAPL",
      condition: "below",
      targetValue: 220.0,
      active: false,
      createdAt: "2026-08-25",
    },
  ]);

  const toggleAlert = (id: string) => {
    setAlerts(
      alerts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">
            Smart Alert Rules & Triggers
          </h3>
          <p className="text-xs text-slate-400">
            Get notified instantly when price or volume crosses your custom
            threshold
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)] transition-all hover:bg-amber-400">
          <Plus className="h-4 w-4" /> Create New Alert Rule
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {alert.symbol}
                </span>
                <h4 className="text-lg font-bold text-white mt-1">
                  Price {alert.condition.replace("_", " ")} ${alert.targetValue}
                </h4>
              </div>
              <button
                onClick={() => toggleAlert(alert.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  alert.active ? "bg-emerald-500" : "bg-slate-800"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    alert.active ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-4">
              <span>Created: {alert.createdAt}</span>
              <span
                className={
                  alert.active ? "text-emerald-400 font-bold" : "text-slate-500"
                }
              >
                {alert.active ? "Active Monitored" : "Paused"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Portfolio Tab ---
function PortfolioTab() {
  const [positions] = useState<PortfolioPosition[]>(INITIAL_PORTFOLIO);
  const totalVal = positions.reduce((acc, p) => acc + p.totalValue, 0);
  const totalPl = positions.reduce((acc, p) => acc + p.unrealizedPl, 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Portfolio Summary Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-8 shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Total Portfolio Valuation
            </span>
            <h2 className="font-mono text-4xl font-extrabold text-white mt-1">
              ${totalVal.toLocaleString()}
            </h2>
            <p className="mt-2 text-xs text-slate-400">
              Unrealized P&L:{" "}
              <span className="text-emerald-400 font-bold">
                +${totalPl.toLocaleString()} (+21.4%)
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <button className="rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)] transition-all hover:bg-amber-400">
              Deposit Funds
            </button>
            <button className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-3 text-xs font-bold text-white transition-all hover:border-slate-700">
              Export Statement
            </button>
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Active Holdings</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pl-2">Symbol</th>
                <th className="pb-3">Shares</th>
                <th className="pb-3">Avg Cost</th>
                <th className="pb-3">Current Price</th>
                <th className="pb-3">Total Value</th>
                <th className="pb-3 pr-2 text-right">Unrealized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {positions.map((pos) => (
                <tr
                  key={pos.id}
                  className="transition-colors hover:bg-slate-800/40"
                >
                  <td className="py-4 pl-2 font-bold text-white">
                    {pos.symbol}
                  </td>
                  <td className="py-4 text-slate-300">{pos.shares}</td>
                  <td className="py-4 text-slate-300">
                    ${pos.avgCost.toFixed(2)}
                  </td>
                  <td className="py-4 font-bold text-white">
                    ${pos.currentPrice.toFixed(2)}
                  </td>
                  <td className="py-4 font-bold text-white">
                    ${pos.totalValue.toLocaleString()}
                  </td>
                  <td className="py-4 pr-2 text-right text-emerald-400 font-bold">
                    +${pos.unrealizedPl.toLocaleString()} (+
                    {pos.unrealizedPlPercent}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Settings Tab ---
function SettingsTab() {
  return (
    <div className="max-w-4xl space-y-8 animate-fadeIn">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl space-y-6">
        <h3 className="text-xl font-bold text-white">Workspace Preferences</h3>
        <div className="space-y-4 font-mono text-sm">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Real-Time WebSocket Stream
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Stream quotes directly without polling overhead
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Audio Alerts for Sigma Breakouts
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Play chime when a Z-score crosses 2.5σ
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
              Enabled
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans font-bold text-white">
                API Rate Limit Mode
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Throttle ingest cadence during off-market hours
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
              Standard
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MAIN ENTERPRISE DASHBOARD CONTAINER
// ============================================================================

export default function StreetLevelDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stocks] = useState<StockItem[]>(MOCK_STOCKS);
  const [news] = useState<NewsItem[]>(MOCK_NEWS);
  const [selectedStockModal, setSelectedStockModal] =
    useState<StockItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigationItems = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard },
    { id: "watchlist" as TabType, label: "Watchlist", icon: Star },
    { id: "analytics" as TabType, label: "Analytics", icon: LineChart },
    { id: "signals" as TabType, label: "Smart Signals", icon: Zap },
    { id: "portfolio" as TabType, label: "Portfolio", icon: Briefcase },
    { id: "settings" as TabType, label: "Settings", icon: Settings },
  ];

  return (
    <div className="relative min-h-screen bg-[#050810] font-sans text-slate-100 selection:bg-amber-500/30 selection:text-amber-300 flex overflow-hidden">
      {/* Ambient Glow Accents */}
      <div className="pointer-events-none absolute left-1/4 top-0 -z-10 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-500/10 via-indigo-500/5 to-transparent blur-[140px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[500px] w-[500px] rounded-full bg-emerald-500/5 blur-[120px]" />

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800/80 bg-[#050810]/90 backdrop-blur-2xl transition-all duration-300 lg:static ${
          sidebarOpen ? "w-72" : "w-20"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-slate-900 font-mono text-sm font-bold text-amber-400 shadow-[0_0_20px_rgba(246,201,106,0.2)]">
              SL
            </span>
            {sidebarOpen && (
              <span className="font-mono text-sm font-bold tracking-wider text-white uppercase truncate">
                StreetLevel
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${sidebarOpen ? "rotate-90" : "-rotate-90"}`}
            />
          </button>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {navigationItems.map((item) => {
            const IconComp = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-amber-500 text-slate-950 shadow-[0_0_25px_rgba(246,201,106,0.3)] font-bold"
                    : "text-slate-400 hover:bg-slate-900/80 hover:text-white"
                }`}
              >
                <IconComp
                  className={`h-5 w-5 shrink-0 ${isActive ? "text-slate-950" : "text-slate-400 group-hover:text-amber-400"}`}
                />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80">
          <div
            className={`flex items-center gap-3 rounded-2xl bg-slate-900/60 p-3 border border-slate-800 ${!sidebarOpen && "justify-center"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 font-bold text-amber-400 font-mono text-xs">
              AR
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">
                  Aritra Roy
                </p>
                <p className="text-[10px] text-emerald-400 font-mono truncate">
                  Pro Trader Tier
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-800/80 bg-[#050810]/80 px-8 backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-400 border border-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-mono text-lg font-bold text-white uppercase tracking-wider">
              {activeTab} Workspace
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2 font-mono text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              NYSE Open • Feed Live
            </div>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400" />
            </button>
          </div>
        </header>

        {/* View Content Renderer */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === "overview" && (
            <OverviewTab
              stocks={stocks}
              news={news}
              onSelectStock={setSelectedStockModal}
            />
          )}
          {activeTab === "watchlist" && (
            <WatchlistTab
              stocks={stocks}
              onSelectStock={setSelectedStockModal}
            />
          )}
          {activeTab === "analytics" && <AnalyticsTab stocks={stocks} />}
          {activeTab === "signals" && <SignalsTab />}
          {activeTab === "portfolio" && <PortfolioTab />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>

      {/* Stock Quick View Modal */}
      {selectedStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {selectedStockModal.symbol}
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {selectedStockModal.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedStockModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-baseline justify-between py-4 border-y border-slate-800">
              <span className="font-mono text-3xl font-extrabold text-white">
                ${selectedStockModal.price.toFixed(2)}
              </span>
              <span
                className={`font-mono text-sm font-bold px-3 py-1 rounded-xl ${
                  selectedStockModal.change >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                {selectedStockModal.change >= 0 ? "+" : ""}
                {selectedStockModal.change.toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 font-mono text-xs">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-slate-500 block text-[10px] uppercase">
                  RSI Index
                </span>
                <span className="text-base font-bold text-white mt-1 block">
                  {selectedStockModal.signals.rsi}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-slate-500 block text-[10px] uppercase">
                  Z-Score Signal
                </span>
                <span className="text-base font-bold text-amber-400 mt-1 block">
                  +{selectedStockModal.signals.zScore}σ
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedStockModal(null)}
              className="w-full rounded-xl bg-amber-500 py-3 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(246,201,106,0.3)] transition-all hover:bg-amber-400"
            >
              Close Quick Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

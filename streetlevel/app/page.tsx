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
import { MOCK_STOCKS, MOCK_NEWS, INITIAL_PORTFOLIO } from "@/lib/mock-data";
import {
  type TabType,
  type StockItem,
  type NewsItem,
  type PortfolioPosition,
  type AlertRule,
} from "@/lib/types";
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
// UTILITY COMPONENTS (SPARKLINE, BADGES, TOGGLES)
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

// Market Sector Performance Component
function MarketSectorCard({
  sector,
  performance,
  trend,
  icon: IconComponent,
}: {
  sector: string;
  performance: number;
  trend: "up" | "down" | "neutral";
  icon: React.ComponentType<{ className: string }>;
}) {
  const trendColor =
    trend === "up"
      ? "text-emerald-400 bg-emerald-500/10"
      : trend === "down"
        ? "text-rose-400 bg-rose-500/10"
        : "text-slate-400 bg-slate-500/10";

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IconComponent className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">{sector}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trendColor}`}>
          {performance > 0 ? "+" : ""}{performance.toFixed(2)}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${trend === "up" ? "bg-emerald-400" : trend === "down" ? "bg-rose-400" : "bg-slate-500"}`}
          style={{ width: `${Math.min(Math.abs(performance) * 2, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Performance Metrics Box
function MetricBox({
  label,
  value,
  change,
  unit,
  accentColor,
}: {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
      <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
        {label}
      </span>
      <div className="flex items-end justify-between">
        <span className={`text-lg font-bold ${accentColor}`}>{value}</span>
        {unit && <span className="text-[10px] text-slate-500">{unit}</span>}
      </div>
      {change !== undefined && (
        <span
          className={`text-[10px] font-semibold mt-1 block ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}
        >
          {change > 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      )}
    </div>
  );
}

// Advanced Data Grid Component
function AdvancedStockGrid({
  stocks,
  onSelectStock,
}: {
  stocks: StockItem[];
  onSelectStock: (stock: StockItem) => void;
}) {
  const [sortBy, setSortBy] = useState<"performance" | "zscore" | "volume">(
    "performance",
  );

  const sortedStocks = useMemo(() => {
    const sorted = [...stocks];
    if (sortBy === "performance") {
      sorted.sort((a, b) => b.change - a.change);
    } else if (sortBy === "zscore") {
      sorted.sort((a, b) => b.signals.zScore - a.signals.zScore);
    } else {
      sorted.sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));
    }
    return sorted;
  }, [stocks, sortBy]);

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Market Screener</h3>
          <p className="text-xs text-slate-400">Real-time stock analysis</p>
        </div>
        <div className="flex gap-2">
          {(["performance", "zscore", "volume"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                sortBy === option
                  ? "bg-amber-500 text-slate-950"
                  : "border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {option === "performance"
                ? "Performance"
                : option === "zscore"
                  ? "Z-Score"
                  : "Volume"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm font-mono">
          <thead>
            <tr className="border-b border-slate-800/80 text-[10px] font-bold uppercase text-slate-400">
              <th className="pb-3 pl-2">Symbol</th>
              <th className="pb-3">Price</th>
              <th className="pb-3">Change</th>
              <th className="pb-3">RSI</th>
              <th className="pb-3">Z-Score</th>
              <th className="pb-3">Volume</th>
              <th className="pb-3 pr-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {sortedStocks.slice(0, 8).map((stock) => (
              <tr
                key={stock.symbol}
                className="transition-colors hover:bg-slate-800/40"
              >
                <td className="py-3 pl-2">
                  <span className="font-bold text-amber-400">{stock.symbol}</span>
                </td>
                <td className="py-3 font-semibold text-white">
                  ${stock.price.toFixed(2)}
                </td>
                <td className="py-3">
                  <span
                    className={`font-bold ${stock.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 text-slate-300">{stock.signals.rsi}</td>
                <td className="py-3 font-bold text-amber-400">
                  +{stock.signals.zScore}σ
                </td>
                <td className="py-3 text-slate-300">{stock.volume}</td>
                <td className="py-3 pr-2">
                  <button
                    onClick={() => onSelectStock(stock)}
                    className="text-amber-400 hover:text-amber-300 font-bold text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-VIEWS & MODULES
// ============================================================================

// --- Performance Dashboard Tab ---
function PerformanceDashboardTab({
  stocks,
  onSelectStock,
}: {
  stocks: StockItem[];
  onSelectStock: (stock: StockItem) => void;
}) {
  const sectorPerformance = [
    { name: "Semiconductors", performance: 2.45, trend: "up" as const },
    { name: "Cloud & AI", performance: 1.82, trend: "up" as const },
    { name: "Consumer Tech", performance: -0.42, trend: "down" as const },
    { name: "Automotive", performance: 1.03, trend: "up" as const },
  ];

  const bullishStocks = stocks.filter(
    (s) => s.signals.sentiment === "Bullish",
  ).length;
  const bearishStocks = stocks.filter(
    (s) => s.signals.sentiment === "Bearish",
  ).length;
  const avgRsi =
    stocks.reduce((acc, s) => acc + s.signals.rsi, 0) / stocks.length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Market Health Overview */}
      <div className="grid gap-5 md:grid-cols-4">
        <MetricBox
          label="Bullish Count"
          value={bullishStocks}
          accentColor="text-emerald-400"
        />
        <MetricBox
          label="Bearish Count"
          value={bearishStocks}
          accentColor="text-rose-400"
        />
        <MetricBox
          label="Avg RSI (14)"
          value={avgRsi.toFixed(1)}
          accentColor="text-amber-400"
        />
        <MetricBox
          label="Market Theta"
          value="0.42"
          unit="hrs"
          change={-0.15}
          accentColor="text-indigo-400"
        />
      </div>

      {/* Sector Performance Grid */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Sector Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sectorPerformance.map((sector) => (
            <MarketSectorCard
              key={sector.name}
              sector={sector.name}
              performance={sector.performance}
              trend={sector.trend}
              icon={TrendingUp}
            />
          ))}
        </div>
      </div>

      {/* Advanced Stock Screener */}
      <AdvancedStockGrid stocks={stocks} onSelectStock={onSelectStock} />

      {/* Risk Analysis Box */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Risk Assessment</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                Portfolio Beta
              </span>
              <span className="text-lg font-bold text-amber-400">1.28</span>
            </div>
            <p className="text-xs text-slate-400">
              28% more volatile than market
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[64%] bg-gradient-to-r from-amber-400 to-yellow-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                VaR (95%)
              </span>
              <span className="text-lg font-bold text-rose-400">-2.34%</span>
            </div>
            <p className="text-xs text-slate-400">
              Expected max 1-day loss
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[40%] bg-gradient-to-r from-rose-400 to-red-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                Sharpe Ratio
              </span>
              <span className="text-lg font-bold text-emerald-400">1.84</span>
            </div>
            <p className="text-xs text-slate-400">
              Risk-adjusted return metric
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[92%] bg-gradient-to-r from-emerald-400 to-cyan-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                Max Drawdown
              </span>
              <span className="text-lg font-bold text-rose-400">-8.42%</span>
            </div>
            <p className="text-xs text-slate-400">
              Peak to trough decline
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[28%] bg-gradient-to-r from-rose-400 to-red-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                Correlation
              </span>
              <span className="text-lg font-bold text-indigo-400">0.72</span>
            </div>
            <p className="text-xs text-slate-400">
              Portfolio to S&P 500
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[72%] bg-gradient-to-r from-indigo-400 to-purple-400" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase text-slate-400">
                Sortino Ratio
              </span>
              <span className="text-lg font-bold text-cyan-400">2.47</span>
            </div>
            <p className="text-xs text-slate-400">
              Downside risk adjusted
            </p>
            <div className="mt-4 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-[82%] bg-gradient-to-r from-cyan-400 to-blue-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Market Insights Tab ---
function MarketInsightsTab({
  stocks,
  news,
}: {
  stocks: StockItem[];
  news: NewsItem[];
}) {
  const topPerformers = [...stocks]
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);
  const underperformers = [...stocks]
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Top Performers
          </h3>
          <div className="space-y-3">
            {topPerformers.map((stock, idx) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-white">{stock.symbol}</p>
                    <p className="text-[10px] text-slate-400">{stock.name}</p>
                  </div>
                </div>
                <span className="font-bold text-emerald-400">
                  +{stock.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Underperformers */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-400" />
            Underperformers
          </h3>
          <div className="space-y-3">
            {underperformers.map((stock, idx) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-white">{stock.symbol}</p>
                    <p className="text-[10px] text-slate-400">{stock.name}</p>
                  </div>
                </div>
                <span className="font-bold text-rose-400">
                  {stock.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed News Analysis */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Market News Deep Dive</h3>
        <div className="space-y-4">
          {news.map((item, idx) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-slate-800/60 bg-slate-950/40 hover:bg-slate-950/70 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      {item.source}
                    </span>
                    <span className="text-[10px] text-slate-500">{item.time}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.sentiment === "positive"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : item.sentiment === "negative"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-slate-500/10 text-slate-400"
                      }`}
                    >
                      {item.sentiment.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-100 text-sm leading-snug">
                    {item.title}
                  </h4>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                      {item.relatedSymbol}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.category}
                    </span>
                  </div>
                </div>
                <button className="text-slate-500 hover:text-amber-400 transition-colors">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


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

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[2rem] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(246,201,106,0.15),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(11,16,30,0.9))] p-6 shadow-2xl shadow-slate-950/30">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Market Pulse
              </p>
              <h3 className="mt-2 text-2xl font-bold text-white">Executive brief</h3>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300">
              +1.8% drift
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Risk</span>
                <span className="font-mono text-emerald-300">Low</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-mono text-3xl font-bold text-white">32</span>
                <span className="pb-1 text-[10px] text-slate-500">/100</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-full w-[32%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Momentum</span>
                <span className="font-mono text-amber-300">Strong</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-mono text-3xl font-bold text-white">78</span>
                <span className="pb-1 text-[10px] text-slate-500">/100</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-amber-400 to-yellow-300" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Liquidity</span>
                <span className="font-mono text-indigo-300">Healthy</span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-mono text-3xl font-bold text-white">84</span>
                <span className="pb-1 text-[10px] text-slate-500">/100</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-full w-[84%] rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800/80 bg-slate-900/70 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Action Queue
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">Priority list</h3>
            </div>
            <button className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300">
              3 open
            </button>
          </div>

          <div className="space-y-3">
            {[
              { label: "NVDA breakout check", tone: "amber" },
              { label: "TSLA alert rebalancing", tone: "green" },
              { label: "Portfolio drift scan", tone: "blue" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.tone === "amber" ? "bg-amber-400" : item.tone === "green" ? "bg-emerald-400" : "bg-cyan-400"}`} />
                  <span className="text-sm font-medium text-slate-200">{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </div>
            ))}
          </div>
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

      {/* Extended Analytics Section */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6">Market Correlation Matrix</h3>
        <div className="grid gap-3 md:grid-cols-5">
          {stocks.slice(0, 5).map((stock) => (
            <div key={stock.symbol} className="space-y-2">
              <div className="text-center">
                <span className="text-xs font-bold text-amber-400">{stock.symbol}</span>
              </div>
              {stocks.slice(0, 5).map((compareStock) => {
                const correlation = Math.random() * 0.8 + 0.2;
                return (
                  <div
                    key={`${stock.symbol}-${compareStock.symbol}`}
                    className={`p-2 rounded-lg text-center text-xs font-mono ${
                      correlation > 0.7
                        ? "bg-emerald-500/20 text-emerald-300"
                        : correlation > 0.4
                          ? "bg-slate-700/40 text-slate-300"
                          : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {correlation.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Additional Market Metrics */}
      <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            Market Close
          </span>
          <span className="text-lg font-bold text-white">4:00 PM</span>
          <p className="text-[10px] text-slate-500 mt-1">NYSE</p>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            52W Range
          </span>
          <span className="text-lg font-bold text-white">$40-$141</span>
          <p className="text-[10px] text-slate-500 mt-1">NVDA</p>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            Avg Volume
          </span>
          <span className="text-lg font-bold text-white">52.3M</span>
          <p className="text-[10px] text-slate-500 mt-1">30-day average</p>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            IV Rank
          </span>
          <span className="text-lg font-bold text-amber-400">78%</span>
          <p className="text-[10px] text-slate-500 mt-1">High volatility</p>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            VIX
          </span>
          <span className="text-lg font-bold text-emerald-400">18.45</span>
          <p className="text-[10px] text-slate-500 mt-1">Low fear index</p>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4">
          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-2">
            Yield Curve
          </span>
          <span className="text-lg font-bold text-slate-300">Normal</span>
          <p className="text-[10px] text-slate-500 mt-1">2yr-10yr spread</p>
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
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className="max-w-4xl space-y-8 animate-fadeIn">
      {/* Display Settings */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl space-y-6">
        <h3 className="text-xl font-bold text-white">Display Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">Theme</p>
              <p className="text-xs text-slate-400 font-sans">
                Choose your preferred color scheme
              </p>
            </div>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">System</option>
            </select>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">Chart Density</p>
              <p className="text-xs text-slate-400 font-sans">
                Adjust data visualization density
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
              Compact
            </span>
          </div>

          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="font-sans font-bold text-white">Animation Effects</p>
              <p className="text-xs text-slate-400 font-sans">
                Enable smooth transitions and animations
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl space-y-6">
        <h3 className="text-xl font-bold text-white">Notifications</h3>
        <div className="space-y-4 font-mono text-sm">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Price Alerts
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Get notified when assets reach target price
              </p>
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                notificationsEnabled ? "bg-emerald-500" : "bg-slate-800"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition ${
                  notificationsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Volume Spike Alerts
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Notify when volume exceeds threshold
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
              Active
            </span>
          </div>

          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Sound Effects
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Play audio cues for important events
              </p>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                soundEnabled ? "bg-emerald-500" : "bg-slate-800"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition ${
                  soundEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-8 backdrop-blur-xl shadow-xl space-y-6">
        <h3 className="text-xl font-bold text-white">Advanced Settings</h3>
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

          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="font-sans font-bold text-white">
                Data Retention
              </p>
              <p className="text-xs text-slate-400 font-sans">
                Keep historical quote data for backtesting
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
              30 days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN ENTERPRISE DASHBOARD CONTAINER
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
    { id: "performance" as TabType, label: "Performance", icon: TrendingUp },
    { id: "insights" as TabType, label: "Insights", icon: Compass },
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
          {activeTab === "performance" && (
            <PerformanceDashboardTab
              stocks={stocks}
              onSelectStock={setSelectedStockModal}
            />
          )}
          {activeTab === "insights" && (
            <MarketInsightsTab stocks={stocks} news={news} />
          )}
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

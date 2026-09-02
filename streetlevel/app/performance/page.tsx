"use client";

import { useState } from "react";
import { Footer } from "@/components/footer";
import { Metric, SectionHeading } from "@/components/market-ui";
import { Nav, TopBar } from "@/components/nav";
import { STOCKS, STOCKS as MOCK_STOCKS } from "@/lib/market-data";

export default function PerformancePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bullish = STOCKS.filter((stock) => stock.change > 0).length;
  const avgRsi = STOCKS.reduce((sum, stock) => sum + stock.signals.rsi, 0) / STOCKS.length;

  return (
    <div className="min-h-screen bg-white text-black"><Nav activeTab="performance" sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen((open) => !open)} /><TopBar activeTab="performance" onSidebarToggle={() => setSidebarOpen((open) => !open)} /><main className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:px-16"><div className="mb-10 flex items-center justify-between border-b border-neutral-300 pb-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-black" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Live research desk</span></div><div className="hidden items-center gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 md:flex"><span>NYSE / Open</span><span>14:32:08 ET</span><span>UTC -04:00</span></div></div><div className="space-y-14"><SectionHeading eyebrow="Attribution / current session" title="Performance" /><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Bullish names" value={`${bullish}`} note={`of ${MOCK_STOCKS.length} covered`} large /><Metric label="Average RSI" value={avgRsi.toFixed(1)} note="14 day reading" large /><Metric label="Market theta" value="0.42h" note="Signal half-life" large /><Metric label="Risk budget" value="68%" note="Currently deployed" large /></div><section><SectionHeading eyebrow="Relative strength" title="Sector performance" />{["Semiconductors", "Software & Cloud", "Consumer Electronics", "Automotive & Clean Energy"].map((sector) => { const rows = MOCK_STOCKS.filter((stock) => stock.sector === sector); const score = rows.length ? rows.reduce((sum, stock) => sum + stock.change, 0) / rows.length : 0; return <div key={sector} className="grid grid-cols-[1fr_100px_1fr] items-center gap-5 border-t border-neutral-200 py-5"><span className="text-sm font-semibold text-black">{sector}</span><span className="font-mono text-sm text-black">{score >= 0 ? "+" : ""}{score.toFixed(2)}%</span><div className="h-1 bg-neutral-200"><div className="h-full bg-black" style={{ width: `${Math.min(Math.abs(score) * 25, 100)}%` }} /></div></div>; })}</section><section><SectionHeading eyebrow="Risk lens" title="Portfolio risk assessment" /><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{[["Beta", "1.28", "28% above market"], ["VaR / 95%", "-2.34%", "Expected one-day loss"], ["Sharpe ratio", "1.84", "Risk-adjusted return"], ["Max drawdown", "-8.42%", "Peak to trough"], ["Correlation", "0.72", "Versus S&P 500"], ["Sortino ratio", "2.47", "Downside adjusted"]].map(([label, value, note]) => <Metric key={label} label={label} value={value} note={note} large />)}</div></section></div><Footer /></main></div>
  );
}

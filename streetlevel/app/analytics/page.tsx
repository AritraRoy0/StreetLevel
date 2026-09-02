"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HISTORY, STOCKS } from "@/lib/market-data";
import { Metric, SectionHeading } from "@/components/market-ui";
import { Footer } from "@/components/footer";
import { Nav, TopBar } from "@/components/nav";

function ContinuousChart({ series }: { series: { label: string; values: number[]; color: string }[] }) {
  const width = 900;
  const height = 280;

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Continuous quantitative analytics chart">
        <line x1="0" x2={width} y1="70" y2="70" stroke="#e5e5e5" />
        <line x1="0" x2={width} y1="140" y2="140" stroke="#e5e5e5" />
        <line x1="0" x2={width} y1="210" y2="210" stroke="#e5e5e5" />
        {series.map((item) => {
          const itemMin = Math.min(...item.values);
          const itemMax = Math.max(...item.values);
          const itemRange = itemMax - itemMin || 1;
          const points = item.values.map((value, index) => {
            const x = (index / Math.max(item.values.length - 1, 1)) * width;
            const y = height - ((value - itemMin) / itemRange) * (height - 20) - 10;
            return `${x},${y}`;
          }).join(" ");

          return <polyline key={item.label} points={points} fill="none" stroke={item.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <div className="flex flex-wrap gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {series.map((item) => <span key={item.label} className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-black" />{item.label}</span>)}
      </div>
    </div>
  );
}

function tabFromPathname(pathname: string) {
  if (pathname.startsWith("/analytics")) return "analytics" as const;
  return "overview" as const;
}

function AnalyticsPageContent() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSector, setSelectedSector] = useState("All sectors");
  const [selected, setSelected] = useState(STOCKS[0].symbol);
  const [metric, setMetric] = useState<"price" | "momentum" | "risk">("price");
  const sectors = ["All sectors", ...Array.from(new Set(STOCKS.map((stock) => stock.sector)))];
  const sectorStocks = selectedSector === "All sectors" ? STOCKS : STOCKS.filter((stock) => stock.sector === selectedSector);
  const stock = sectorStocks.find((item) => item.symbol === selected) ?? sectorStocks[0] ?? STOCKS[0];
  const history = HISTORY[stock.symbol] ?? [];
  const sectorChange = sectorStocks.reduce((sum, item) => sum + item.change, 0) / sectorStocks.length;
  const sectorRsi = sectorStocks.reduce((sum, item) => sum + item.signals.rsi, 0) / sectorStocks.length;
  const range = stock.high52 - stock.low52;
  const position = ((stock.price - stock.low52) / range) * 100;
  const series = metric === "price"
    ? [{ label: "Price", values: history.map((point: { price: number }) => point.price), color: "#111" }, { label: "SMA 20", values: history.map((point: { sma20: number }) => point.sma20), color: "#888" }]
    : metric === "momentum"
      ? [{ label: "RSI", values: history.map((point: { rsi: number }) => point.rsi), color: "#111" }]
      : [{ label: "Volatility", values: history.map((point: { volatility: number }) => point.volatility), color: "#111" }, { label: "Drawdown", values: history.map((point: { drawdown: number }) => point.drawdown), color: "#888" }];

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav activeTab={tabFromPathname(pathname)} sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen((open) => !open)} />
      <TopBar activeTab="analytics" onSidebarToggle={() => setSidebarOpen((open) => !open)} />
      <main className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:px-16">
        <div className="mb-10 flex items-center justify-between border-b border-neutral-300 pb-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-black" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Live research desk</span></div><div className="hidden items-center gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 md:flex"><span>NYSE / Open</span><span>14:32:08 ET</span><span>UTC -04:00</span></div></div>
        <div className="space-y-12">
          <SectionHeading eyebrow="Technical review / 180 observations" title="Analytics" />
          <div className="grid gap-4 border-y border-black py-4 md:grid-cols-[1fr_1fr_auto] md:items-center"><label className="flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sector</span><select value={selectedSector} onChange={(event) => { const next = event.target.value; const nextStocks = next === "All sectors" ? STOCKS : STOCKS.filter((item) => item.sector === next); setSelectedSector(next); setSelected(nextStocks[0]?.symbol ?? STOCKS[0].symbol); }} className="min-w-0 bg-transparent font-mono text-sm font-bold text-black outline-none">{sectors.map((sector) => <option key={sector}>{sector}</option>)}</select></label><label className="flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Stock</span><select value={stock.symbol} onChange={(event) => setSelected(event.target.value)} className="min-w-0 bg-transparent font-mono text-sm font-bold text-black outline-none">{sectorStocks.map((item) => <option key={item.symbol}>{item.symbol}</option>)}</select></label><span className="text-xs text-neutral-500">{history.length} sessions / updated 14:32:08 ET</span></div>
          <div className="grid gap-8 border-b border-black py-8 sm:grid-cols-3"><Metric label="Sector change" value={`${sectorChange >= 0 ? "+" : ""}${sectorChange.toFixed(2)}%`} note={`${sectorStocks.length} stocks in scope`} large /><Metric label="Average RSI" value={sectorRsi.toFixed(1)} note="14-period momentum" large /><Metric label="Selected stock" value={stock.symbol} note={`${stock.marketCap} market cap`} large /></div>
          <div className="border-b border-black pb-10"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Continuous series</p><p className="mt-2 text-sm text-neutral-600">Compare normalized observations across the selected window.</p></div><div className="flex border border-neutral-300 p-1">{([['price', 'Price / SMA'], ['momentum', 'RSI'], ['risk', 'Risk']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setMetric(value)} className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${metric === value ? "bg-black text-white" : "text-neutral-500 hover:text-black"}`}>{label}</button>)}</div></div><ContinuousChart series={series} /><div className="mt-4 flex justify-between text-[10px] uppercase tracking-wider text-neutral-500"><span>{history[0]?.timestamp}</span><span>{history.at(-1)?.timestamp}</span></div></div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Last price" value={`$${stock.price.toFixed(2)}`} note={`${stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}% today`} /><Metric label="RSI / 14" value={String(stock.signals.rsi)} note="Momentum oscillator" /><Metric label="52 week position" value={`${position.toFixed(0)}%`} note={`$${stock.low52.toFixed(0)} - $${stock.high52.toFixed(0)}`} /><Metric label="Z-score" value={`${stock.signals.zScore.toFixed(1)} sigma`} note="Distance from mean" /></div>
        </div>
        <Footer />
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return <AnalyticsPageContent />;
}

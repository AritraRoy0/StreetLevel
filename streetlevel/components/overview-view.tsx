"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { NewsItem, StockItem } from "@/lib/types";
import { Metric, SectionHeading, StockRow } from "@/components/market-ui";
import { StockDetailModal } from "@/components/stock-detail-modal";

function SignalBoardPreview({ stocks, onSelect }: { stocks: StockItem[]; onSelect: (stock: StockItem) => void }) {
  const [filter, setFilter] = useState("All");
  const signals = useMemo(
    () => stocks.filter((stock) => filter === "All" || stock.signals.sentiment === filter),
    [filter, stocks],
  );

  return (
    <section>
      <SectionHeading eyebrow="Signal board" title="A working list, not a feed" action="Manage rules" />
      <div className="mb-5 flex items-center justify-between border-y border-black py-3">
        <div className="flex gap-4">
          {["All", "Bullish", "Neutral", "Bearish"].map((option) => (
            <button type="button" key={option} onClick={() => setFilter(option)} className={`text-[10px] font-bold uppercase tracking-wider ${filter === option ? "text-black underline underline-offset-4" : "text-neutral-500 hover:text-black"}`}>
              {option}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-neutral-500">{signals.length} results</span>
      </div>
      <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {signals.slice(0, 9).map((stock) => (
          <button type="button" key={`${stock.symbol}-signal`} onClick={() => onSelect(stock)} className="group border-b border-neutral-200 py-5 text-left hover:border-black">
            <div className="flex items-start justify-between"><div><p className="font-mono text-sm font-bold text-black">{stock.symbol}</p><p className="mt-2 text-sm leading-5 text-neutral-600">{stock.signals.sentiment} momentum with {stock.signals.bollinger.toLowerCase()} band position.</p></div><span className="font-mono text-lg text-black">{stock.signals.zScore.toFixed(1)} sigma</span></div>
            <div className="mt-5 flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-500"><span>RSI {stock.signals.rsi}</span><span className="group-hover:text-black">Inspect <ChevronRight className="ml-1 inline h-3 w-3" /></span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function OverviewView({ stocks, news }: { stocks: StockItem[]; news: NewsItem[] }) {
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const leaders = [...stocks].sort((a, b) => b.change - a.change).slice(0, 5);
  const gainers = stocks.filter((stock) => stock.change > 0).length;

  return (
    <>
      <div className="space-y-20">
        <section className="hero-grid relative overflow-hidden border border-neutral-200 bg-[#f4f7f5] px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div className="relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-20">
            <div>
              <div className="mb-8 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                <span className="inline-flex items-center gap-2 border border-neutral-300 bg-white px-3 py-2"><span className="nav-dot h-1.5 w-1.5 rounded-full bg-[#16805b]" /> Tuesday / September 01, 2026</span>
                <span className="text-[#16805b]">Research, made useful.</span>
              </div>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-[#101512] sm:text-7xl lg:text-8xl">
                See the market before it moves.
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
                StreetLevel turns market noise into a focused view of signals, context, and decisions worth making.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/signals" className="inline-flex items-center gap-2 bg-[#101512] px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white transition-transform hover:-translate-y-0.5">
                  <Search className="h-4 w-4" /> Explore signals <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link href="/analytics" className="inline-flex items-center gap-2 border border-[#101512] bg-white/70 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-[#101512] hover:bg-white">
                  Open analytics <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#16805b]" /> Curated, not noisy</span>
                <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#16805b]" /> Built for conviction</span>
              </div>
            </div>
            <div className="relative lg:pb-2">
              <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500"><span>Live market pulse</span><span className="inline-flex items-center gap-2 text-[#16805b]"><span className="h-1.5 w-1.5 rounded-full bg-[#16805b]" /> 09:42 ET</span></div>
              <div className="border border-neutral-300 bg-white p-5 shadow-[0_18px_50px_rgba(16,21,18,0.08)] sm:p-7">
                <div className="flex items-start justify-between border-b border-neutral-200 pb-6"><div><p className="font-mono text-3xl font-medium tracking-tight text-[#101512]">S&P 500</p><p className="mt-2 text-xs text-neutral-500">Breadth is constructive</p></div><div className="text-right"><p className="font-mono text-lg font-bold text-[#16805b]">+1.24%</p><p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-400">Today</p></div></div>
                <svg viewBox="0 0 440 130" className="mt-7 h-auto w-full" role="img" aria-label="Upward market pulse chart"><path d="M0 110 C35 106 42 84 74 94 S118 82 145 87 S183 44 215 65 S254 48 282 55 S320 24 350 39 S398 12 440 18" fill="none" stroke="#16805b" strokeWidth="3" /><path d="M0 110 C35 106 42 84 74 94 S118 82 145 87 S183 44 215 65 S254 48 282 55 S320 24 350 39 S398 12 440 18 L440 130 L0 130 Z" fill="url(#pulse-fill)" opacity=".18" /><defs><linearGradient id="pulse-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#16805b" /><stop offset="1" stopColor="#16805b" stopOpacity="0" /></linearGradient></defs></svg>
                <div className="mt-5 grid grid-cols-3 gap-4 border-t border-neutral-200 pt-5"><Metric label="Advancing" value={`${gainers}`} note={`of ${stocks.length}`} /><Metric label="VIX" value="18.45" note="stable" /><Metric label="Signals" value="24" note="active" /></div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="At a glance" title="Today's operating picture" action="Open performance" />
          <div className="grid gap-0 border-y border-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
            <div className="px-0 py-6 sm:px-5 lg:px-6"><Metric label="Portfolio value" value="$73,013" note="+$1,245.80 / +1.74% today" large /></div>
            <div className="border-t border-neutral-200 px-0 py-6 sm:border-l sm:px-5 lg:px-6"><Metric label="Active signals" value="24" note="4 high-conviction setups" large /></div>
            <div className="border-t border-neutral-200 px-0 py-6 lg:border-l lg:px-5 lg:px-6"><Metric label="Coverage" value={`${stocks.length} names`} note="Feed latency under 150ms" large /></div>
            <div className="border-t border-neutral-200 px-0 py-6 sm:border-l sm:px-5 lg:px-6"><Metric label="Open alerts" value="12" note="2 require review" large /></div>
          </div>
        </section>

        <section className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <SectionHeading eyebrow="Momentum" title="Leaders in motion" action="View all names" />
            <div className="border-t border-black">
              <div className="hidden grid-cols-[1.1fr_1fr_0.8fr_1fr_28px] gap-4 border-b border-neutral-300 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500 sm:grid">
                <span>Asset</span>
                <span>Last / volume</span>
                <span>Change</span>
                <span>Trend</span>
                <span />
              </div>
              {leaders.map((stock) => (
                <StockRow key={`${stock.symbol}-${stock.price}`} stock={stock} onSelect={setSelectedStock} />
              ))}
            </div>
          </div>
          <div>
            <SectionHeading eyebrow="The wire" title="What changed" action="Read all" />
            <div className="divide-y divide-neutral-200 border-y border-black">
              {news.slice(0, 5).map((item) => (
                <article key={item.id} className="py-5">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <span>{item.source}</span>
                    <span>{item.time}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-5 text-black">{item.title}</h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-neutral-500">{item.relatedSymbol}</span>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{item.category}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SignalBoardPreview stocks={stocks} onSelect={setSelectedStock} />
      </div>

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />}
    </>
  );
}

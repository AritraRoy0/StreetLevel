"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, Search } from "lucide-react";
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
      <div className="space-y-16">
        <section className="grid gap-10 border-b border-black pb-12 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
          <div>
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500">
              Tuesday / September 01, 2026
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-black sm:text-7xl">
              A clearer view of the market.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">
              StreetLevel turns market noise into a short list of signals, context, and decisions worth making.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-neutral-800"
              >
                <Search className="h-4 w-4" />
                Explore signals
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 border border-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-black hover:bg-black hover:text-white"
              >
                <Download className="h-4 w-4" />
                Export brief
              </button>
            </div>
          </div>
          <div className="self-end border-l border-black pl-6 lg:pl-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Market note / 09:42 ET</p>
            <p className="mt-5 text-xl font-medium leading-8 text-black">
              Breadth is constructive, but leadership remains concentrated in semiconductors.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <Metric label="Breadth" value={`${gainers}/${stocks.length}`} note="symbols advancing" />
              <Metric label="Volatility" value="18.45" note="VIX index" />
            </div>
          </div>
        </section>

        <section>
          <SectionHeading eyebrow="At a glance" title="Today's operating picture" action="Open performance" />
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Portfolio value" value="$73,013" note="+$1,245.80 / +1.74% today" large />
            <Metric label="Active signals" value="24" note="4 high-conviction setups" large />
            <Metric label="Coverage" value={`${stocks.length} names`} note="Feed latency under 150ms" large />
            <Metric label="Open alerts" value="12" note="2 require review" large />
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

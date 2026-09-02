"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Footer } from "@/components/footer";
import { Nav, TopBar } from "@/components/nav";
import { SectionHeading } from "@/components/market-ui";
import { STOCKS } from "@/lib/market-data";

export default function SignalsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filter, setFilter] = useState("All");
  const signals = useMemo(() => STOCKS.filter((stock) => filter === "All" || stock.signals.sentiment === filter), [filter]);

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav activeTab="signals" sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen((open) => !open)} />
      <TopBar activeTab="signals" onSidebarToggle={() => setSidebarOpen((open) => !open)} />
      <main className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:px-16">
        <div className="mb-10 flex items-center justify-between border-b border-neutral-300 pb-4"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-black" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">Live research desk</span></div><div className="hidden items-center gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 md:flex"><span>NYSE / Open</span><span>14:32:08 ET</span><span>UTC -04:00</span></div></div>
        <div className="space-y-10"><SectionHeading eyebrow="Rules / 12 active" title="Signals" action="New rule" /><div className="flex items-center justify-between border-y border-black py-4"><p className="text-sm text-neutral-600">Rules watch price, moving averages, and abnormal volume across your coverage.</p><button type="button" className="inline-flex items-center gap-2 bg-black px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"><Plus className="h-4 w-4" /> Create rule</button></div><div className="mb-5 flex items-center justify-between border-y border-black py-3"><div className="flex gap-4">{["All", "Bullish", "Neutral", "Bearish"].map((option) => <button type="button" key={option} onClick={() => setFilter(option)} className={`text-[10px] font-bold uppercase tracking-wider ${filter === option ? "text-black underline underline-offset-4" : "text-neutral-500 hover:text-black"}`}>{option}</button>)}</div><span className="font-mono text-[10px] text-neutral-500">{signals.length} results</span></div><div className="divide-y divide-neutral-200 border-b border-black">{signals.slice(0, 8).map((stock, index) => <div key={`${stock.symbol}-alert`} className="grid gap-4 py-5 sm:grid-cols-[1fr_1.5fr_0.7fr_24px] sm:items-center"><div><p className="font-mono text-sm font-bold text-black">{stock.symbol}</p><p className="mt-1 text-xs text-neutral-500">Rule SL-{String(index + 1).padStart(3, "0")}</p></div><p className="text-sm text-black">Notify when price {index % 2 === 0 ? "moves above" : "crosses 50 day average"}</p><span className="text-xs font-bold uppercase tracking-wider text-neutral-500">{index < 5 ? "Active" : "Paused"}</span><button type="button" aria-label={`More options for ${stock.symbol}`}><MoreHorizontal className="h-4 w-4 text-neutral-500" /></button></div>)}</div></div>
        <Footer />
      </main>
    </div>
  );
}

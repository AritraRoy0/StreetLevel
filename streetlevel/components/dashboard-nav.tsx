"use client";

import { Bell, Menu } from "lucide-react";
import type { TabType } from "@/lib/types";

type Props = { activeTab: TabType; sidebarOpen: boolean; onTabChange: (tab: TabType) => void; onSidebarToggle: () => void };
const items: { id: TabType; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "watchlist", label: "Watchlist" }, { id: "analytics", label: "Analytics" }, { id: "signals", label: "Signals" },
  { id: "performance", label: "Performance" }, { id: "insights", label: "Insights" }, { id: "portfolio", label: "Portfolio" }, { id: "settings", label: "Settings" },
];

export function DashboardNav({ activeTab, sidebarOpen, onTabChange, onSidebarToggle }: Props) {
  return <nav aria-label="Primary navigation" className="border-b border-black bg-white">
    <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-5 px-5 sm:px-10 lg:px-16">
      <div className="flex shrink-0 items-center gap-3 border-r border-black pr-5"><span className="flex h-9 w-9 items-center justify-center bg-black font-mono text-xs font-bold text-white">SL</span><span className="hidden text-xs font-bold uppercase tracking-[0.2em] sm:inline">StreetLevel</span></div>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{items.map((item, index) => <button key={item.id} onClick={() => onTabChange(item.id)} aria-current={activeTab === item.id ? "page" : undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === item.id ? "border-black text-black" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-black"}`}><span className="font-mono text-[9px] opacity-50">{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</div>
      <div className="hidden items-center gap-3 border-l border-black pl-5 md:flex"><span className="font-mono text-[10px] text-neutral-500">AR / PRO</span><button onClick={onSidebarToggle} aria-label="Toggle navigation density" className="text-neutral-500 hover:text-black"><Menu className={`h-4 w-4 ${sidebarOpen ? "" : "rotate-90"}`} /></button></div>
    </div>
  </nav>;
}

export function DashboardTopBar({ activeTab, onSidebarToggle }: Pick<Props, "activeTab" | "onSidebarToggle">) {
  return <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-neutral-300 bg-white/95 px-5 backdrop-blur sm:px-10"><div className="flex items-center gap-4"><button onClick={onSidebarToggle} aria-label="Toggle navigation" className="lg:hidden"><Menu className="h-5 w-5" /></button><span className="font-mono text-sm font-bold uppercase tracking-wider">{activeTab}</span></div><div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500"><span className="hidden sm:inline">NYSE open / feed live</span><button aria-label="Open notifications" className="relative"><Bell className="h-4 w-4 text-black" /><span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-black" /></button></div></header>;
}

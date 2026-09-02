"use client";

import Link from "next/link";
import { Bell, LayoutDashboard, LineChart, Menu, TrendingUp, Zap } from "lucide-react";
import type { ComponentType } from "react";
import type { TabType } from "@/lib/types";

type NavigationItem = {
  id: TabType;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type NavProps = {
  activeTab: TabType;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
};

type TopBarProps = {
  activeTab: TabType;
  onSidebarToggle: () => void;
};

const items: NavigationItem[] = [
  { id: "overview", label: "Overview", href: "/", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: LineChart },
  { id: "signals", label: "Signals", href: "/signals", icon: Zap },
  { id: "performance", label: "Performance", href: "/performance", icon: TrendingUp },
];

export function Nav({ activeTab, sidebarOpen, onSidebarToggle }: NavProps) {
  return (
    <nav aria-label="Primary navigation" className="border-b border-[#27322d] bg-[#101512] text-white">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-5 px-5 sm:px-10 lg:px-16">
        <Link href="/" className="flex shrink-0 items-center gap-3 border-r border-white/20 pr-5">
          <span className="flex h-9 w-9 items-center justify-center bg-[#c5f4df] font-mono text-xs font-bold text-[#101512]">SL</span>
          <span className="hidden text-xs font-bold uppercase tracking-[0.2em] sm:inline">StreetLevel</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item relative flex shrink-0 items-center gap-2 overflow-hidden border-b-2 px-3 py-5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  active ? "border-[#c5f4df] bg-[#c5f4df] text-[#101512]" : "border-transparent text-neutral-400 hover:border-[#c5f4df]/50 hover:text-white"
                }`}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <span className="nav-sweep" aria-hidden="true" />
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10 hidden sm:inline">{item.label}</span>
                <span className="relative z-10 sm:hidden">{String(index + 1).padStart(2, "0")}</span>
              </Link>
            );
          })}
        </div>
        <div className="hidden items-center gap-3 border-l border-white/20 pl-5 md:flex">
          <span className="font-mono text-[10px] text-neutral-400">AR / PRO</span>
          <button
            type="button"
            onClick={onSidebarToggle}
            aria-label="Toggle navigation density"
            className={`text-neutral-400 transition-transform hover:text-white ${sidebarOpen ? "" : "rotate-90"}`}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

export function TopBar({ activeTab, onSidebarToggle }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-neutral-300 bg-white/95 px-5 backdrop-blur sm:px-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onSidebarToggle}
          aria-label="Toggle navigation"
          className="flex h-10 w-10 items-center justify-center border border-neutral-300 text-neutral-600 hover:bg-black hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 sm:block">Workspace</p>
          <h1 className="font-mono text-sm font-bold uppercase tracking-wider text-black sm:text-lg">{activeTab}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 border border-neutral-300 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-black" />
          NYSE open / feed live
        </div>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative flex h-10 w-10 items-center justify-center border border-neutral-300 text-neutral-600 hover:bg-black hover:text-white"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black" />
        </button>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import { Footer } from "@/components/footer";
import { Nav, TopBar } from "@/components/nav";
import { OverviewView } from "@/components/overview-view";
import { MOCK_NEWS } from "@/lib/mock-data";
import { STOCKS } from "@/lib/market-data";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-white text-black">
      <Nav
        activeTab="overview"
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((open) => !open)}
      />
      <TopBar
        activeTab="overview"
        onSidebarToggle={() => setSidebarOpen((open) => !open)}
      />
      <main className="mx-auto max-w-[1500px] px-5 py-10 sm:px-10 lg:px-16">
        <div className="mb-10 flex items-center justify-between border-b border-neutral-300 pb-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-black" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
              Live research desk
            </span>
          </div>
          <div className="hidden items-center gap-5 text-[10px] font-bold uppercase tracking-wider text-neutral-500 md:flex">
            <span>NYSE / Open</span>
            <span>14:32:08 ET</span>
            <span>UTC -04:00</span>
          </div>
        </div>
        <OverviewView stocks={STOCKS} news={MOCK_NEWS} />
        <Footer />
      </main>
    </div>
  );
}

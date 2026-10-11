"use client";

/**
 * Switches between the backtest workspace and the cross-sectional comparison.
 *
 * The cross-section is rendered on the server and passed in as children, so
 * choosing a tab does not re-run any of its work. Only the backtest workspace
 * is interactive, and it keeps its own state in the URL.
 *
 * The chosen view is in the URL too, as `view=cross`, so a link to the
 * cross-section opens on it and a reload does not bounce the reader back to the
 * backtest. It is written with `history.replaceState`, which Next's router
 * observes, so the strategy parameters already in the query survive the switch.
 */

import { useState, type ReactNode } from "react";
import { BacktestWorkspace } from "@/components/backtest/backtest-workspace";
import { Tabs } from "@/components/ui";
import type { Bar } from "@/lib/analytics";

export type PerformanceView = "backtest" | "cross_section";

export function PerformanceTabs({
  priceBook,
  symbols,
  compositeBars,
  datasetNote,
  initialQuery,
  initialView,
  crossSection,
}: {
  priceBook: Record<string, Bar[]>;
  symbols: string[];
  compositeBars: Bar[];
  datasetNote: string;
  /** The page's query string, parsed on the server and passed down. */
  initialQuery: string;
  initialView: PerformanceView;
  crossSection?: ReactNode;
}) {
  const [tab, setTab] = useState<PerformanceView>(initialView);

  const change = (next: PerformanceView) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "cross_section") url.searchParams.set("view", "cross");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <div className="space-y-6">
      <Tabs
        idPrefix="performance"
        label="Performance view"
        value={tab}
        onChange={change}
        tabs={[
          { value: "backtest", label: "Backtest", hint: "Simulate a rule under stated costs" },
          { value: "cross_section", label: "Cross-section", hint: "Every name against the composite" },
        ]}
      />

      <div role="tabpanel" id="performance-panel" aria-labelledby={`performance-tab-${tab}`}>
        {tab === "backtest" ? (
          <BacktestWorkspace
            priceBook={priceBook}
            symbols={symbols}
            compositeBars={compositeBars}
            datasetNote={datasetNote}
            initialQuery={initialQuery}
          />
        ) : (
          crossSection
        )}
      </div>
    </div>
  );
}

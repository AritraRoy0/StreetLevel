"use client";

/**
 * Switches between the backtest workspace and the cross-sectional comparison.
 *
 * The cross-section is rendered on the server and passed in as children, so
 * choosing a tab does not re-run any of its work. Only the backtest workspace
 * is interactive, and it keeps its own state in the URL.
 */

import { useState, type ReactNode } from "react";
import { BacktestWorkspace } from "@/components/backtest/backtest-workspace";
import { Segmented } from "@/components/ui";
import type { Bar } from "@/lib/analytics";

type Tab = "backtest" | "cross_section";

export function PerformanceTabs({
  priceBook,
  symbols,
  compositeBars,
  datasetNote,
  initialQuery,
  crossSection,
}: {
  priceBook: Record<string, Bar[]>;
  symbols: string[];
  compositeBars: Bar[];
  datasetNote: string;
  /** The page's query string, parsed on the server and passed down. */
  initialQuery: string;
  crossSection?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("backtest");

  return (
    <div className="space-y-6">
      <Segmented
        label="Performance view"
        value={tab}
        onChange={setTab}
        options={[
          { value: "backtest", label: "Backtest" },
          { value: "cross_section", label: "Cross-section" },
        ]}
      />

      {tab === "backtest" ? (
        <BacktestWorkspace
          priceBook={priceBook}
          symbols={symbols}
          compositeBars={compositeBars}
          datasetNote={datasetNote}
          initialQuery={initialQuery}
        />
      ) : (
        <div>{crossSection}</div>
      )}
    </div>
  );
}

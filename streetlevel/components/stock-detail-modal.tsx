"use client";

import { ChevronRight, X } from "lucide-react";
import type { StockItem } from "@/lib/types";
import { Metric } from "@/components/market-ui";

export function StockDetailModal({
  stock,
  onClose,
}: {
  stock: StockItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div className="w-full max-w-xl bg-white p-7 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-black pb-6">
          <div>
            <p className="font-mono text-sm font-bold">{stock.symbol}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{stock.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close detail">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-7 py-7 sm:grid-cols-2">
          <Metric
            label="Last price"
            value={`$${stock.price.toFixed(2)}`}
            note={`${stock.changeAmount >= 0 ? "+" : ""}$${stock.changeAmount.toFixed(2)} today`}
            large
          />
          <Metric label="Signal" value={stock.signals.sentiment} note={`Z-score ${stock.signals.zScore.toFixed(1)} sigma`} large />
          <Metric label="RSI / 14" value={String(stock.signals.rsi)} note="Momentum oscillator" />
          <Metric label="P/E ratio" value={stock.peRatio.toFixed(1)} note={stock.sector} />
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-between border border-black px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-black hover:text-white"
        >
          Open full analysis
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

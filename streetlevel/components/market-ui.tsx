"use client";

import { ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import type { StockItem } from "@/lib/types";

export function Sparkline({ values, dark = false }: { values: number[]; dark?: boolean }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${30 - ((value - min) / range) * 25}`)
    .join(" ");

  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={dark ? "#fff" : "#111"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Change({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-black">
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-black">{title}</h2>
      </div>
      {action && (
        <button className="hidden items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:text-black sm:flex">
          {action}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
  large = false,
}: {
  label: string;
  value: string;
  note: string;
  large?: boolean;
}) {
  return (
    <div className="border-t border-black pt-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className={`mt-3 font-mono font-medium tracking-tight text-black ${large ? "text-4xl" : "text-2xl"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-neutral-500">{note}</p>
    </div>
  );
}

export function StockRow({ stock, onSelect }: { stock: StockItem; onSelect: (stock: StockItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(stock)}
      className="grid w-full grid-cols-[1.1fr_1fr_0.8fr_1fr_28px] items-center gap-4 border-b border-neutral-200 py-4 text-left transition-colors hover:bg-neutral-100"
    >
      <div>
        <p className="font-mono text-sm font-bold text-black">{stock.symbol}</p>
        <p className="mt-1 truncate text-xs text-neutral-500">{stock.name}</p>
      </div>
      <div>
        <p className="font-mono text-sm text-black">${stock.price.toFixed(2)}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">{stock.volume} vol</p>
      </div>
      <Change value={stock.change} />
      <Sparkline values={stock.sparkline} />
      <ChevronRight className="h-4 w-4 text-neutral-400" />
    </button>
  );
}

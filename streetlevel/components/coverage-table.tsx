"use client";

/**
 * The coverage table: one row per symbol with its last price, change,
 * volatility, momentum reading and a trend glyph.
 *
 * Sorting is client-side, so this is a client component and its props cross
 * the server boundary as serialized JSON. It therefore takes the flattened
 * `CoverageRow` rather than a full analytics summary; the mapper that produces
 * it lives in `coverage-row.ts` so the server can call it.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta, Td, Th, TableScroll } from "@/components/ui";
import { EMPTY, formatPercent, formatPoints, formatPrice, formatVolume } from "@/lib/analytics";
import type { CoverageRow } from "@/components/coverage-row";
import { cn } from "@/lib/utils";

type SortKey = "symbol" | "lastPrice" | "sessionChange" | "periodReturn" | "volatility" | "rsi" | "volume";

const COLUMNS: Array<{ key: SortKey; label: string; align: "left" | "right"; hideBelow?: "sm" | "md" }> = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "lastPrice", label: "Last", align: "right" },
  { key: "sessionChange", label: "Session", align: "right" },
  { key: "periodReturn", label: "1Y", align: "right" },
  { key: "volatility", label: "Vol", align: "right", hideBelow: "md" },
  { key: "rsi", label: "RSI", align: "right", hideBelow: "md" },
  { key: "volume", label: "Volume", align: "right", hideBelow: "sm" },
];

export function CoverageTable({ rows, className }: { rows: CoverageRow[]; className?: string }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "sessionChange",
    direction: "desc",
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort.key === "symbol") {
        const result = a.symbol.localeCompare(b.symbol);
        return sort.direction === "asc" ? result : -result;
      }
      const left = a[sort.key];
      const right = b[sort.key];
      // Unavailable values always sort last, whichever direction is active.
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return sort.direction === "asc" ? left - right : right - left;
    });
    return copy;
  }, [rows, sort]);

  const toggle = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "symbol" ? "asc" : "desc" },
    );
  };

  return (
    <TableScroll className={className}>
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <Th
                key={column.key}
                align={column.align}
                className={cn(
                  column.hideBelow === "sm" && "hidden sm:table-cell",
                  column.hideBelow === "md" && "hidden md:table-cell",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  aria-label={`Sort by ${column.label}`}
                  className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-ink"
                >
                  {column.label}
                  <span
                    aria-hidden="true"
                    className={cn("text-[8px]", sort.key === column.key ? "text-ink" : "text-transparent")}
                  >
                    {sort.direction === "asc" ? "▲" : "▼"}
                  </span>
                </button>
              </Th>
            ))}
            <Th align="right" className="hidden lg:table-cell">
              1Y trend
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.symbol} className="transition-colors hover:bg-sunken">
              <Td>
                <Link href={`/analytics/${row.symbol}`} className="block">
                  <span className="font-mono text-[12px] font-semibold text-ink">{row.symbol}</span>
                  <span className="mt-0.5 block max-w-[180px] truncate text-[11px] text-muted">{row.name}</span>
                </Link>
              </Td>
              <Td align="right">{formatPrice(row.lastPrice)}</Td>
              <Td align="right">
                <Delta value={row.sessionChange} />
              </Td>
              <Td align="right">
                <Delta value={row.periodReturn} />
              </Td>
              <Td align="right" className="hidden md:table-cell">
                {formatPercent(row.volatility)}
              </Td>
              <Td align="right" className="hidden md:table-cell">
                <span
                  className={cn(
                    row.rsiZone === "overbought" && "text-neg",
                    row.rsiZone === "oversold" && "text-accent",
                  )}
                >
                  {row.rsi === null ? EMPTY : formatPoints(row.rsi)}
                </span>
              </Td>
              <Td align="right" className="hidden sm:table-cell">
                {formatVolume(row.volume)}
              </Td>
              <Td align="right" className="hidden lg:table-cell">
                <div className="flex justify-end">
                  <Sparkline values={row.spark} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

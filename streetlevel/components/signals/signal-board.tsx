"use client";

/**
 * The interactive half of the signals page: the active-condition list with a
 * filter by rule, and the screen with sortable columns.
 *
 * The conditions themselves are evaluated on the server from the same
 * summaries the analytics pages render, and arrive here as plain rows. The
 * counts above the list used to be static badges that looked like filters and
 * did nothing when pressed; they are filters now.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { LinkRow } from "@/components/link-row";
import {
  Badge,
  Delta,
  EmptyState,
  Panel,
  PanelHeader,
  TableScroll,
  Td,
  Th,
  type SortDirection,
  type Tone,
} from "@/components/ui";
import { EMPTY, formatDate, formatPercent, formatPoints, formatPrice } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export interface SignalItem {
  symbol: string;
  name: string;
  rule: string;
  detail: string;
  tone: Tone;
  timestamp: string | null;
}

export interface ScreenRow {
  symbol: string;
  name: string;
  last: number | null;
  rsi: number | null;
  percentB: number | null;
  vsSma50: number | null;
  drawdown: number | null;
  spark: number[];
}

type ScreenKey = "symbol" | "last" | "rsi" | "percentB" | "vsSma50" | "drawdown";

const SCREEN_COLUMNS: Array<{ key: ScreenKey; label: string; align: "left" | "right"; hide?: string }> = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "last", label: "Last", align: "right", hide: "hidden sm:table-cell" },
  { key: "rsi", label: "RSI", align: "right" },
  { key: "percentB", label: "%B", align: "right", hide: "hidden md:table-cell" },
  { key: "vsSma50", label: "vs SMA 50", align: "right" },
  { key: "drawdown", label: "Drawdown", align: "right" },
];

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-hairline-strong",
  positive: "bg-pos",
  negative: "bg-neg",
  warning: "bg-warn",
  accent: "bg-accent",
};

export function SignalBoard({
  signals,
  screen,
  universe,
}: {
  signals: SignalItem[];
  screen: ScreenRow[];
  universe: number;
}) {
  const [rule, setRule] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: ScreenKey; direction: SortDirection }>({ key: "rsi", direction: "desc" });

  const rules = useMemo(() => {
    const counts = new Map<string, { count: number; tone: Tone }>();
    for (const signal of signals) {
      const entry = counts.get(signal.rule);
      counts.set(signal.rule, { count: (entry?.count ?? 0) + 1, tone: signal.tone });
    }
    return Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [signals]);

  const visible = rule ? signals.filter((signal) => signal.rule === rule) : signals;

  const sortedScreen = useMemo(() => {
    const copy = [...screen];
    copy.sort((a, b) => {
      if (sort.key === "symbol") {
        const result = a.symbol.localeCompare(b.symbol);
        return sort.direction === "asc" ? result : -result;
      }
      const left = a[sort.key];
      const right = b[sort.key];
      if (left === null && right === null) return 0;
      if (left === null) return 1;
      if (right === null) return -1;
      return sort.direction === "asc" ? left - right : right - left;
    });
    return copy;
  }, [screen, sort]);

  const toggleSort = (key: ScreenKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "symbol" ? "asc" : "desc" },
    );

  return (
    <div className="space-y-8 sm:space-y-10">
      <Panel>
        <PanelHeader
          title="Active conditions"
          eyebrow={
            rule
              ? `${visible.length} of ${signals.length} · filtered to ${rule.toLowerCase()}`
              : `${signals.length} across ${universe} names`
          }
        />

        {rules.length > 0 && (
          <div
            role="group"
            aria-label="Filter by rule"
            className="scrollbar-none fade-end fade-end-sm-none flex gap-1.5 overflow-x-auto border-b border-hairline px-4 py-2.5 sm:flex-wrap"
          >
            <FilterChip active={rule === null} onClick={() => setRule(null)} count={signals.length}>
              All rules
            </FilterChip>
            {rules.map(([name, { count, tone }]) => (
              <FilterChip
                key={name}
                active={rule === name}
                onClick={() => setRule((current) => (current === name ? null : name))}
                count={count}
                dot={TONE_DOT[tone]}
              >
                {name}
              </FilterChip>
            ))}
          </div>
        )}

        {signals.length === 0 ? (
          <EmptyState
            title="Nothing is triggering"
            description="Conditions are re-evaluated whenever the dataset updates."
          />
        ) : (
          <TableScroll>
            <table className="w-full border-collapse md:min-w-[760px]">
              <thead>
                <tr>
                  <Th>Symbol</Th>
                  <Th>Rule</Th>
                  <Th className="hidden md:table-cell">Detail</Th>
                  <Th align="right" className="hidden sm:table-cell">
                    As of
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((signal) => (
                  <LinkRow key={`${signal.symbol}-${signal.rule}`} href={`/analytics/${signal.symbol}`}>
                    <Td className="align-top">
                      <Link href={`/analytics/${signal.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                        {signal.symbol}
                      </Link>
                      <span className="mt-0.5 block max-w-[160px] truncate text-[11px] text-muted">{signal.name}</span>
                    </Td>
                    <Td className="align-top whitespace-normal">
                      <Badge tone={signal.tone}>{signal.rule}</Badge>
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-muted md:hidden">
                        {signal.detail}
                      </span>
                    </Td>
                    <Td className="hidden max-w-[460px] whitespace-normal align-top leading-relaxed md:table-cell">
                      {signal.detail}
                    </Td>
                    <Td align="right" className="hidden align-top sm:table-cell">
                      {formatDate(signal.timestamp)}
                    </Td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Screen"
          eyebrow="Every covered name, one year of history"
          actions={<span className="hidden text-[11px] text-muted sm:inline">Headers sort the table</span>}
        />
        <TableScroll>
          <table className="w-full border-collapse md:min-w-[720px]">
            <caption className="sr-only">
              Screen of covered names, sorted by {SCREEN_COLUMNS.find((column) => column.key === sort.key)?.label}{" "}
              {sort.direction === "asc" ? "ascending" : "descending"}.
            </caption>
            <thead>
              <tr>
                {SCREEN_COLUMNS.map((column) => (
                  <Th
                    key={column.key}
                    align={column.align}
                    className={column.hide}
                    sort={sort.key === column.key ? sort.direction : null}
                    onSort={() => toggleSort(column.key)}
                  >
                    {column.label}
                  </Th>
                ))}
                <Th align="right" className="hidden lg:table-cell">
                  3M trend
                </Th>
              </tr>
            </thead>
            <tbody>
              {sortedScreen.map((row) => (
                <LinkRow key={row.symbol} href={`/analytics/${row.symbol}`}>
                  <Td>
                    <Link href={`/analytics/${row.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                      {row.symbol}
                    </Link>
                    <span className="mt-0.5 hidden max-w-[180px] truncate text-[11px] text-muted sm:block">{row.name}</span>
                  </Td>
                  <Td align="right" className="hidden sm:table-cell">
                    {formatPrice(row.last)}
                  </Td>
                  <Td align="right">
                    <span className={cn(row.rsi !== null && row.rsi >= 70 && "text-neg", row.rsi !== null && row.rsi <= 30 && "text-accent")}>
                      {row.rsi === null ? EMPTY : formatPoints(row.rsi)}
                    </span>
                  </Td>
                  <Td align="right" className="hidden md:table-cell">
                    {row.percentB === null ? EMPTY : formatPercent(row.percentB, { digits: 0 })}
                  </Td>
                  <Td align="right">
                    <Delta value={row.vsSma50} />
                  </Td>
                  <Td align="right">
                    <Delta value={row.drawdown} showSign={false} />
                  </Td>
                  <Td align="right" className="hidden lg:table-cell">
                    <div className="flex justify-end">
                      <Sparkline values={row.spark} width={72} height={22} />
                    </div>
                  </Td>
                </LinkRow>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  count,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap border px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        active ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-muted hover:border-hairline-strong hover:text-ink",
      )}
    >
      {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
      <span className={cn("font-mono tabular-nums", active ? "text-surface/70" : "text-faint")}>{count}</span>
    </button>
  );
}

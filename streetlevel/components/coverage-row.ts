/**
 * The row shape the coverage table renders, and the mapper that produces it.
 *
 * This lives outside the table component because the table is a client
 * component, and a function exported from a `"use client"` module cannot be
 * called on the server. Keeping the mapper here lets the server flatten the
 * analytics summaries before they cross the boundary, which is the whole point
 * of the flattening: a full summary carries every bar and all seventeen
 * indicator series, and shipping ten of them to the browser to draw a ten-row
 * table cost roughly 1.6 MB of payload.
 */

import type { AnalyticsSummary } from "@/lib/analytics";
import type { SymbolProfile } from "@/lib/market-data";

export interface CoverageRow {
  symbol: string;
  name: string;
  sector: string;
  lastPrice: number | null;
  sessionChange: number | null;
  periodReturn: number | null;
  volatility: number | null;
  rsi: number | null;
  rsiZone: "overbought" | "oversold" | "neutral" | null;
  volume: number | null;
  /** Closes for the trend glyph only, trimmed to what it can actually draw. */
  spark: number[];
}

export function toCoverageRow(
  symbol: string,
  profile: SymbolProfile,
  summary: AnalyticsSummary,
  sparkPoints = 48,
): CoverageRow {
  return {
    symbol,
    name: profile.name,
    sector: profile.sector,
    lastPrice: summary.lastPrice,
    sessionChange: summary.lastChangePercent,
    periodReturn: summary.periodReturn,
    volatility: summary.volatility.annualized,
    rsi: summary.rsi.value,
    rsiZone: summary.rsi.zone,
    volume: summary.volume.latest,
    spark: summary.bars.slice(-sparkPoints).map((bar) => Number(bar.adjClose.toFixed(2))),
  };
}

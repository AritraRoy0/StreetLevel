/**
 * Head-to-head comparisons between covered names.
 *
 * Every figure comes from the same one-year snapshots the overview and the
 * analytics pages render, so a return quoted on a comparison page is the one
 * the symbol's own page shows.
 */

import { buildPairs, canonicalPair, parsePairSlug } from "@/lib/compare-pairs";
import type { ComparisonPair } from "@/lib/compare-pairs";
import { COMPOSITE_BARS, COMPOSITE_SYMBOL, SNAPSHOTS, SYMBOLS, getProfile } from "@/lib/market-data";
import type { SymbolProfile } from "@/lib/market-data";
import { compareToBenchmark } from "@/lib/analytics";
import type { AnalyticsSummary, ComparisonResult } from "@/lib/analytics";

export type { ComparisonPair } from "@/lib/compare-pairs";

/** Covered names, largest company first: the order a pair's title is written in. */
export const COMPARISON_ORDER: string[] = [...SYMBOLS].sort(
  (a, b) => getProfile(b).marketCap - getProfile(a).marketCap,
);

export const COMPARISON_PAIRS: ComparisonPair[] = buildPairs(COMPARISON_ORDER);

/** Matchups people commonly search for, surfaced on the overview and in the footer. */
export const POPULAR_PAIRS: ComparisonPair[] = [
  ["NVDA", "AMD"],
  ["AAPL", "MSFT"],
  ["GOOGL", "META"],
  ["MSFT", "GOOGL"],
  ["NVDA", "AVGO"],
  ["MSFT", "AMZN"],
  ["AAPL", "NVDA"],
  ["TSLA", "PLTR"],
]
  .map(([a, b]) => canonicalPair(a, b, COMPARISON_ORDER))
  .filter((pair): pair is ComparisonPair => pair !== null);

/** Every pair that includes `symbol`, ordered by the other name's size. */
export function pairsWith(symbol: string): ComparisonPair[] {
  return COMPARISON_ORDER.filter((other) => other !== symbol)
    .map((other) => canonicalPair(symbol, other, COMPARISON_ORDER))
    .filter((pair): pair is ComparisonPair => pair !== null);
}

/**
 * Resolves a URL slug. `canonical` is false for the reversed order, which the
 * page redirects to the canonical slug.
 */
export function resolvePairSlug(slug: string): { pair: ComparisonPair; canonical: boolean } | null {
  const parsed = parsePairSlug(slug);
  if (!parsed) return null;
  const pair = canonicalPair(parsed.first, parsed.second, COMPARISON_ORDER);
  if (!pair) return null;
  return { pair, canonical: pair.slug === slug };
}

/** Every slug the comparison route answers, the reversed orders included so they can redirect. */
export function allPairSlugs(): string[] {
  return COMPARISON_PAIRS.flatMap((pair) => [pair.slug, `${pair.second.toLowerCase()}-vs-${pair.first.toLowerCase()}`]);
}

export interface HeadToHead {
  pair: ComparisonPair;
  firstProfile: SymbolProfile;
  secondProfile: SymbolProfile;
  first: AnalyticsSummary;
  second: AnalyticsSummary;
  /** The first name measured against the second over their shared sessions. */
  comparison: ComparisonResult;
  /** Each name against the equal-weight composite, for beta to the coverage list. */
  firstVsComposite: ComparisonResult;
  secondVsComposite: ComparisonResult;
}

export function buildHeadToHead(pair: ComparisonPair): HeadToHead {
  const first = SNAPSHOTS[pair.first];
  const second = SNAPSHOTS[pair.second];
  return {
    pair,
    firstProfile: getProfile(pair.first),
    secondProfile: getProfile(pair.second),
    first,
    second,
    comparison: compareToBenchmark(first.bars, second.bars, {
      baseSymbol: pair.first,
      benchmarkSymbol: pair.second,
    }),
    firstVsComposite: compareToBenchmark(first.bars, COMPOSITE_BARS, {
      baseSymbol: pair.first,
      benchmarkSymbol: COMPOSITE_SYMBOL,
    }),
    secondVsComposite: compareToBenchmark(second.bars, COMPOSITE_BARS, {
      baseSymbol: pair.second,
      benchmarkSymbol: COMPOSITE_SYMBOL,
    }),
  };
}

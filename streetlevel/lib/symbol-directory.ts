/**
 * The symbol directory: one small row per covered name, for navigation.
 *
 * The navigation is a client component, and the price book it would otherwise
 * derive this from is over a megabyte. So the server flattens what search and
 * the symbol switcher need, a name and a latest move, into a list of a few
 * hundred bytes and hands that across instead.
 */

import { COMPOSITE_BARS, COMPOSITE_SYMBOL, SYMBOL_ROWS, getProfile } from "@/lib/market-data";

export interface DirectoryEntry {
  symbol: string;
  name: string;
  sector: string;
  last: number | null;
  /** Latest session's change as a fraction. */
  change: number | null;
}

function compositeEntry(): DirectoryEntry {
  const last = COMPOSITE_BARS[COMPOSITE_BARS.length - 1];
  const previous = COMPOSITE_BARS[COMPOSITE_BARS.length - 2];
  const profile = getProfile(COMPOSITE_SYMBOL);
  return {
    symbol: COMPOSITE_SYMBOL,
    name: profile.name,
    sector: profile.sector,
    last: last ? last.close : null,
    change: last && previous && previous.close > 0 ? last.close / previous.close - 1 : null,
  };
}

export const SYMBOL_DIRECTORY: DirectoryEntry[] = [
  ...SYMBOL_ROWS.map((row) => ({
    symbol: row.symbol,
    name: row.profile.name,
    sector: row.profile.sector,
    last: row.summary.lastPrice,
    change: row.summary.lastChangePercent,
  })),
  compositeEntry(),
];

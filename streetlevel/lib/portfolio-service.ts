/**
 * Portfolio analytics, computed once per process.
 *
 * The transaction log and the price book are both static for the lifetime of
 * the process, so the replay is memoized rather than repeated on every render.
 * The memo deliberately has no time-to-live: there is no clock-driven input, so
 * an expiry would only buy recomputation of an identical answer. Point this at
 * a live broker feed and this is the function that grows a cache key.
 */

import { analyzePortfolio } from "@/lib/analytics";
import type { PortfolioAnalytics } from "@/lib/analytics";
import { PRICE_BOOK } from "@/lib/market-data";
import { TRANSACTIONS } from "@/lib/portfolio-data";

let cached: PortfolioAnalytics | null = null;

export function getPortfolio(): PortfolioAnalytics {
  if (!cached) cached = analyzePortfolio(TRANSACTIONS, PRICE_BOOK);
  return cached;
}

/** The position in one symbol, or null when it is not held. */
export function getPosition(symbol: string) {
  return getPortfolio().positions.find((position) => position.symbol === symbol) ?? null;
}

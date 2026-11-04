/**
 * Case normalization for the two routes whose URLs are typed and shared by
 * hand.
 *
 * Symbol pages live at uppercase tickers (`/analytics/NVDA`) and comparison
 * pages at lowercase slugs (`/compare/nvda-vs-amd`). Both routes prerender a
 * closed list of params, so any other casing is a 404, and a link someone
 * pasted as `/analytics/nvda` would be a dead end. This answers it with a
 * permanent redirect to the canonical casing instead, which also folds any
 * search signals the stray URL picked up into the real page.
 *
 * It is done here rather than by prerendering both casings because `NVDA.html`
 * and `nvda.html` are the same file on a case-insensitive disk, and one would
 * silently overwrite the other in a local build.
 *
 * The matchers only fire when the casing is wrong. Next compiles them without
 * the case-insensitive flag, so canonical URLs never invoke this at all.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const [, section, segment = "", ...rest] = url.pathname.split("/");
  const normalized = section === "analytics" ? segment.toUpperCase() : segment.toLowerCase();
  if (normalized === segment) return NextResponse.next();
  url.pathname = ["", section, normalized, ...rest].join("/");
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/analytics/:symbol([^/]*[a-z][^/]*)/:rest*", "/compare/:slug([^/]*[A-Z][^/]*)/:rest*"],
};

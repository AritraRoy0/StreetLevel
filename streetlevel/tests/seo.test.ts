/**
 * The pure parts of the SEO layer: where absolute URLs point, which
 * deployments may be indexed, and the comparison-page URL scheme.
 *
 * A wrong origin or a duplicate comparison URL does not break anything a
 * reader would see, which is exactly why it needs a test: it would only show
 * up months later as pages that never rank.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absoluteUrl, isIndexable, resolveSiteUrl, toOrigin } from "../lib/site.ts";
import { buildPairs, canonicalPair, pairSlug, parsePairSlug } from "../lib/compare-pairs.ts";

describe("toOrigin", () => {
  it("adds https to a bare host and strips trailing slashes", () => {
    assert.equal(toOrigin("streetlevel.app"), "https://streetlevel.app");
    assert.equal(toOrigin("https://streetlevel.app/"), "https://streetlevel.app");
    assert.equal(toOrigin("  http://localhost:3001  "), "http://localhost:3001");
  });

  it("keeps a base path", () => {
    assert.equal(toOrigin("https://example.com/research/"), "https://example.com/research");
  });

  it("rejects empty and unparseable values", () => {
    assert.equal(toOrigin(undefined), null);
    assert.equal(toOrigin(""), null);
    assert.equal(toOrigin("   "), null);
    assert.equal(toOrigin("https://"), null);
  });
});

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL", () => {
    assert.equal(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://streetlevel.app", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
      "https://streetlevel.app",
    );
  });

  it("falls back to Vercel's production domain, so previews canonicalize to production", () => {
    assert.equal(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "streetlevel.vercel.app" }), "https://streetlevel.vercel.app");
    assert.equal(
      resolveSiteUrl({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "streetlevel.vercel.app" }),
      "https://streetlevel.vercel.app",
    );
  });

  it("skips a malformed explicit value rather than emitting broken canonicals", () => {
    assert.equal(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://", VERCEL_PROJECT_PRODUCTION_URL: "streetlevel.vercel.app" }),
      "https://streetlevel.vercel.app",
    );
  });

  it("uses the local dev server when nothing is configured", () => {
    assert.equal(resolveSiteUrl({}), "http://localhost:3001");
  });
});

describe("absoluteUrl", () => {
  const origin = "https://streetlevel.app";

  it("joins site paths onto the origin", () => {
    assert.equal(absoluteUrl("/analytics/NVDA", origin), "https://streetlevel.app/analytics/NVDA");
    assert.equal(absoluteUrl("learn/rsi", origin), "https://streetlevel.app/learn/rsi");
  });

  it("returns the bare origin for the root, with no trailing slash", () => {
    assert.equal(absoluteUrl("/", origin), origin);
  });

  it("leaves absolute URLs alone", () => {
    assert.equal(absoluteUrl("https://github.com/x", origin), "https://github.com/x");
  });
});

describe("isIndexable", () => {
  it("indexes production and hosts off Vercel, never previews", () => {
    assert.equal(isIndexable({ VERCEL_ENV: "production" }), true);
    assert.equal(isIndexable({}), true);
    assert.equal(isIndexable({ VERCEL_ENV: "preview" }), false);
    assert.equal(isIndexable({ VERCEL_ENV: "development" }), false);
  });
});

describe("comparison pairs", () => {
  const ordered = ["AAPL", "MSFT", "NVDA", "AMD"];

  it("builds every unordered pair exactly once", () => {
    const pairs = buildPairs(ordered);
    assert.equal(pairs.length, (ordered.length * (ordered.length - 1)) / 2);
    assert.equal(new Set(pairs.map((pair) => pair.slug)).size, pairs.length);
    for (const pair of pairs) assert.ok(ordered.indexOf(pair.first) < ordered.indexOf(pair.second));
  });

  it("writes lowercase slugs and reads them back uppercased", () => {
    assert.equal(pairSlug("NVDA", "AMD"), "nvda-vs-amd");
    assert.deepEqual(parsePairSlug("nvda-vs-amd"), { first: "NVDA", second: "AMD" });
    assert.deepEqual(parsePairSlug("brk.b-vs-aapl"), { first: "BRK.B", second: "AAPL" });
  });

  it("rejects slugs that are not a pair of two different tickers", () => {
    assert.equal(parsePairSlug("nvda"), null);
    assert.equal(parsePairSlug("nvda-vs-nvda"), null);
    assert.equal(parsePairSlug("nvda-vs-"), null);
    assert.equal(parsePairSlug("../etc-vs-passwd"), null);
  });

  it("maps either order to the same canonical pair", () => {
    const forward = canonicalPair("NVDA", "AMD", ordered);
    const reversed = canonicalPair("amd", "nvda", ordered);
    assert.deepEqual(forward, reversed);
    assert.equal(forward?.slug, "nvda-vs-amd");
  });

  it("refuses symbols outside the list and self-pairs", () => {
    assert.equal(canonicalPair("NVDA", "TSLA", ordered), null);
    assert.equal(canonicalPair("NVDA", "NVDA", ordered), null);
  });
});

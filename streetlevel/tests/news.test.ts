import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEventMarkers, dedupeNews, headlineKey, newsForSymbol } from "../lib/analytics/news.ts";
import type { NewsArticle } from "../lib/analytics/news.ts";
import { barsOnDays } from "./helpers.ts";

function article(partial: Partial<NewsArticle> & Pick<NewsArticle, "id" | "title" | "publishedAt">): NewsArticle {
  return {
    source: "Wire",
    category: "Markets",
    sentiment: "neutral",
    symbols: ["AAA"],
    ...partial,
  };
}

describe("headlineKey", () => {
  it("ignores case, punctuation and spacing", () => {
    assert.equal(headlineKey("Apple's Q3: Revenue Beats!"), headlineKey("apple s q3 revenue beats"));
  });

  it("strips wire prefixes", () => {
    assert.equal(headlineKey("UPDATE 2 - Chip maker raises guidance"), headlineKey("Chip maker raises guidance"));
    assert.equal(headlineKey("EXCLUSIVE: Board meets"), headlineKey("Board meets"));
  });
});

describe("dedupeNews", () => {
  it("collapses the same headline syndicated by several outlets", () => {
    const result = dedupeNews([
      article({ id: "1", title: "Chip maker raises guidance", publishedAt: "2026-03-02T10:00:00.000Z", source: "Reuters" }),
      article({ id: "2", title: "Chip maker raises guidance", publishedAt: "2026-03-02T11:30:00.000Z", source: "Bloomberg" }),
      article({ id: "3", title: "UPDATE 1 - Chip maker raises guidance", publishedAt: "2026-03-02T13:00:00.000Z", source: "AP" }),
    ]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].duplicateSources.sort(), ["AP", "Bloomberg", "Reuters"]);
    // The earliest publication survives.
    assert.equal(result[0].source, "Reuters");
  });

  it("collapses repeated ids", () => {
    const result = dedupeNews([
      article({ id: "1", title: "A", publishedAt: "2026-03-02T10:00:00.000Z" }),
      article({ id: "1", title: "A", publishedAt: "2026-03-02T10:00:00.000Z" }),
    ]);
    assert.equal(result.length, 1);
  });

  it("keeps a recurring headline that reappears outside the time window", () => {
    const result = dedupeNews([
      article({ id: "1", title: "Weekly market wrap", publishedAt: "2026-03-02T10:00:00.000Z" }),
      article({ id: "2", title: "Weekly market wrap", publishedAt: "2026-03-09T10:00:00.000Z" }),
    ]);
    assert.equal(result.length, 2);
  });

  it("unions the tickers of collapsed copies", () => {
    const result = dedupeNews([
      article({ id: "1", title: "Supplier deal signed", publishedAt: "2026-03-02T10:00:00.000Z", symbols: ["AAA"] }),
      article({ id: "2", title: "Supplier deal signed", publishedAt: "2026-03-02T12:00:00.000Z", symbols: ["BBB"] }),
    ]);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].symbols.sort(), ["AAA", "BBB"]);
  });

  it("returns newest first", () => {
    const result = dedupeNews([
      article({ id: "1", title: "Older", publishedAt: "2026-03-01T10:00:00.000Z" }),
      article({ id: "2", title: "Newer", publishedAt: "2026-03-05T10:00:00.000Z" }),
    ]);
    assert.equal(result[0].title, "Newer");
  });

  it("drops articles with an unparseable timestamp", () => {
    const result = dedupeNews([article({ id: "1", title: "A", publishedAt: "nope" })]);
    assert.equal(result.length, 0);
  });

  it("handles an empty feed", () => {
    assert.deepEqual(dedupeNews([]), []);
  });
});

describe("newsForSymbol", () => {
  const feed = dedupeNews([
    article({ id: "1", title: "AAA beats", publishedAt: "2026-03-02T10:00:00.000Z", symbols: ["AAA"] }),
    article({ id: "2", title: "Sector note", publishedAt: "2026-03-03T10:00:00.000Z", symbols: ["BBB", "AAA"] }),
    article({ id: "3", title: "BBB only", publishedAt: "2026-03-04T10:00:00.000Z", symbols: ["BBB"] }),
  ]);

  it("matches on ticker tags, including secondary tags", () => {
    assert.equal(newsForSymbol(feed, "AAA").length, 2);
    assert.equal(newsForSymbol(feed, "BBB").length, 2);
  });

  it("can narrow to stories whose primary subject is the symbol", () => {
    const primary = newsForSymbol(feed, "AAA", { primaryOnly: true });
    assert.equal(primary.length, 1);
    assert.equal(primary[0].title, "AAA beats");
  });

  it("is case-insensitive and honours the limit", () => {
    assert.equal(newsForSymbol(feed, "aaa").length, 2);
    assert.equal(newsForSymbol(feed, "AAA", { limit: 1 }).length, 1);
  });

  it("returns nothing for an unknown symbol", () => {
    assert.deepEqual(newsForSymbol(feed, "ZZZ"), []);
  });

  it("does not match a company name that merely appears in the headline", () => {
    const supplierStory = dedupeNews([
      article({ id: "9", title: "Apple supplier cuts outlook", publishedAt: "2026-03-02T10:00:00.000Z", symbols: ["BBB"] }),
    ]);
    assert.deepEqual(newsForSymbol(supplierStory, "AAPL"), []);
  });
});

describe("buildEventMarkers", () => {
  const bars = barsOnDays([
    ["2026-03-02", 100], ["2026-03-03", 101], ["2026-03-04", 102], ["2026-03-05", 103],
  ]);
  const timestamps = bars.map((bar) => bar.timestamp);

  it("pins an article to its own session", () => {
    const markers = buildEventMarkers(
      [article({ id: "1", title: "A", publishedAt: "2026-03-03T14:00:00.000Z" })],
      timestamps,
    );
    assert.equal(markers.length, 1);
    assert.equal(markers[0].index, 1);
  });

  it("pushes a weekend story to the next session that traded on it", () => {
    const weekendBars = barsOnDays([["2026-03-06", 100], ["2026-03-09", 101]]);
    const markers = buildEventMarkers(
      [article({ id: "1", title: "Saturday news", publishedAt: "2026-03-07T10:00:00.000Z" })],
      weekendBars.map((bar) => bar.timestamp),
    );
    assert.equal(markers.length, 1);
    assert.equal(markers[0].index, 1);
  });

  it("groups several articles onto one bar and takes the majority sentiment", () => {
    const markers = buildEventMarkers(
      [
        article({ id: "1", title: "A", publishedAt: "2026-03-04T09:00:00.000Z", sentiment: "positive" }),
        article({ id: "2", title: "B", publishedAt: "2026-03-04T15:00:00.000Z", sentiment: "positive" }),
        article({ id: "3", title: "C", publishedAt: "2026-03-04T16:00:00.000Z", sentiment: "negative" }),
      ],
      timestamps,
    );
    assert.equal(markers.length, 1);
    assert.equal(markers[0].articles.length, 3);
    assert.equal(markers[0].sentiment, "positive");
  });

  it("falls back to neutral when sentiment is evenly split", () => {
    const markers = buildEventMarkers(
      [
        article({ id: "1", title: "A", publishedAt: "2026-03-04T09:00:00.000Z", sentiment: "positive" }),
        article({ id: "2", title: "B", publishedAt: "2026-03-04T15:00:00.000Z", sentiment: "negative" }),
      ],
      timestamps,
    );
    assert.equal(markers[0].sentiment, "neutral");
  });

  it("drops articles published after the window", () => {
    const markers = buildEventMarkers(
      [article({ id: "1", title: "Future", publishedAt: "2026-04-01T10:00:00.000Z" })],
      timestamps,
    );
    assert.deepEqual(markers, []);
  });

  it("drops articles published before the window", () => {
    const markers = buildEventMarkers(
      [article({ id: "1", title: "Ancient", publishedAt: "2025-01-01T10:00:00.000Z" })],
      timestamps,
    );
    assert.deepEqual(markers, []);
  });

  it("is empty when there are no bars", () => {
    assert.deepEqual(buildEventMarkers([article({ id: "1", title: "A", publishedAt: "2026-03-03T10:00:00.000Z" })], []), []);
  });

  it("returns markers in bar order", () => {
    const markers = buildEventMarkers(
      [
        article({ id: "1", title: "Later", publishedAt: "2026-03-05T10:00:00.000Z" }),
        article({ id: "2", title: "Earlier", publishedAt: "2026-03-02T10:00:00.000Z" }),
      ],
      timestamps,
    );
    assert.deepEqual(markers.map((marker) => marker.index), [0, 3]);
  });
});

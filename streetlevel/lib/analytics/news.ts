/**
 * News normalization: de-duplication, symbol association and event markers.
 *
 * Aggregated feeds repeat themselves. The same wire story arrives from three
 * outlets with slightly different headlines, and a correction re-publishes an
 * article under a new id. Rendering all of them makes the panel useless, so
 * items are collapsed before they reach the UI.
 */

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  /** ISO-8601 UTC publication instant. */
  publishedAt: string;
  category: string;
  sentiment: "positive" | "negative" | "neutral";
  /** Tickers the story is about. The first entry is the primary subject. */
  symbols: string[];
  summary?: string;
  url?: string;
}

/**
 * Reduces a headline to a comparison key: lowercase, punctuation stripped,
 * whitespace collapsed, and common wire prefixes removed.
 *
 * Matching on the normalized headline rather than on the id is what catches
 * the same story syndicated under different ids, which is the dominant form of
 * duplication in an aggregated feed.
 */
export function headlineKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(update|exclusive|breaking|correction)\s*\d*\s*[-:—]\s*/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Collapses duplicate articles.
 *
 * Two items are the same story when they share an id, or when their normalized
 * headlines match and they were published within `windowHours` of each other.
 * The time window stops a recurring headline such as a weekly market wrap from
 * collapsing months of coverage into one row.
 *
 * The surviving copy is the **earliest** publication, which is the one that
 * actually broke the story, but its source list records every outlet that ran
 * it.
 */
export function dedupeNews(articles: readonly NewsArticle[], windowHours = 36): Array<NewsArticle & { duplicateSources: string[] }> {
  const byId = new Map<string, NewsArticle>();
  for (const article of articles) {
    if (!byId.has(article.id)) byId.set(article.id, article);
  }

  const sorted = Array.from(byId.values())
    .filter((article) => !Number.isNaN(new Date(article.publishedAt).getTime()))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

  const kept: Array<NewsArticle & { duplicateSources: string[] }> = [];
  const windowMs = windowHours * 3_600_000;

  for (const article of sorted) {
    const key = headlineKey(article.title);
    const time = new Date(article.publishedAt).getTime();
    const existing = kept.find(
      (candidate) =>
        headlineKey(candidate.title) === key &&
        Math.abs(new Date(candidate.publishedAt).getTime() - time) <= windowMs,
    );
    if (existing) {
      if (!existing.duplicateSources.includes(article.source)) existing.duplicateSources.push(article.source);
      // Union the tickers so a syndicated copy tagged with an extra symbol is
      // still discoverable under that symbol.
      for (const symbol of article.symbols) {
        if (!existing.symbols.includes(symbol)) existing.symbols.push(symbol);
      }
      continue;
    }
    kept.push({ ...article, symbols: [...article.symbols], duplicateSources: [article.source] });
  }

  return kept.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

/**
 * Selects the articles that concern a symbol.
 *
 * Association is by explicit ticker tag only. Matching the company name inside
 * the headline is tempting and wrong: "Apple" appears in stories about
 * suppliers, and a story that merely mentions a ticker is not a story about
 * it. `primaryOnly` narrows further to stories whose first tag is the symbol.
 */
export function newsForSymbol(
  articles: readonly (NewsArticle & { duplicateSources?: string[] })[],
  symbol: string,
  { primaryOnly = false, limit = 8 }: { primaryOnly?: boolean; limit?: number } = {},
): Array<NewsArticle & { duplicateSources: string[] }> {
  const target = symbol.trim().toUpperCase();
  return articles
    .filter((article) =>
      primaryOnly ? article.symbols[0]?.toUpperCase() === target : article.symbols.some((tag) => tag.toUpperCase() === target),
    )
    .slice(0, limit)
    .map((article) => ({ ...article, duplicateSources: article.duplicateSources ?? [article.source] }));
}

export interface EventMarker {
  /** Index of the bar the article should be pinned to. */
  index: number;
  timestamp: string;
  articles: Array<NewsArticle & { duplicateSources: string[] }>;
  sentiment: "positive" | "negative" | "neutral";
}

/**
 * Maps articles onto bar indices so the chart can draw event markers.
 *
 * An article published outside trading hours, on a weekend or on a holiday has
 * no bar of its own. It is attached to the **next** bar at or after its
 * timestamp, which is the session that actually traded on the news. Articles
 * published after the last bar are dropped rather than clamped to the end,
 * since pinning tomorrow's news to today's candle would misdate it.
 *
 * Several articles landing on one bar are grouped into a single marker; its
 * sentiment is the majority of the group, or neutral when they disagree evenly.
 */
export function buildEventMarkers(
  articles: readonly (NewsArticle & { duplicateSources?: string[] })[],
  timestamps: readonly string[],
): EventMarker[] {
  if (timestamps.length === 0) return [];
  const barTimes = timestamps.map((timestamp) => new Date(timestamp).getTime());
  const grouped = new Map<number, Array<NewsArticle & { duplicateSources: string[] }>>();

  for (const article of articles) {
    const time = new Date(article.publishedAt).getTime();
    if (Number.isNaN(time)) continue;
    if (time > barTimes[barTimes.length - 1] + 86_400_000) continue;
    let index = barTimes.findIndex((barTime) => barTime >= time - 86_400_000);
    if (index === -1) continue;
    // Articles before the first bar are not shown at all.
    if (time < barTimes[0] - 86_400_000) continue;
    index = Math.min(index, barTimes.length - 1);
    const bucket = grouped.get(index);
    const normalized = { ...article, duplicateSources: article.duplicateSources ?? [article.source] };
    if (bucket) bucket.push(normalized);
    else grouped.set(index, [normalized]);
  }

  return Array.from(grouped.entries())
    .map(([index, group]) => {
      const positive = group.filter((article) => article.sentiment === "positive").length;
      const negative = group.filter((article) => article.sentiment === "negative").length;
      return {
        index,
        timestamp: timestamps[index],
        articles: group,
        sentiment: (positive > negative ? "positive" : negative > positive ? "negative" : "neutral") as EventMarker["sentiment"],
      };
    })
    .sort((a, b) => a.index - b.index);
}

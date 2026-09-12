/**
 * The news panel.
 *
 * Each item shows its source, its publication time and the tickers it is
 * associated with, because a headline with no provenance is not context, it is
 * decoration. Where several outlets carried the same story the panel says so
 * rather than listing it repeatedly.
 */

import Link from "next/link";
import { Badge, Eyebrow, Panel, PanelHeader } from "@/components/ui";
import { formatDateTime, formatRelativeTime } from "@/lib/analytics";
import type { NewsArticle } from "@/lib/analytics";
import { NEWS_SOURCE_NOTE } from "@/lib/news-data";
import { cn } from "@/lib/utils";

type Article = NewsArticle & { duplicateSources?: string[] };

const SENTIMENT_TONE = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
} as const;

export function NewsPanel({
  articles,
  title = "Recent coverage",
  symbol,
  emptyMessage = "No coverage on file for this symbol.",
  className,
}: {
  articles: Article[];
  title?: string;
  symbol?: string;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title={title}
        eyebrow={symbol ? `Tagged ${symbol}` : "Sample feed"}
        actions={<span className="text-[10px] uppercase tracking-wider text-faint">{articles.length} stories</span>}
      />

      {articles.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-muted">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {articles.map((article) => (
            <li key={article.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow>{article.source}</Eyebrow>
                <time
                  dateTime={article.publishedAt}
                  title={formatDateTime(article.publishedAt)}
                  className="shrink-0 font-mono text-[10px] tabular-nums text-faint"
                >
                  {formatRelativeTime(article.publishedAt)}
                </time>
              </div>

              <h4 className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{article.title}</h4>
              {article.summary && <p className="mt-1 text-[11px] leading-relaxed text-muted">{article.summary}</p>}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {article.symbols.map((tag) => (
                    <Link
                      key={tag}
                      href={`/analytics/${tag}`}
                      className="font-mono text-[10px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
                <Badge tone={SENTIMENT_TONE[article.sentiment]}>{article.sentiment}</Badge>
                <span className="text-[10px] uppercase tracking-wider text-faint">{article.category}</span>
                {article.duplicateSources && article.duplicateSources.length > 1 && (
                  <span className="text-[10px] text-faint">
                    Also carried by {article.duplicateSources.filter((source) => source !== article.source).join(", ")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-hairline px-4 py-2.5 text-[10px] uppercase tracking-wider text-faint">
        {NEWS_SOURCE_NOTE}
      </p>
    </Panel>
  );
}

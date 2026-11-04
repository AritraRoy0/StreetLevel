import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { SymbolBrief, symbolFaqs } from "@/components/analytics/symbol-brief";
import type { SymbolBriefData } from "@/components/analytics/symbol-brief";
import { JsonLd } from "@/components/json-ld";
import { PageShell, StatusStrip } from "@/components/shell";
import {
  BENCHMARKS,
  COMPOSITE_BARS,
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  SNAPSHOTS,
  SYMBOL_ROWS,
  getBars,
  getProfile,
  hasSymbol,
  SYMBOLS,
} from "@/lib/market-data";
import type { SymbolProfile } from "@/lib/market-data";
import { NEWS_FEED } from "@/lib/news-data";
import { SYMBOL_DIRECTORY } from "@/lib/symbol-directory";
import {
  buildSummary,
  compareToBenchmark,
  formatDate,
  formatPercent,
  formatPoints,
  formatPrice,
  median,
  newsForSymbol,
} from "@/lib/analytics";
import type { AnalyticsSummary, DataQuality } from "@/lib/analytics";
import { pairsWith } from "@/lib/comparisons";
import { faqNode, graph, pageMetadata, webPageNode } from "@/lib/seo";

/** Pre-render every covered symbol; the dataset is static and small. */
export function generateStaticParams() {
  return [...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => ({ symbol }));
}

/**
 * The coverage list is closed and fully enumerated above, so any other symbol
 * is a genuine 404 rather than something to render on demand.
 *
 * This matters for more than tidiness. With the default `true`, an unknown
 * symbol renders the page, hits `notFound()`, and because `loading.tsx` makes
 * the response streamed, Next can only answer 200 with a `noindex` tag, and it
 * caches that soft 404 behind a long `s-maxage`. A CDN would then serve a bogus
 * page for a typo'd ticker for a year. Refusing the param before rendering
 * gives a real 404 and nothing cacheable.
 *
 * A covered ticker typed in lowercase never reaches this route: `proxy.ts`
 * redirects it to the uppercase URL first.
 */
export const dynamicParams = false;

const COMPOSITE_SUMMARY = buildSummary(COMPOSITE_SYMBOL, COMPOSITE_BARS, { range: "1Y" });

/** The trailing-year snapshot every summary figure on the page quotes. */
function snapshotFor(symbol: string): AnalyticsSummary {
  return symbol === COMPOSITE_SYMBOL ? COMPOSITE_SUMMARY : SNAPSHOTS[symbol];
}

/** "NVIDIA (NVDA)", or just "AMD" where the short name is the ticker. */
function displayName(symbol: string, profile: SymbolProfile) {
  return profile.shortName === symbol ? symbol : `${profile.shortName} (${symbol})`;
}

function describe(symbol: string, summary: AnalyticsSummary) {
  const date = formatDate(summary.lastBarTimestamp);
  const year = formatPercent(summary.periodReturn, { signed: true });
  const volatility = formatPercent(summary.volatility.annualized);
  const drawdown = formatPercent(summary.drawdown.maxDrawdown);
  if (symbol === COMPOSITE_SYMBOL) {
    return `The SL10 equal-weight composite of ten large-cap stocks returned ${year} over the year to ${date}, with ${volatility} annualized volatility and a ${drawdown} maximum drawdown. Chart, indicators and constituents.`;
  }
  return `${symbol} closed at ${formatPrice(summary.lastPrice)} on ${date}, ${year} over the past year. RSI 14 at ${formatPoints(summary.rsi.value)}, volatility ${volatility}, max drawdown ${drawdown}. Free interactive chart with moving averages, MACD and Bollinger Bands.`;
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const normalized = symbol.toUpperCase();
  if (!hasSymbol(normalized)) return { title: "Symbol not covered" };

  const profile = getProfile(normalized);
  const summary = snapshotFor(normalized);
  const isComposite = normalized === COMPOSITE_SYMBOL;
  const label = displayName(normalized, profile);

  return pageMetadata({
    title: isComposite
      ? "SL10 Equal-Weight Composite: Returns, Volatility and Drawdown"
      : `${label} Stock Analysis: RSI, MACD and Risk Metrics`,
    socialTitle: isComposite ? "SL10 equal-weight composite" : `${label} stock analysis`,
    description: describe(normalized, summary),
    path: `/analytics/${normalized}`,
  });
}

/** Everything the written summary needs, gathered from the shared snapshots. */
function briefData(symbol: string, profile: SymbolProfile): SymbolBriefData {
  const summary = snapshotFor(symbol);
  const isComposite = symbol === COMPOSITE_SYMBOL;
  const volatilities = SYMBOL_ROWS.map((row) => row.summary.volatility.annualized).filter(
    (value): value is number => value !== null,
  );
  const byVolatility = [...SYMBOL_ROWS].sort(
    (a, b) => (b.summary.volatility.annualized ?? 0) - (a.summary.volatility.annualized ?? 0),
  );
  const rank = byVolatility.findIndex((row) => row.symbol === symbol);

  return {
    symbol,
    profile,
    summary,
    isComposite,
    composite: COMPOSITE_SUMMARY,
    versusComposite: isComposite
      ? null
      : compareToBenchmark(summary.bars, COMPOSITE_BARS, { baseSymbol: symbol, benchmarkSymbol: COMPOSITE_SYMBOL }),
    medianVolatility: median(volatilities),
    volatilityRank: rank === -1 ? null : rank + 1,
    peerCount: SYMBOL_ROWS.length,
    comparisons: isComposite
      ? []
      : pairsWith(symbol).map((pair) => {
          const other = pair.first === symbol ? pair.second : pair.first;
          const mine = summary.periodReturn;
          const theirs = SNAPSHOTS[other]?.periodReturn ?? null;
          return { pair, other, gap: mine === null || theirs === null ? null : mine - theirs };
        }),
    constituents: isComposite
      ? SYMBOL_ROWS.map((row) => ({ symbol: row.symbol, name: row.profile.name, periodReturn: row.summary.periodReturn }))
      : [],
  };
}

export default async function SymbolAnalyticsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  if (!hasSymbol(symbol)) notFound();

  const bars = getBars(symbol);
  if (bars.length === 0) notFound();

  const profile = getProfile(symbol);
  const quality: DataQuality = DATA_QUALITY[symbol] ?? {
    pointCount: bars.length,
    rejected: 0,
    duplicates: 0,
    reordered: 0,
    missingSessions: 0,
    lastBar: bars[bars.length - 1].timestamp,
    staleWeekdays: null,
    stale: false,
    warnings: [],
  };

  // The default benchmark is the composite unless the composite is what we are
  // looking at, in which case fall back to the largest covered name.
  const benchmarkSymbol = symbol === COMPOSITE_SYMBOL ? SYMBOLS[0] : COMPOSITE_SYMBOL;
  const benchmarkBars = getBars(benchmarkSymbol);

  const news = newsForSymbol(NEWS_FEED, symbol, { limit: 10 });

  const brief = briefData(symbol, profile);
  const path = `/analytics/${symbol}`;

  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path,
            name: `${displayName(symbol, profile)} stock analysis`,
            description: describe(symbol, brief.summary),
            dateModified: brief.summary.lastBarTimestamp ?? DATASET.downloadedAt,
            about: profile.exchange
              ? { "@type": "Corporation", name: profile.name, tickerSymbol: `${profile.exchange}: ${symbol}` }
              : undefined,
          }),
          faqNode(path, symbolFaqs(brief)),
        )}
      />
      <StatusStrip
        asOf={quality.lastBar}
        source={DATASET.source}
        stale={quality.stale}
        note={`${quality.pointCount} sessions validated`}
      />
      <PageShell>
        <AnalyticsView
          symbol={symbol}
          profile={profile}
          bars={bars}
          quality={quality}
          benchmarkSymbol={benchmarkSymbol}
          benchmarkBars={benchmarkBars}
          benchmarkOptions={BENCHMARKS}
          news={news}
          directory={SYMBOL_DIRECTORY}
          backtestable={SYMBOLS.includes(symbol)}
        />
        <SymbolBrief data={brief} />
      </PageShell>
    </>
  );
}

import { notFound } from "next/navigation";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { Footer, PageShell, StatusStrip, TopNav } from "@/components/shell";
import {
  BENCHMARKS,
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  getBars,
  getProfile,
  hasSymbol,
  SYMBOLS,
} from "@/lib/market-data";
import { NEWS_FEED } from "@/lib/news-data";
import { getPosition } from "@/lib/portfolio-service";
import { newsForSymbol } from "@/lib/analytics";
import type { DataQuality } from "@/lib/analytics";

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
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const normalized = symbol.toUpperCase();
  if (!hasSymbol(normalized)) return { title: "Symbol not covered" };
  return {
    title: `${normalized} analytics`,
    description: `Price analytics, technical indicators and benchmark comparison for ${getProfile(normalized).name}.`,
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

  const position = getPosition(symbol);
  const news = newsForSymbol(NEWS_FEED, symbol, { limit: 10 });

  return (
    <>
      <TopNav />
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
          position={position}
          peers={[...SYMBOLS, COMPOSITE_SYMBOL].map((item) => ({
            symbol: item,
            name: getProfile(item).name,
          }))}
        />
        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

import { Footer, PageHeader, PageShell, StatusStrip, TopNav } from "@/components/shell";
import { PerformanceTabs } from "@/components/performance/performance-tabs";
import { CrossSectionView } from "@/components/performance/cross-section-view";
import { COMPOSITE_BARS, DATA_QUALITY, DATASET, PRICE_BOOK, SYMBOLS } from "@/lib/market-data";

export const metadata = { title: "Performance" };

/**
 * The performance page.
 *
 * Two views share it: a backtest workspace, and the cross-sectional comparison
 * the page used to be. The full price book is handed to the workspace so every
 * parameter change is a local recomputation rather than a request.
 *
 * The strategy is read from `searchParams` **here**, on the server, rather than
 * with `useSearchParams` in the client component. Reading it in the client
 * makes a prerendered page bail out to client-only rendering, so the first
 * paint was a skeleton and the results only appeared after hydration. Taking it
 * as a prop renders the whole run server-side and makes a shared link show its
 * result immediately.
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const quality = DATA_QUALITY[SYMBOLS[0]];

  // Flatten to a query string so the client and the server agree on one parser.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value.length > 0) query.set(key, value[0]);
  }

  const datasetNote = `The bundled dataset holds ${SYMBOLS.length} symbols and ${quality?.pointCount ?? 0} daily sessions, from ${DATASET.from} to ${DATASET.to}. There are no intraday bars.`;

  return (
    <>
      <TopNav />
      <StatusStrip
        asOf={quality?.lastBar ?? null}
        source={DATASET.source}
        stale={quality?.stale}
        note="Backtest and cross-section"
      />
      <PageShell>
        <PageHeader
          eyebrow="Simulation and relative strength"
          title="Performance"
          description="Run a rule over the bundled history under stated cost and fill assumptions, or compare every covered name against the equal-weight composite."
        />

        <PerformanceTabs
          priceBook={PRICE_BOOK}
          symbols={SYMBOLS}
          compositeBars={COMPOSITE_BARS}
          datasetNote={datasetNote}
          initialQuery={query.toString()}
          crossSection={<CrossSectionView />}
        />

        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

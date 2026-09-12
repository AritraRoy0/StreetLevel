import Link from "next/link";
import { Footer, PageShell, TopNav } from "@/components/shell";
import { Callout, Eyebrow } from "@/components/ui";
import { COMPOSITE_SYMBOL, DATASET, SYMBOLS } from "@/lib/market-data";

export const metadata = { title: "Not found" };

/**
 * The application's 404 page.
 *
 * It handles both unmatched URLs and, because the analytics route sets
 * `dynamicParams = false`, any symbol outside the coverage list. Since an
 * uncovered ticker is the likeliest way to arrive here, the page lists what is
 * actually covered instead of only saying no: a dead end that names the
 * alternatives saves the reader a guess.
 *
 * Supplying this file also takes over from Next's built-in 404, which follows
 * the operating system colour scheme rather than the site's own palette.
 */
export default function NotFound() {
  return (
    <>
      <TopNav />
      <PageShell>
        <div className="mx-auto max-w-xl py-16">
          <Eyebrow className="mb-3">404</Eyebrow>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink sm:text-[32px]">
            Nothing here
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            That page does not exist. If you were looking for a symbol, the bundled dataset holds daily history for
            ten names plus an equal-weight composite of them, and anything outside that list returns nothing rather
            than an empty chart.
          </p>

          <Callout className="mt-6" title="Covered symbols">
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => (
                <Link
                  key={symbol}
                  href={`/analytics/${symbol}`}
                  className="border border-hairline px-2 py-1 font-mono text-[11px] font-semibold text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                >
                  {symbol}
                </Link>
              ))}
            </div>
          </Callout>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="bg-ink px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-surface transition-colors hover:bg-ink-soft"
            >
              Overview
            </Link>
            <Link
              href="/portfolio"
              className="border border-hairline-strong px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-sunken"
            >
              Portfolio
            </Link>
          </div>
        </div>
        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

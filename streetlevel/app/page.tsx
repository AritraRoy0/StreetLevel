import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell, StatusStrip } from "@/components/shell";
import { CoverageTable } from "@/components/coverage-table";
import { toCoverageRow } from "@/components/coverage-row";
import { NewsPanel } from "@/components/news-panel";
import { DataQualityNotice } from "@/components/data-quality-notice";
import { JsonLd } from "@/components/json-ld";
import {
  Badge,
  Delta,
  Eyebrow,
  Kbd,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  SectionHeading,
  buttonClass,
} from "@/components/ui";
import { Sparkline, thinSeries } from "@/components/charts/sparkline";
import {
  COMPOSITE_BARS,
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  SYMBOL_ROWS,
  SYMBOLS,
} from "@/lib/market-data";
import type { SymbolRow } from "@/lib/market-data";
import { NEWS_FEED } from "@/lib/news-data";
import { buildSummary, formatPercent, mean } from "@/lib/analytics";
import { COMPARISON_ORDER, COMPARISON_PAIRS, POPULAR_PAIRS } from "@/lib/comparisons";
import { GUIDE_CATALOG } from "@/lib/learn/catalog";
import { SITE_NAME } from "@/lib/site";
import { graph, organizationNode, pageMetadata, webApplicationNode, webPageNode, websiteNode } from "@/lib/seo";

const TITLE = `${SITE_NAME}: Free Stock Analytics, Technical Indicators and Backtesting`;

const DESCRIPTION = `Free stock analytics for ${SYMBOLS.length} large-cap stocks including ${COMPARISON_ORDER.slice(0, 3).join(", ")}: interactive charts with RSI, MACD and Bollinger Bands, volatility, drawdown and beta, and a backtester that models costs.`;

export const metadata = pageMetadata({
  title: TITLE,
  absoluteTitle: true,
  socialTitle: `${SITE_NAME}: stock analytics you can trace to a formula`,
  description: DESCRIPTION,
  path: "/",
});

/** Guides surfaced on the overview, one or two from each category. */
const FEATURED_GUIDES = ["rsi", "macd", "bollinger-bands", "max-drawdown", "sharpe-ratio", "deflated-sharpe-ratio"];

export default function OverviewPage() {
  const composite = buildSummary(COMPOSITE_SYMBOL, COMPOSITE_BARS, { range: "1Y" });

  const sessionReturns = SYMBOL_ROWS.map((row) => row.summary.lastChangePercent).filter(
    (value): value is number => value !== null,
  );
  const yearReturns = SYMBOL_ROWS.map((row) => row.summary.periodReturn).filter(
    (value): value is number => value !== null,
  );
  const advancing = sessionReturns.filter((value) => value > 0).length;
  const declining = sessionReturns.filter((value) => value < 0).length;

  const ranked = [...SYMBOL_ROWS]
    .filter((row) => row.summary.periodReturn !== null)
    .sort((a, b) => (b.summary.periodReturn ?? 0) - (a.summary.periodReturn ?? 0));
  const leaders = ranked.slice(0, 3);
  const laggards = ranked.slice(-3).reverse();

  const deepest = SYMBOL_ROWS.reduce((worst, row) =>
    (row.summary.drawdown.maxDrawdown ?? 0) < (worst.summary.drawdown.maxDrawdown ?? 0) ? row : worst,
  );

  const quality = DATA_QUALITY[SYMBOLS[0]];

  const guides = FEATURED_GUIDES.map((slug) => GUIDE_CATALOG.find((guide) => guide.slug === slug)).filter(
    (guide): guide is (typeof GUIDE_CATALOG)[number] => guide !== undefined,
  );
  const rowFor = (symbol: string) => SYMBOL_ROWS.find((row) => row.symbol === symbol);

  return (
    <>
      <JsonLd
        data={graph(
          organizationNode(),
          websiteNode(),
          webApplicationNode(),
          webPageNode({ path: "/", name: TITLE, description: DESCRIPTION, dateModified: DATASET.downloadedAt }),
        )}
      />
      <StatusStrip
        asOf={composite.lastBarTimestamp}
        source={DATASET.source}
        stale={quality?.stale}
        note={`${SYMBOLS.length} names covered`}
      />
      <PageShell>
        {/* --------------------------------------------------------------- */}
        {/* Masthead                                                          */}
        {/* --------------------------------------------------------------- */}
        <section className="grid-field relative mb-6 border border-hairline bg-surface sm:mb-8">
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:p-10">
            <div className="min-w-0">
              <Eyebrow className="mb-4">Market research workspace</Eyebrow>
              <h1 className="max-w-xl text-[30px] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[42px]">
                Every number on this page can be traced back to a formula.
              </h1>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-muted sm:mt-5">
                Returns, volatility, drawdown and indicators such as RSI, MACD and Bollinger Bands are computed from
                the same validated daily bars the charts draw, with the window and the sample size stated next to each
                figure.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 sm:mt-7">
                <Link
                  href={`/analytics/${ranked[0]?.symbol ?? SYMBOLS[0]}`}
                  className={buttonClass({ variant: "primary", size: "md" })}
                >
                  Open analytics
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
                <Link href="/performance" className={buttonClass({ variant: "secondary", size: "md" })}>
                  Run a backtest
                </Link>
              </div>
              <p className="mt-5 hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
                Press <Kbd>/</Kbd> anywhere to jump to a symbol.
              </p>
            </div>

            <CompositeCard
              last={composite.lastPrice}
              session={composite.lastChangePercent}
              year={composite.periodReturn}
              volatility={composite.volatility.annualized}
              drawdown={composite.drawdown.maxDrawdown}
              series={thinSeries(
                composite.bars.map((bar) => bar.adjClose),
                120,
              )}
            />
          </div>
        </section>

        <DataQualityNotice quality={quality} className="mb-8 sm:mb-10" />

        {/* --------------------------------------------------------------- */}
        {/* Aggregates                                                        */}
        {/* --------------------------------------------------------------- */}
        <section className="mb-10 sm:mb-12">
          <SectionHeading
            eyebrow="At a glance"
            title="Coverage in aggregate"
            description="Cross-sectional figures across every covered name, over the trailing year."
          />
          <MetricGrid>
            <MetricCell>
              <Metric
                label="Median 1Y return"
                value={formatPercent(median(yearReturns), { signed: true })}
                hint={`Across ${yearReturns.length} names`}
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Session breadth"
                value={`${advancing} / ${SYMBOL_ROWS.length}`}
                hint={<BreadthBar up={advancing} down={declining} total={SYMBOL_ROWS.length} />}
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Average volatility"
                value={formatPercent(
                  mean(
                    SYMBOL_ROWS.map((row) => row.summary.volatility.annualized).filter(
                      (value): value is number => value !== null,
                    ),
                  ),
                )}
                hint="Annualized, trailing year"
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Deepest drawdown"
                value={formatPercent(deepest.summary.drawdown.maxDrawdown)}
                hint={`${deepest.symbol}, worst of ${SYMBOL_ROWS.length} names`}
                size="lg"
              />
            </MetricCell>
          </MetricGrid>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Coverage, movers and the wire                                     */}
        {/* --------------------------------------------------------------- */}
        <section className="grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-8">
            <Panel className="min-w-0">
              <PanelHeader
                title="Coverage"
                eyebrow={`${SYMBOL_ROWS.length} names · trailing year`}
                actions={
                  <span className="hidden text-[11px] text-muted sm:inline">Select a row to open its analytics</span>
                }
              />
              <CoverageTable
                rows={SYMBOL_ROWS.map((row) => toCoverageRow(row.symbol, row.profile, row.summary))}
              />
            </Panel>

            <div className="grid gap-8 sm:grid-cols-2">
              <MoversPanel title="Twelve-month leaders" eyebrow="Best 1Y return" rows={leaders} />
              <MoversPanel title="Twelve-month laggards" eyebrow="Weakest 1Y return" rows={laggards} />
            </div>
          </div>

          <NewsPanel articles={NEWS_FEED.slice(0, 6)} title="The wire" className="min-w-0" />
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Guides and head-to-head comparisons                               */}
        {/* --------------------------------------------------------------- */}
        <section className="mt-12 grid gap-8 sm:mt-14 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="min-w-0">
            <SectionHeading
              eyebrow="Learn"
              title="How each figure is computed"
              description="Plain-language guides to the indicators and risk measures on these pages, each with the formula, the edge cases and live readings from the dataset."
              actions={
                <Link href="/learn" className={buttonClass({ variant: "secondary", size: "sm" })}>
                  All guides
                </Link>
              }
            />
            <ul className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
              {guides.map((guide) => (
                <li key={guide.slug} className="bg-surface">
                  <Link href={`/learn/${guide.slug}`} className="group flex h-full flex-col px-4 py-4 transition-colors hover:bg-sunken">
                    <Eyebrow>{guide.category}</Eyebrow>
                    <span className="mt-1.5 text-[13px] font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                      {guide.title}
                    </span>
                    <span className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-muted">{guide.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Panel className="min-w-0">
            <PanelHeader
              title="Head to head"
              eyebrow="Popular comparisons · 1Y return"
              actions={
                <Link href="/compare" className="text-[11px] font-semibold text-ink-soft hover:text-ink hover:underline">
                  All {COMPARISON_PAIRS.length}
                </Link>
              }
            />
            <ul className="divide-y divide-hairline">
              {POPULAR_PAIRS.map((pair) => (
                <li key={pair.slug}>
                  <Link
                    href={`/compare/${pair.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken"
                  >
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      {pair.first} <span className="font-sans font-normal text-muted">vs</span> {pair.second}
                    </span>
                    <span className="flex items-center gap-3 text-[12px]">
                      <Delta value={rowFor(pair.first)?.summary.periodReturn} className="w-[64px] text-right" />
                      <Delta value={rowFor(pair.second)?.summary.periodReturn} className="w-[64px] text-right" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </PageShell>
    </>
  );
}

function CompositeCard({
  last,
  session,
  year,
  volatility,
  drawdown,
  series,
}: {
  last: number | null;
  session: number | null;
  year: number | null;
  volatility: number | null;
  drawdown: number | null;
  series: number[];
}) {
  return (
    <div className="min-w-0 border border-hairline-strong bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <Eyebrow>SL10 composite</Eyebrow>
        <Badge tone={(year ?? 0) >= 0 ? "positive" : "negative"}>{formatPercent(year, { signed: true })} / 1Y</Badge>
      </div>
      <div className="flex items-end justify-between gap-4 px-4 pt-3 sm:px-5">
        <div>
          <p className="font-mono text-[30px] font-medium leading-none tracking-tight text-ink tabular-nums">
            {last === null ? "—" : last.toFixed(1)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">Equal-weight index, 100 at inception</p>
        </div>
        <div className="text-right">
          <Delta value={session} className="text-[14px]" />
          <p className="mt-0.5 text-[11px] text-muted">Latest session</p>
        </div>
      </div>
      <div className="px-4 pb-3 pt-4 sm:px-5">
        <Sparkline values={series} width={400} height={76} tone="ink" fill fluid label="SL10 composite over the past year" />
      </div>
      <div className="grid grid-cols-2 border-t border-hairline">
        <div className="border-r border-hairline px-4 py-3 sm:px-5">
          <Metric label="Volatility" value={formatPercent(volatility)} hint="Annualized" size="sm" />
        </div>
        <div className="px-4 py-3 sm:px-5">
          <Metric label="Max drawdown" value={formatPercent(drawdown)} hint="Past year" size="sm" />
        </div>
      </div>
      <Link
        href={`/analytics/${COMPOSITE_SYMBOL}`}
        className="flex items-center justify-between border-t border-hairline px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-sunken hover:text-ink sm:px-5"
      >
        Open the composite
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** Advancers against decliners as a two-tone rule, with the counts beside it. */
function BreadthBar({ up, down, total }: { up: number; down: number; total: number }) {
  const flat = Math.max(0, total - up - down);
  return (
    <span className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="flex h-1 w-full max-w-[160px] overflow-hidden bg-sunken">
        <span className="h-full bg-pos" style={{ width: `${(up / total) * 100}%` }} />
        <span className="h-full bg-hairline-strong" style={{ width: `${(flat / total) * 100}%` }} />
        <span className="h-full bg-neg" style={{ width: `${(down / total) * 100}%` }} />
      </span>
      <span>
        {up} up, {down} down on the latest session
      </span>
    </span>
  );
}

function MoversPanel({ title, eyebrow, rows }: { title: string; eyebrow: string; rows: SymbolRow[] }) {
  return (
    <Panel className="min-w-0">
      <PanelHeader title={title} eyebrow={eyebrow} />
      <ul className="divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.symbol}>
            <Link
              href={`/analytics/${row.symbol}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
            >
              <div className="min-w-0">
                <p className="font-mono text-[12px] font-semibold text-ink">{row.symbol}</p>
                <p className="truncate text-[11px] text-muted">{row.profile.sector}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Sparkline
                  values={thinSeries(
                    row.summary.bars.map((bar) => bar.adjClose),
                    48,
                  )}
                  width={64}
                  height={22}
                />
                <Delta value={row.summary.periodReturn} className="w-[68px] text-right text-[12px]" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Median of a numeric list, or null when empty. Local to this page's aggregates. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

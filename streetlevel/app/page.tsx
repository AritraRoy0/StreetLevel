import Link from "next/link";
import { Footer, PageShell, StatusStrip, TopNav } from "@/components/shell";
import { CoverageTable } from "@/components/coverage-table";
import { toCoverageRow } from "@/components/coverage-row";
import { NewsPanel } from "@/components/news-panel";
import { DataQualityNotice } from "@/components/data-quality-notice";
import { Badge, Eyebrow, Metric, MetricCell, MetricGrid, Panel, PanelHeader, SectionHeading } from "@/components/ui";
import { Sparkline } from "@/components/charts/sparkline";
import {
  COMPOSITE_BARS,
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  SYMBOL_ROWS,
  SYMBOLS,
} from "@/lib/market-data";
import { NEWS_FEED } from "@/lib/news-data";
import { buildSummary, formatPercent, mean } from "@/lib/analytics";

export const metadata = { title: "Overview" };

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

  const leaders = [...SYMBOL_ROWS]
    .filter((row) => row.summary.periodReturn !== null)
    .sort((a, b) => (b.summary.periodReturn ?? 0) - (a.summary.periodReturn ?? 0));

  const quality = DATA_QUALITY[SYMBOLS[0]];

  return (
    <>
      <TopNav />
      <StatusStrip
        asOf={composite.lastBarTimestamp}
        source={DATASET.source}
        stale={quality?.stale}
        note={`${SYMBOLS.length} names covered`}
      />
      <PageShell>
        <section className="grid-field relative mb-10 border border-hairline bg-surface">
          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            <div className="min-w-0">
              <Eyebrow className="mb-4">Market research workspace</Eyebrow>
              <h1 className="max-w-xl text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[46px]">
                Every number on this page can be traced back to a formula.
              </h1>
              <p className="mt-5 max-w-lg text-[14px] leading-relaxed text-muted">
                Returns, volatility, drawdown and the indicator set are computed from the same validated
                bar series the charts draw, with the window and the sample size stated next to each figure.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Link
                  href={`/analytics/${leaders[0]?.symbol ?? SYMBOLS[0]}`}
                  className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-surface transition-colors hover:bg-ink-soft"
                >
                  Open analytics
                </Link>
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-2 border border-hairline-strong px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-sunken"
                >
                  Portfolio attribution
                </Link>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <Eyebrow>SL10 composite</Eyebrow>
                <Badge tone={(composite.periodReturn ?? 0) >= 0 ? "positive" : "negative"}>
                  {formatPercent(composite.periodReturn, { signed: true })} / 1Y
                </Badge>
              </div>
              <div className="border border-hairline bg-surface p-5">
                <div className="flex items-end justify-between border-b border-hairline pb-4">
                  <div>
                    <p className="font-mono text-[26px] font-medium tracking-tight text-ink tabular-nums">
                      {composite.lastPrice === null ? "—" : composite.lastPrice.toFixed(1)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">Equal-weight index, 100 at inception</p>
                  </div>
                  <Sparkline
                    values={composite.bars.map((bar) => bar.adjClose)}
                    width={160}
                    height={44}
                    tone="ink"
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <Metric
                    label="Advancing"
                    value={`${advancing}`}
                    hint={`${declining} declining`}
                    size="sm"
                  />
                  <Metric
                    label="Volatility"
                    value={formatPercent(composite.volatility.annualized)}
                    hint="Annualized"
                    size="sm"
                  />
                  <Metric
                    label="Max drawdown"
                    value={formatPercent(composite.drawdown.maxDrawdown)}
                    hint="Past year"
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <DataQualityNotice quality={quality} className="mb-10" />

        <section className="mb-12">
          <SectionHeading
            eyebrow="At a glance"
            title="Coverage in aggregate"
            description="Cross-sectional figures across every covered name, over the trailing year."
            className="mb-0"
          />
          <MetricGrid className="border-t-0">
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
                hint="Names up on the latest session"
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Average volatility"
                value={formatPercent(
                  mean(SYMBOL_ROWS.map((row) => row.summary.volatility.annualized).filter((value): value is number => value !== null)),
                )}
                hint="Annualized, trailing year"
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Deepest drawdown"
                value={formatPercent(
                  Math.min(
                    ...SYMBOL_ROWS.map((row) => row.summary.drawdown.maxDrawdown ?? 0),
                  ),
                )}
                hint={`Worst of ${SYMBOL_ROWS.length} names`}
                size="lg"
              />
            </MetricCell>
          </MetricGrid>
        </section>

        <section className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <Panel className="min-w-0">
            <PanelHeader
              title="Coverage"
              eyebrow="Sortable"
              actions={<span className="text-[10px] uppercase tracking-wider text-faint">Click a column to sort</span>}
            />
            <CoverageTable
              rows={SYMBOL_ROWS.map((row) => toCoverageRow(row.symbol, row.profile, row.summary))}
            />
          </Panel>

          <div className="min-w-0 space-y-10">
            <NewsPanel articles={NEWS_FEED.slice(0, 6)} title="The wire" />

            <Panel>
              <PanelHeader title="Twelve-month leaders" eyebrow="Ranked" />
              <ul className="divide-y divide-hairline">
                {leaders.slice(0, 5).map((row) => (
                  <li key={row.symbol}>
                    <Link
                      href={`/analytics/${row.symbol}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[12px] font-semibold text-ink">{row.symbol}</p>
                        <p className="truncate text-[11px] text-muted">{row.profile.sector}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Sparkline values={row.summary.bars.slice(-60).map((bar) => bar.adjClose)} width={72} height={22} />
                        <span className="w-16 text-right font-mono text-[12px] tabular-nums text-ink">
                          {formatPercent(row.summary.periodReturn, { signed: true })}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </section>

        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

/** Median of a numeric list, or null when empty. Local to this page's aggregates. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

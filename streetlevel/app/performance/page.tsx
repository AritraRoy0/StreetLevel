import Link from "next/link";
import { Footer, PageHeader, PageShell, StatusStrip, TopNav } from "@/components/shell";
import { Delta, Metric, MetricCell, MetricGrid, Panel, PanelHeader, TableScroll, Td, Th } from "@/components/ui";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import {
  COMPOSITE_BARS,
  COMPOSITE_SYMBOL,
  DATA_QUALITY,
  DATASET,
  PRICE_BOOK,
  SYMBOL_ROWS,
  SYMBOLS,
} from "@/lib/market-data";
import {
  buildSummary,
  compareToBenchmark,
  correlationMatrix,
  averagePairwiseCorrelation,
  EMPTY,
  formatPercent,
  formatRatio,
  mean,
} from "@/lib/analytics";

export const metadata = { title: "Performance" };

export default function PerformancePage() {
  const quality = DATA_QUALITY[SYMBOLS[0]];
  const composite = buildSummary(COMPOSITE_SYMBOL, COMPOSITE_BARS, { range: "1Y" });

  /** Each name measured against the equal-weight composite over the same window. */
  const relative = SYMBOL_ROWS.map((row) => ({
    symbol: row.symbol,
    sector: row.profile.sector,
    comparison: compareToBenchmark(row.summary.bars, COMPOSITE_BARS, {
      baseSymbol: row.symbol,
      benchmarkSymbol: COMPOSITE_SYMBOL,
    }),
    summary: row.summary,
  })).sort((a, b) => (b.comparison.excessReturn ?? 0) - (a.comparison.excessReturn ?? 0));

  const sectors = Array.from(new Set(SYMBOL_ROWS.map((row) => row.profile.sector))).map((sector) => {
    const members = SYMBOL_ROWS.filter((row) => row.profile.sector === sector);
    return {
      sector,
      count: members.length,
      periodReturn: mean(
        members.map((row) => row.summary.periodReturn).filter((value): value is number => value !== null),
      ),
      volatility: mean(
        members
          .map((row) => row.summary.volatility.annualized)
          .filter((value): value is number => value !== null),
      ),
      drawdown: mean(
        members.map((row) => row.summary.drawdown.maxDrawdown).filter((value): value is number => value !== null),
      ),
    };
  }).sort((a, b) => (b.periodReturn ?? 0) - (a.periodReturn ?? 0));

  const matrix = correlationMatrix(SYMBOLS.map((symbol) => ({ symbol, bars: PRICE_BOOK[symbol] })));
  const best = relative[0];
  const worst = relative[relative.length - 1];

  return (
    <>
      <TopNav />
      <StatusStrip
        asOf={quality?.lastBar ?? null}
        source={DATASET.source}
        stale={quality?.stale}
        note="Trailing twelve months"
      />
      <PageShell>
        <PageHeader
          eyebrow="Relative to the SL10 composite"
          title="Performance"
          description="Every name measured against an equal-weight basket of the coverage list, aligned on the sessions both actually traded."
        />

        <section className="mb-10">
          <MetricGrid>
            <MetricCell>
              <Metric
                label="Composite return"
                value={formatPercent(composite.periodReturn, { signed: true })}
                hint="Equal-weight, trailing year"
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Composite volatility"
                value={formatPercent(composite.volatility.annualized)}
                hint={`${composite.volatility.observations} daily returns`}
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Widest outperformance"
                value={formatPercent(best?.comparison.excessReturn, { signed: true })}
                hint={best?.symbol}
                size="lg"
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Average correlation"
                value={formatRatio(averagePairwiseCorrelation(matrix.matrix))}
                hint="Pairwise, daily returns"
                size="lg"
              />
            </MetricCell>
          </MetricGrid>
        </section>

        <Panel className="mb-10">
          <PanelHeader
            title={`${best?.symbol ?? EMPTY} against the composite`}
            eyebrow="Widest spread in the coverage list"
          />
          <div className="p-4">
            {best && (
              <ComparisonChart
                points={best.comparison.normalized}
                baseLabel={best.symbol}
                benchmarkLabel={COMPOSITE_SYMBOL}
                height={220}
              />
            )}
          </div>
          <p className="border-t border-hairline px-4 py-2.5 text-[11px] text-muted">
            {best?.symbol} leads the basket by {formatPercent(best?.comparison.excessReturn)} over the year;{" "}
            {worst?.symbol} trails it by {formatPercent(Math.abs(worst?.comparison.excessReturn ?? 0))}.
          </p>
        </Panel>

        <section className="grid gap-10 xl:grid-cols-[1.4fr_1fr]">
          <Panel className="min-w-0">
            <PanelHeader title="Relative strength" eyebrow="Ranked by excess return" />
            <TableScroll>
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    <Th>Symbol</Th>
                    <Th align="right">Return</Th>
                    <Th align="right">Excess</Th>
                    <Th align="right">Beta</Th>
                    <Th align="right">Correlation</Th>
                    <Th align="right">Tracking error</Th>
                    <Th align="right" className="hidden lg:table-cell">
                      Info ratio
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {relative.map((row) => (
                    <tr key={row.symbol} className="hover:bg-sunken">
                      <Td>
                        <Link href={`/analytics/${row.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                          {row.symbol}
                        </Link>
                        <span className="mt-0.5 block max-w-[150px] truncate text-[11px] text-muted">{row.sector}</span>
                      </Td>
                      <Td align="right">
                        <Delta value={row.comparison.baseReturn} />
                      </Td>
                      <Td align="right">
                        <Delta value={row.comparison.excessReturn} />
                      </Td>
                      <Td align="right">{formatRatio(row.comparison.beta)}</Td>
                      <Td align="right">{formatRatio(row.comparison.correlation)}</Td>
                      <Td align="right">{formatPercent(row.comparison.trackingError)}</Td>
                      <Td align="right" className="hidden lg:table-cell">
                        {formatRatio(row.comparison.informationRatio)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <p className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
              Beta is the slope of each name&apos;s daily returns regressed on the composite&apos;s. Tracking error is
              the annualized deviation of the return difference, and the information ratio divides annualized excess
              return by it.
            </p>
          </Panel>

          <div className="min-w-0 space-y-10">
            <Panel>
              <PanelHeader title="By sector" eyebrow="Equal-weight within each group" />
              <div className="divide-y divide-hairline">
                {sectors.map((sector) => (
                  <div key={sector.sector} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] font-semibold text-ink">{sector.sector}</span>
                      <Delta value={sector.periodReturn} className="text-[12px]" />
                    </div>
                    <div className="mt-2 h-1 bg-sunken">
                      <div
                        className="h-full bg-ink"
                        style={{ width: `${Math.min(100, Math.abs((sector.periodReturn ?? 0) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted">
                      {sector.count} {sector.count === 1 ? "name" : "names"} · volatility{" "}
                      {formatPercent(sector.volatility)} · average max drawdown {formatPercent(sector.drawdown)}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Risk lens" eyebrow="Cross-sectional, trailing year" />
              <div className="grid grid-cols-2 gap-y-5 p-4">
                <Metric
                  label="Highest volatility"
                  value={
                    formatPercent(
                      Math.max(
                        ...SYMBOL_ROWS.map((row) => row.summary.volatility.annualized ?? 0),
                      ),
                    )
                  }
                  hint={
                    SYMBOL_ROWS.reduce((worstRow, row) =>
                      (row.summary.volatility.annualized ?? 0) > (worstRow.summary.volatility.annualized ?? 0)
                        ? row
                        : worstRow,
                    ).symbol
                  }
                  size="sm"
                />
                <Metric
                  label="Deepest drawdown"
                  value={formatPercent(Math.min(...SYMBOL_ROWS.map((row) => row.summary.drawdown.maxDrawdown ?? 0)))}
                  hint={
                    SYMBOL_ROWS.reduce((worstRow, row) =>
                      (row.summary.drawdown.maxDrawdown ?? 0) < (worstRow.summary.drawdown.maxDrawdown ?? 0)
                        ? row
                        : worstRow,
                    ).symbol
                  }
                  size="sm"
                />
                <Metric
                  label="Best Sharpe"
                  value={formatRatio(Math.max(...SYMBOL_ROWS.map((row) => row.summary.sharpe ?? -Infinity)))}
                  hint="Risk-free rate of zero"
                  size="sm"
                />
                <Metric
                  label="Composite drawdown"
                  value={formatPercent(composite.drawdown.maxDrawdown)}
                  hint="Diversification effect"
                  size="sm"
                />
              </div>
            </Panel>
          </div>
        </section>

        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

"use client";

/**
 * Portfolio analytics.
 *
 * Two things are kept visible throughout because they are what make the rest
 * trustworthy: which holdings could not be priced, and the difference between
 * a time-weighted return and a simple one. Deposits and withdrawals move the
 * account value without being performance, and a page that blurs the two
 * flatters whoever added money on a good week.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { PriceChart } from "@/components/charts/price-chart";
import {
  Badge,
  Callout,
  Delta,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  Segmented,
  TableScroll,
  Td,
  Th,
} from "@/components/ui";
import {
  EMPTY,
  formatCount,
  formatDate,
  formatPercent,
  formatPrice,
  formatPriceChange,
  formatRatio,
} from "@/lib/analytics";
import type { Bar, PortfolioAnalytics } from "@/lib/analytics";
import { PORTFOLIO_NOTE } from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

type Tab = "positions" | "allocation" | "correlation";

export function PortfolioView({
  portfolio,
  sparklines,
}: {
  portfolio: PortfolioAnalytics;
  sparklines: Record<string, number[]>;
}) {
  const [tab, setTab] = useState<Tab>("positions");

  /**
   * The value series is charted through the same component the price charts
   * use, so it inherits the crosshair, the axis formatting and the weekend
   * handling rather than reimplementing them.
   */
  const valueBars: Bar[] = useMemo(
    () =>
      portfolio.series.map((point) => ({
        timestamp: point.timestamp,
        open: point.value,
        high: point.value,
        low: point.value,
        close: point.value,
        adjClose: point.value,
        volume: 0,
      })),
    [portfolio.series],
  );

  const pricedPositions = portfolio.positions.filter((position) => position.priced);
  const unpriced = portfolio.positions.filter((position) => !position.priced);

  return (
    <div className="space-y-10">
      {portfolio.unpricedSymbols.length > 0 && (
        <Callout tone="warning" title="Some holdings could not be valued">
          <p>
            {portfolio.unpricedSymbols.join(", ")}{" "}
            {portfolio.unpricedSymbols.length === 1 ? "has" : "have"} no price history in the bundled dataset. Those
            positions are listed below but excluded from total value, weights and portfolio risk, rather than being
            counted as zero.
          </p>
          <p className="mt-1.5">
            {formatPrice(portfolio.unpricedCostBasis)} of cost basis sits in{" "}
            {portfolio.unpricedSymbols.length === 1 ? "that holding" : "those holdings"}, which is why total value
            less net contributions falls short of realized plus unrealized profit by exactly that amount.
          </p>
        </Callout>
      )}

      <section>
        <MetricGrid>
          <MetricCell>
            <Metric
              label="Total value"
              value={formatPrice(portfolio.totalValue)}
              hint={`${formatPrice(portfolio.cash)} cash · ${formatPercent(portfolio.cashWeight, { digits: 1 })} of book`}
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Time-weighted return"
              value={formatPercent(portfolio.timeWeightedReturn, { signed: true })}
              hint="Neutral to deposit and withdrawal timing"
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Unrealized"
              value={formatPriceChange(portfolio.unrealizedPl)}
              hint={`Against ${formatPrice(portfolio.investedValue)} of cost basis`}
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Realized"
              value={formatPriceChange(portfolio.realizedPl)}
              hint="Banked on closed lots and dividends"
              size="lg"
            />
          </MetricCell>

          <MetricCell>
            <Metric
              label="Portfolio volatility"
              value={formatPercent(portfolio.volatility)}
              hint={`Annualized from ${formatCount(portfolio.series.length)} daily valuations`}
            />
          </MetricCell>
          <MetricCell>
            <Metric label="Max drawdown" value={formatPercent(portfolio.maxDrawdown)} hint="Peak to trough of account value" />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Diversification"
              value={formatRatio(portfolio.effectiveHoldings)}
              hint={`Effective holdings · avg correlation ${formatRatio(portfolio.averageCorrelation)}`}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Net contributions"
              value={formatPrice(portfolio.netContributions)}
              hint="Deposits less withdrawals"
            />
          </MetricCell>
        </MetricGrid>
      </section>

      <Panel>
        <PanelHeader
          title="Account value"
          eyebrow={`${portfolio.series.length} sessions marked to market`}
          actions={
            <span className="text-[10px] uppercase tracking-wider text-faint">
              Holdings plus cash, including external flows
            </span>
          }
        />
        <div className="p-4">
          {valueBars.length > 1 ? (
            <PriceChart
              bars={valueBars}
              chartType="area"
              showVolume={false}
              height={260}
              readout="value"
              valueLabel="Account value"
            />
          ) : (
            <p className="py-8 text-center text-[12px] text-muted">
              Not enough valued sessions to chart the account.
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Holdings"
          eyebrow={`${pricedPositions.length} priced${unpriced.length ? ` · ${unpriced.length} unpriced` : ""}`}
          actions={
            <Segmented
              size="sm"
              label="Holdings view"
              value={tab}
              onChange={setTab}
              options={[
                { value: "positions", label: "Positions" },
                { value: "allocation", label: "Allocation" },
                { value: "correlation", label: "Correlation" },
              ]}
            />
          }
        />

        {tab === "positions" && <PositionsTable portfolio={portfolio} sparklines={sparklines} />}
        {tab === "allocation" && <AllocationView portfolio={portfolio} />}
        {tab === "correlation" && <CorrelationMatrix portfolio={portfolio} />}
      </Panel>

      <p className="border-t border-hairline pt-4 text-[11px] leading-relaxed text-muted">
        {PORTFOLIO_NOTE} Cost basis uses first-in, first-out lots, with commissions capitalized into the purchase
        price. Contribution measures each position&apos;s share of the portfolio&apos;s return over the window, with
        cash moved into or out of the position removed first.
      </p>
    </div>
  );
}

function PositionsTable({
  portfolio,
  sparklines,
}: {
  portfolio: PortfolioAnalytics;
  sparklines: Record<string, number[]>;
}) {
  return (
    <TableScroll>
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr>
            <Th>Symbol</Th>
            <Th align="right">Shares</Th>
            <Th align="right">Avg cost</Th>
            <Th align="right">Last</Th>
            <Th align="right">Value</Th>
            <Th align="right">Unrealized</Th>
            <Th align="right">Return</Th>
            <Th align="right">Contribution</Th>
            <Th align="right">Weight</Th>
            <Th align="right" className="hidden xl:table-cell">
              Trend
            </Th>
          </tr>
        </thead>
        <tbody>
          {portfolio.positions.map((position) => (
            <tr key={position.symbol} className={cn("hover:bg-sunken", !position.priced && "opacity-70")}>
              <Td>
                {position.priced ? (
                  <Link href={`/analytics/${position.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                    {position.symbol}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-muted">{position.symbol}</span>
                    <Badge tone="warning">No price</Badge>
                  </span>
                )}
              </Td>
              <Td align="right">{formatCount(position.shares)}</Td>
              <Td align="right">{formatPrice(position.averageCost)}</Td>
              <Td align="right">{formatPrice(position.lastPrice)}</Td>
              <Td align="right">{formatPrice(position.marketValue)}</Td>
              <Td align="right">
                <span
                  className={cn(
                    position.unrealizedPl === null
                      ? "text-faint"
                      : position.unrealizedPl >= 0
                        ? "text-pos"
                        : "text-neg",
                  )}
                >
                  {formatPriceChange(position.unrealizedPl)}
                </span>
              </Td>
              <Td align="right">
                <Delta value={position.unrealizedPlPercent} />
              </Td>
              <Td align="right">
                <Delta value={position.contribution} />
              </Td>
              <Td align="right">{formatPercent(position.weight, { digits: 1 })}</Td>
              <Td align="right" className="hidden xl:table-cell">
                <div className="flex justify-end">
                  <Sparkline values={sparklines[position.symbol] ?? []} width={72} height={22} />
                </div>
              </Td>
            </tr>
          ))}
          <tr className="bg-sunken">
            <Td>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cash</span>
            </Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{formatPrice(portfolio.cash)}</Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{EMPTY}</Td>
            <Td align="right">{formatPercent(portfolio.cashWeight, { digits: 1 })}</Td>
            <Td align="right" className="hidden xl:table-cell" />
          </tr>
        </tbody>
      </table>
    </TableScroll>
  );
}

function AllocationView({ portfolio }: { portfolio: PortfolioAnalytics }) {
  const rows = [
    ...portfolio.positions
      .filter((position) => position.weight !== null)
      .map((position) => ({ label: position.symbol, weight: position.weight ?? 0, kind: "holding" as const })),
    { label: "Cash", weight: portfolio.cashWeight ?? 0, kind: "cash" as const },
  ].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-4 p-4">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[70px_1fr_60px] items-center gap-3">
          <span className={cn("font-mono text-[12px]", row.kind === "cash" ? "text-muted" : "font-semibold text-ink")}>
            {row.label}
          </span>
          <div className="h-1.5 bg-sunken">
            <div
              className={cn("h-full", row.kind === "cash" ? "bg-hairline-strong" : "bg-ink")}
              style={{ width: `${Math.min(100, row.weight * 100)}%` }}
            />
          </div>
          <span className="text-right font-mono text-[12px] tabular-nums text-ink-soft">
            {formatPercent(row.weight, { digits: 1 })}
          </span>
        </div>
      ))}

      <div className="grid gap-4 border-t border-hairline pt-4 sm:grid-cols-3">
        <Metric
          label="Largest position"
          value={formatPercent(portfolio.largestWeight, { digits: 1 })}
          hint="Concentration in one name"
          size="sm"
        />
        <Metric
          label="Effective holdings"
          value={formatRatio(portfolio.effectiveHoldings)}
          hint="Inverse Herfindahl index of the weights"
          size="sm"
        />
        <Metric
          label="Cash"
          value={formatPercent(portfolio.cashWeight, { digits: 1 })}
          hint={formatPrice(portfolio.cash)}
          size="sm"
        />
      </div>
    </div>
  );
}

function CorrelationMatrix({ portfolio }: { portfolio: PortfolioAnalytics }) {
  const { symbols, matrix } = portfolio.correlation;

  if (symbols.length < 2) {
    return <p className="px-4 py-8 text-center text-[12px] text-muted">At least two priced holdings are needed.</p>;
  }

  return (
    <div className="p-4">
      <TableScroll>
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              <Th />
              {symbols.map((symbol) => (
                <Th key={symbol} align="right">
                  {symbol}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((rowSymbol, rowIndex) => (
              <tr key={rowSymbol}>
                <Td>
                  <span className="font-mono text-[11px] font-semibold text-ink">{rowSymbol}</span>
                </Td>
                {symbols.map((columnSymbol, columnIndex) => {
                  const value = matrix[rowIndex][columnIndex];
                  // Shade by magnitude so clusters of co-movement are visible at a glance.
                  const intensity = value === null ? 0 : Math.abs(value) * 0.22;
                  return (
                    <Td
                      key={columnSymbol}
                      align="right"
                      style={{ background: value === null ? undefined : `rgba(14,16,15,${intensity.toFixed(3)})` }}
                    >
                      {value === null ? EMPTY : value.toFixed(2)}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Pearson correlation of daily returns, each pair aligned on the sessions both traded. Average pairwise
        correlation is {formatRatio(portfolio.averageCorrelation)}; a lower figure means the holdings move more
        independently. Cells stay blank where a pair shares too few sessions to estimate.
      </p>
      <p className="mt-2 text-[11px] text-faint">
        Value series runs to {formatDate(portfolio.series[portfolio.series.length - 1]?.timestamp ?? null)}.
      </p>
    </div>
  );
}

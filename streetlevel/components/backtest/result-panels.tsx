"use client";

/**
 * The result panels: headline statistics, the trade ledger, the benchmark
 * comparison and the sweep heatmap.
 *
 * Sample size is shown next to every ratio. A win rate over eight trades and
 * one over eight hundred read identically unless the count sits beside them,
 * and on a single year of data the count is nearly always the more important
 * of the two numbers.
 */

import { useState } from "react";
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
import { ComparisonChart } from "@/components/charts/comparison-chart";
import {
  EMPTY,
  formatCount,
  formatDate,
  formatPercent,
  formatPrice,
  formatPriceChange,
  formatRatio,
} from "@/lib/analytics";
import type { BacktestResult, SweepResult, Trade, WalkForwardResult } from "@/lib/backtest";
import type { BenchmarkReport } from "@/lib/backtest";
import { cn } from "@/lib/utils";

export function HeadlineStatistics({ result, className }: { result: BacktestResult; className?: string }) {
  const stats = result.statistics;

  return (
    <section className={className}>
      <MetricGrid>
        <MetricCell>
          <Metric
            label="Total return"
            value={formatPercent(result.totalReturn, { signed: true })}
            hint={`Buy and hold returned ${formatPercent(result.benchmarkTotalReturn, { signed: true })}`}
            size="lg"
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Annualized"
            value={formatPercent(result.cagr)}
            hint={`${result.equity.length} sessions simulated`}
            size="lg"
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Max drawdown"
            value={formatPercent(result.maxDrawdown)}
            hint="Peak to trough of the equity curve"
            size="lg"
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Sharpe"
            value={formatRatio(result.sharpe)}
            hint={`Sortino ${formatRatio(result.sortino)} · Calmar ${formatRatio(result.calmar)}`}
            size="lg"
          />
        </MetricCell>

        <MetricCell>
          <Metric
            label="Closed trades"
            value={formatCount(stats.closedTrades)}
            hint={stats.openTrades > 0 ? `${stats.openTrades} still open at the end` : "None left open"}
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Win rate"
            value={formatPercent(stats.winRate, { digits: 0 })}
            hint={`${stats.wins} up, ${stats.losses} down${stats.scratches > 0 ? `, ${stats.scratches} flat` : ""}`}
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Profit factor"
            value={formatRatio(stats.profitFactor)}
            hint={`Expectancy ${formatPriceChange(stats.expectancy)} per trade`}
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Exposure"
            value={formatPercent(stats.exposure, { digits: 0 })}
            hint={`Volatility ${formatPercent(result.volatility)} · turnover ${formatRatio(stats.turnover)}x`}
          />
        </MetricCell>
      </MetricGrid>

      {result.warnings.length > 0 && (
        <Callout tone="warning" title="About this run" className="mt-4">
          <ul className="space-y-0.5">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Callout>
      )}
    </section>
  );
}

export function TradeLedger({ result, className }: { result: BacktestResult; className?: string }) {
  const [showAll, setShowAll] = useState(false);
  const trades = showAll ? result.trades : result.trades.slice(0, 12);

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Trade ledger"
        eyebrow={`${result.trades.length} round ${result.trades.length === 1 ? "trip" : "trips"}`}
        actions={
          result.trades.length > 12 ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="border border-hairline px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-ink"
            >
              {showAll ? "Show first 12" : `Show all ${result.trades.length}`}
            </button>
          ) : undefined
        }
      />

      {trades.length === 0 ? (
        <p className="px-4 py-10 text-center text-[12px] text-muted">
          The rule never opened a position over this window.
        </p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                <Th>Entry</Th>
                <Th align="right">Price</Th>
                <Th>Exit</Th>
                <Th align="right">Price</Th>
                <Th align="right">Shares</Th>
                <Th align="right">Net</Th>
                <Th align="right">Return</Th>
                <Th align="right">Bars</Th>
                <Th align="right" className="hidden lg:table-cell">
                  Worst / best
                </Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <p className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        Net profit is the mid-price gross less every commission and friction charge on both legs. Worst and best are
        the excursions reached while the position was open, measured from bar lows and highs.
      </p>
    </Panel>
  );
}

const REASON_LABEL: Record<string, string> = {
  signal: "Signal",
  stop_loss: "Stop",
  take_profit: "Target",
  trailing_stop: "Trail",
  max_hold: "Time",
  end_of_data: "End",
};

function TradeRow({ trade }: { trade: Trade }) {
  return (
    <tr className={cn("hover:bg-sunken", trade.open && "opacity-75")}>
      <Td>{formatDate(trade.entryTimestamp)}</Td>
      <Td align="right">{formatPrice(trade.entryPrice)}</Td>
      <Td>{trade.open ? <span className="text-faint">Open</span> : formatDate(trade.exitTimestamp)}</Td>
      <Td align="right">{formatPrice(trade.exitPrice)}</Td>
      <Td align="right">{formatCount(trade.shares)}</Td>
      <Td align="right">
        <span
          className={cn(
            trade.netProfit === null ? "text-faint" : trade.netProfit >= 0 ? "text-pos" : "text-neg",
          )}
        >
          {formatPriceChange(trade.netProfit)}
        </span>
      </Td>
      <Td align="right">
        <Delta value={trade.returnPct} />
      </Td>
      <Td align="right">{trade.holdingBars}</Td>
      <Td align="right" className="hidden lg:table-cell">
        <span className="text-neg">{formatPercent(trade.mae, { digits: 1 })}</span>
        <span className="text-faint"> / </span>
        <span className="text-pos">{formatPercent(trade.mfe, { digits: 1 })}</span>
      </Td>
      <Td>
        {trade.open ? (
          <Badge tone="neutral">Open</Badge>
        ) : (
          <Badge tone={trade.exitReason === "stop_loss" || trade.exitReason === "trailing_stop" ? "negative" : "neutral"}>
            {REASON_LABEL[trade.exitReason ?? "signal"] ?? trade.exitReason}
          </Badge>
        )}
      </Td>
    </tr>
  );
}

export function BenchmarkPanel({
  report,
  result,
  className,
}: {
  report: BenchmarkReport;
  result: BacktestResult;
  className?: string;
}) {
  const comparison = report.versusBuyAndHold;

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Against buy and hold"
        eyebrow="Both legs rebased to 100, both paying the same costs"
        actions={
          report.ruleEdge === null ? undefined : (
            <Badge tone={report.ruleEdge > 0 ? "positive" : "negative"}>
              {report.ruleEdge > 0 ? "Rule ahead" : "Rule behind"} {formatPercent(Math.abs(report.ruleEdge))}
            </Badge>
          )
        }
      />

      <div className="p-4">
        <ComparisonChart
          points={comparison.normalized}
          baseLabel="Strategy"
          benchmarkLabel={`${result.symbol} hold`}
          height={220}
        />
      </div>

      <div className="grid grid-cols-2 gap-y-5 border-t border-hairline px-4 py-4 sm:grid-cols-4">
        <Metric
          label="Rule edge"
          value={formatPercent(report.ruleEdge, { signed: true })}
          hint="Strategy less buy and hold"
          size="sm"
        />
        <Metric label="Beta" value={formatRatio(comparison.beta)} hint="Against holding" size="sm" />
        <Metric
          label="Correlation"
          value={formatRatio(comparison.correlation)}
          hint={`${comparison.alignedPoints} sessions`}
          size="sm"
        />
        <Metric
          label="Cost drag"
          value={formatPercent(report.costDrag, { signed: true })}
          hint={`${formatPrice(report.commissionPaid + report.frictionPaid)} paid away`}
          size="sm"
        />
      </div>

      {report.versusComposite && (
        <div className="grid grid-cols-2 gap-y-5 border-t border-hairline px-4 py-4 sm:grid-cols-4">
          <Metric
            label="Against SL10"
            value={formatPercent(report.versusComposite.excessReturn, { signed: true })}
            hint="Excess over the composite"
            size="sm"
          />
          <Metric label="Beta to SL10" value={formatRatio(report.versusComposite.beta)} hint="Market sensitivity" size="sm" />
          <Metric
            label="Tracking error"
            value={formatPercent(report.versusComposite.trackingError)}
            hint={`Info ratio ${formatRatio(report.versusComposite.informationRatio)}`}
            size="sm"
          />
          <Metric
            label="Frictionless"
            value={formatPercent(report.frictionlessReturn, { signed: true })}
            hint="Same rule with costs switched off"
            size="sm"
          />
        </div>
      )}

      {report.warnings.length > 0 && (
        <ul className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
          {report.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The parameter sweep, shown as a heatmap over the two axes.
 *
 * The legend is anchored on the distribution of the grid rather than on the
 * best cell, so a grid where everything is mediocre does not render a bright
 * winner. The deflated Sharpe sits immediately under it, because the best cell
 * is meaningless without it.
 */
export function SweepPanel({
  sweep,
  metric,
  onMetricChange,
  onSelectCell,
  className,
}: {
  sweep: SweepResult;
  metric: "sharpe" | "totalReturn" | "maxDrawdown";
  onMetricChange: (metric: "sharpe" | "totalReturn" | "maxDrawdown") => void;
  onSelectCell: (params: Record<string, number>) => void;
  className?: string;
}) {
  const [rowAxis, columnAxis] = sweep.axes;

  const values = sweep.cells
    .map((cell) => cell[metric])
    .filter((value): value is number => value !== null);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;

  const shadeOf = (value: number | null): string => {
    if (value === null || max === min) return "transparent";
    const scaled = (value - min) / (max - min);
    // Ink for strength rather than a hue ramp, which keeps the grid readable
    // for anyone who cannot separate red from green.
    return `rgba(14, 16, 15, ${(0.05 + scaled * 0.5).toFixed(3)})`;
  };

  const format = (value: number | null) =>
    metric === "sharpe" ? formatRatio(value) : formatPercent(value, { digits: 0 });

  if (!rowAxis || !columnAxis) {
    return (
      <Panel className={cn("min-w-0", className)}>
        <PanelHeader title="Parameter sweep" eyebrow="Needs two axes" />
        <p className="px-4 py-8 text-center text-[12px] text-muted">
          This rule does not have two parameters to sweep.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Parameter sweep"
        eyebrow={`${sweep.cells.length} cells · ${rowAxis.param} against ${columnAxis.param}`}
        actions={
          <Segmented
            size="sm"
            label="Heatmap metric"
            value={metric}
            onChange={onMetricChange}
            options={[
              { value: "sharpe", label: "Sharpe" },
              { value: "totalReturn", label: "Return" },
              { value: "maxDrawdown", label: "Drawdown" },
            ]}
          />
        }
      />

      <div className="p-4">
        <TableScroll>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th className="sticky left-0 bg-surface">{rowAxis.param}</Th>
                {columnAxis.values.map((value) => (
                  <Th key={value} align="right">
                    {value}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowAxis.values.map((rowValue) => (
                <tr key={rowValue}>
                  <Td className="sticky left-0 bg-surface font-mono text-[11px] font-semibold text-ink">{rowValue}</Td>
                  {columnAxis.values.map((columnValue) => {
                    const cell = sweep.cells.find(
                      (candidate) =>
                        candidate.params[rowAxis.param] === rowValue &&
                        candidate.params[columnAxis.param] === columnValue,
                    );
                    const value = cell ? cell[metric] : null;
                    const isBest = cell !== undefined && sweep.best !== null && cell === sweep.best;
                    return (
                      <Td
                        key={columnValue}
                        align="right"
                        style={{ background: shadeOf(value) }}
                        className={cn("cursor-pointer", isBest && "outline outline-1 outline-accent")}
                      >
                        <button
                          type="button"
                          onClick={() => cell && onSelectCell(cell.params)}
                          className="w-full text-right font-mono tabular-nums"
                          title={
                            cell
                              ? `${cell.closedTrades} trades · return ${formatPercent(cell.totalReturn)} · Sharpe ${formatRatio(cell.sharpe)}`
                              : "No result"
                          }
                        >
                          {value === null ? EMPTY : format(value)}
                        </button>
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <div className="grid grid-cols-2 gap-y-5 border-t border-hairline px-4 py-4 sm:grid-cols-4">
        <Metric
          label="Best Sharpe"
          value={formatRatio(sweep.distribution.bestSharpe)}
          hint={sweep.best ? Object.entries(sweep.best.params).map(([key, value]) => `${key} ${value}`).join(", ") : EMPTY}
          size="sm"
        />
        <Metric
          label="Median Sharpe"
          value={formatRatio(sweep.distribution.medianSharpe)}
          hint={`Spread ${formatRatio(sweep.distribution.sharpeSpread)}`}
          size="sm"
        />
        <Metric
          label="Cells profitable"
          value={formatPercent(sweep.distribution.fractionProfitable, { digits: 0 })}
          hint={`${sweep.distribution.withTrades} of ${sweep.distribution.count} produced a result`}
          size="sm"
        />
        <Metric
          label="Deflated Sharpe"
          value={formatPercent(sweep.deflatedSharpe, { digits: 0 })}
          hint={`Bar to clear ${formatRatio(sweep.expectedMaxSharpeUnderNull)}`}
          size="sm"
        />
      </div>

      <div className="border-t border-hairline px-4 py-3 text-[11px] leading-relaxed text-muted">
        <p>
          The deflated Sharpe is the probability that the best cell is genuinely above zero once the number of cells
          searched is priced in. Searching a grid raises the best result even when every rule in it is worthless, and
          the expected best under that null is shown beside it as the bar to clear.
        </p>
        {sweep.warnings.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-faint">
            {sweep.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-faint">Click a cell to load its parameters into the strategy.</p>
      </div>
    </Panel>
  );
}

export function WalkForwardPanel({
  result,
  className,
}: {
  result: WalkForwardResult;
  className?: string;
}) {
  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Walk forward"
        eyebrow="Parameters chosen in sample, measured out of sample"
        actions={
          result.efficiency === null ? undefined : (
            <Badge tone={result.efficiency > 0.5 ? "positive" : "warning"}>
              Efficiency {formatRatio(result.efficiency)}
            </Badge>
          )
        }
      />

      {result.folds.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-muted">
          The window is too short to split into folds.
        </p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <Th>Fold</Th>
                <Th>Chosen</Th>
                <Th align="right">In-sample</Th>
                <Th align="right">Out-of-sample</Th>
                <Th align="right">OOS trades</Th>
                <Th>Out-of-sample window</Th>
              </tr>
            </thead>
            <tbody>
              {result.folds.map((fold) => (
                <tr key={fold.index} className="hover:bg-sunken">
                  <Td>{fold.index + 1}</Td>
                  <Td>
                    <span className="font-mono text-[11px]">
                      {Object.entries(fold.chosenParams).map(([key, value]) => `${key} ${value}`).join(", ") || EMPTY}
                    </span>
                  </Td>
                  <Td align="right">
                    <Delta value={fold.inSampleReturn} />
                  </Td>
                  <Td align="right">
                    <Delta value={fold.outOfSampleReturn} />
                  </Td>
                  <Td align="right">{fold.outOfSampleTrades}</Td>
                  <Td>
                    {formatDate(fold.outOfSampleStart)} to {formatDate(fold.outOfSampleEnd)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}

      <div className="grid grid-cols-2 gap-y-5 border-t border-hairline px-4 py-4 sm:grid-cols-4">
        <Metric label="Mean in-sample" value={formatPercent(result.meanInSampleReturn, { signed: true })} size="sm" />
        <Metric label="Mean out-of-sample" value={formatPercent(result.meanOutOfSampleReturn, { signed: true })} size="sm" />
        <Metric label="Efficiency" value={formatRatio(result.efficiency)} hint="Out over in" size="sm" />
        <Metric label="Folds positive" value={formatPercent(result.hitRate, { digits: 0 })} size="sm" />
      </div>

      <div className="border-t border-hairline px-4 py-3 text-[11px] leading-relaxed text-muted">
        <p>
          Each fold picks parameters on the earlier slice and measures them on the slice that follows, which the
          choice never saw. This is the only figure on the page that the search did not contaminate.
        </p>
        {result.warnings.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 text-faint">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

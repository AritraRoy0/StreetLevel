/**
 * The live panel on each guide: the measure the guide explains, computed
 * across the coverage list from the bundled dataset.
 *
 * Rendered on the server at build time. Every figure comes from the same
 * one-year snapshots the overview and analytics pages draw, so a reading here
 * is the reading the symbol's own page shows, and each row links there.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { LinkRow } from "@/components/link-row";
import {
  Badge,
  Delta,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  PanelNote,
  TableScroll,
  Td,
  Th,
} from "@/components/ui";
import type { Tone } from "@/components/ui";
import {
  COMPOSITE_BARS,
  COMPOSITE_SYMBOL,
  DATASET,
  PRICE_BOOK,
  SYMBOL_ROWS,
  SYMBOLS,
} from "@/lib/market-data";
import type { SymbolRow } from "@/lib/market-data";
import {
  EMPTY,
  averagePairwiseCorrelation,
  compareToBenchmark,
  correlationMatrix,
  formatDate,
  formatPercent,
  formatPoints,
  formatPrice,
  formatRatio,
  resolveRange,
} from "@/lib/analytics";
import { DEFAULT_STRATEGY, RULE_DEFINITIONS, integerRange, sweep, walkForward } from "@/lib/backtest";
import type { StrategySpec, SweepAxis } from "@/lib/backtest";
import type { LiveKey } from "@/lib/learn/guides";

interface Column {
  label: string;
  align?: "left" | "right";
  render: (row: SymbolRow) => ReactNode;
}

const ASOF = SYMBOL_ROWS[0]?.summary.lastBarTimestamp ?? DATASET.to;

/** One row per covered name, linked to its analytics page. */
function SymbolTable({ rows, columns, caption }: { rows: SymbolRow[]; columns: Column[]; caption: string }) {
  return (
    <TableScroll>
      <table className="w-full min-w-[520px] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <Th>Symbol</Th>
            {columns.map((column) => (
              <Th key={column.label} align={column.align ?? "right"}>
                {column.label}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LinkRow key={row.symbol} href={`/analytics/${row.symbol}`}>
              <Td>
                <Link href={`/analytics/${row.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                  {row.symbol}
                </Link>
                <span className="mt-0.5 block max-w-[160px] truncate text-[11px] text-muted">{row.profile.name}</span>
              </Td>
              {columns.map((column) => (
                <Td key={column.label} align={column.align ?? "right"}>
                  {column.render(row)}
                </Td>
              ))}
            </LinkRow>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function LiveFrame({
  title,
  eyebrow,
  note,
  children,
}: {
  title: string;
  eyebrow?: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel className="min-w-0">
      <PanelHeader title={title} eyebrow={eyebrow ?? `Live from the dataset · last bar ${formatDate(ASOF)}`} />
      {children}
      <PanelNote>{note}</PanelNote>
    </Panel>
  );
}

const sortBy = (value: (row: SymbolRow) => number | null, direction: "asc" | "desc" = "desc") =>
  [...SYMBOL_ROWS].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null) return 1;
    if (right === null) return -1;
    return direction === "desc" ? right - left : left - right;
  });

const ma = (row: SymbolRow, label: string) =>
  row.summary.movingAverages.find((average) => average.label === label) ?? null;

/** Each covered name against the equal-weight composite, built once and shared by the beta table. */
function compositeComparisons() {
  return new Map(
    SYMBOL_ROWS.map((row) => [
      row.symbol,
      compareToBenchmark(row.summary.bars, COMPOSITE_BARS, { baseSymbol: row.symbol, benchmarkSymbol: COMPOSITE_SYMBOL }),
    ]),
  );
}

/** The backtest sweep the deflated-Sharpe and walk-forward guides work through. */
const EXAMPLE_SYMBOL = "NVDA";

function exampleSetup() {
  const bars = resolveRange(PRICE_BOOK[EXAMPLE_SYMBOL] ?? [], "1Y")?.bars ?? [];
  const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 20, slow: 50 } };
  // The same axes the backtest workspace builds: seven steps either side of the current parameters.
  const axes: SweepAxis[] = RULE_DEFINITIONS.sma_cross.params.map((param) => {
    const centre = spec.params[param.key] ?? param.default;
    const stride = Math.max(1, Math.round((param.max - param.min) / 40));
    return {
      param: param.key,
      values: integerRange(
        Math.max(param.min, Math.round(centre - stride * 3)),
        Math.min(param.max, Math.round(centre + stride * 3)),
        stride,
      ),
    };
  });
  return { bars, spec, axes };
}

function rsiTone(zone: string | null): Tone {
  return zone === "overbought" ? "negative" : zone === "oversold" ? "accent" : "neutral";
}

export function LivePanel({ kind }: { kind: LiveKey }) {
  switch (kind) {
    case "rsi":
      return (
        <LiveFrame
          title="RSI 14 across the coverage list"
          note="Wilder's 14-period RSI on adjusted daily closes, read on the latest bar. Above 70 is conventionally overbought and below 30 oversold."
        >
          <SymbolTable
            caption="RSI 14 for each covered stock, highest first"
            rows={sortBy((row) => row.summary.rsi.value)}
            columns={[
              { label: "RSI 14", render: (row) => formatPoints(row.summary.rsi.value) },
              {
                label: "Zone",
                render: (row) =>
                  row.summary.rsi.zone ? <Badge tone={rsiTone(row.summary.rsi.zone)}>{row.summary.rsi.zone}</Badge> : EMPTY,
              },
              { label: "1Y return", render: (row) => <Delta value={row.summary.periodReturn} /> },
            ]}
          />
        </LiveFrame>
      );

    case "macd":
      return (
        <LiveFrame
          title="MACD 12/26/9 across the coverage list"
          note="MACD and signal are in dollars per share, so compare the histogram's sign across stocks rather than the levels."
        >
          <SymbolTable
            caption="MACD line, signal and histogram for each covered stock"
            rows={sortBy((row) => (row.summary.macdSummary.histogram ?? 0) / (row.summary.lastPrice ?? 1))}
            columns={[
              { label: "MACD", render: (row) => formatRatio(row.summary.macdSummary.value) },
              { label: "Signal", render: (row) => formatRatio(row.summary.macdSummary.signal) },
              { label: "Histogram", render: (row) => <Delta value={row.summary.macdSummary.histogram}>{formatRatio(row.summary.macdSummary.histogram)}</Delta> },
              {
                label: "Trend",
                render: (row) =>
                  row.summary.macdSummary.trend ? (
                    <Badge tone={row.summary.macdSummary.trend === "bullish" ? "positive" : "negative"}>
                      {row.summary.macdSummary.trend}
                    </Badge>
                  ) : (
                    EMPTY
                  ),
              },
            ]}
          />
        </LiveFrame>
      );

    case "bollinger":
      return (
        <LiveFrame
          title="Bollinger Bands 20/2 across the coverage list"
          note="Bands use the population deviation of the last 20 adjusted closes. Ranked by %B, which is comparable across stocks where the band levels are not."
        >
          <SymbolTable
            caption="Bollinger Band %B and levels for each covered stock, highest %B first"
            rows={sortBy((row) => row.summary.bollingerSummary.percentB)}
            columns={[
              { label: "%B", render: (row) => formatPercent(row.summary.bollingerSummary.percentB, { digits: 0 }) },
              { label: "Lower", render: (row) => formatPrice(row.summary.bollingerSummary.lower) },
              { label: "Middle", render: (row) => formatPrice(row.summary.bollingerSummary.middle) },
              { label: "Upper", render: (row) => formatPrice(row.summary.bollingerSummary.upper) },
            ]}
          />
        </LiveFrame>
      );

    case "moving-averages":
      return (
        <LiveFrame
          title="Price against its moving averages"
          note="Distance of the latest adjusted close above or below each simple average. Ranked by distance from the 200-session average."
        >
          <SymbolTable
            caption="Latest close relative to the 20, 50 and 200-session simple moving averages"
            rows={sortBy((row) => ma(row, "SMA 200")?.priceVsMa ?? null)}
            columns={[
              { label: "Close", render: (row) => formatPrice(row.summary.lastPrice) },
              { label: "vs SMA 20", render: (row) => <Delta value={ma(row, "SMA 20")?.priceVsMa} /> },
              { label: "vs SMA 50", render: (row) => <Delta value={ma(row, "SMA 50")?.priceVsMa} /> },
              { label: "vs SMA 200", render: (row) => <Delta value={ma(row, "SMA 200")?.priceVsMa} /> },
            ]}
          />
        </LiveFrame>
      );

    case "crosses":
      return (
        <LiveFrame
          title="Latest 50/200 crosses"
          note="A cross is reported only if it happened within the last 120 sessions. The 200-session average needs 200 bars to exist, so in a one-year window crosses can only appear in its final weeks."
        >
          <SymbolTable
            caption="Most recent golden or death cross between the 50 and 200-session averages"
            rows={sortBy((row) => (row.summary.cross ? -row.summary.cross.barsAgo : null))}
            columns={[
              {
                label: "Latest cross",
                render: (row) =>
                  row.summary.cross ? (
                    <Badge tone={row.summary.cross.kind === "golden" ? "positive" : "negative"}>
                      {row.summary.cross.kind === "golden" ? "Golden cross" : "Death cross"}
                    </Badge>
                  ) : (
                    <span className="text-muted">None recent</span>
                  ),
              },
              { label: "Date", render: (row) => (row.summary.cross ? formatDate(row.summary.cross.timestamp) : EMPTY) },
              {
                label: "Sessions ago",
                render: (row) => (row.summary.cross ? String(row.summary.cross.barsAgo) : EMPTY),
              },
              {
                label: "SMA 50 vs 200",
                render: (row) => {
                  const fast = ma(row, "SMA 50")?.value ?? null;
                  const slow = ma(row, "SMA 200")?.value ?? null;
                  if (fast === null || slow === null) return EMPTY;
                  return <Badge tone={fast > slow ? "positive" : "negative"}>{fast > slow ? "Above" : "Below"}</Badge>;
                },
              },
            ]}
          />
        </LiveFrame>
      );

    case "atr":
      return (
        <LiveFrame
          title="Average True Range across the coverage list"
          note="Wilder's 14-period ATR from unadjusted highs, lows and closes. Ranked by ATR as a share of price, which is comparable across stocks."
        >
          <SymbolTable
            caption="ATR 14 in dollars and as a percentage of price, highest percentage first"
            rows={sortBy((row) => row.summary.atr.percentOfPrice)}
            columns={[
              { label: "Close", render: (row) => formatPrice(row.summary.lastPrice) },
              { label: "ATR 14", render: (row) => formatPrice(row.summary.atr.value) },
              { label: "% of price", render: (row) => formatPercent(row.summary.atr.percentOfPrice) },
            ]}
          />
        </LiveFrame>
      );

    case "volatility":
      return (
        <LiveFrame
          title="Annualized volatility, trailing year"
          note="Sample standard deviation of daily simple returns on adjusted closes, multiplied by √252."
        >
          <SymbolTable
            caption="Annualized and daily volatility for each covered stock, highest first"
            rows={sortBy((row) => row.summary.volatility.annualized)}
            columns={[
              { label: "Annualized", render: (row) => formatPercent(row.summary.volatility.annualized) },
              { label: "Daily σ", render: (row) => formatPercent(row.summary.volatility.periodic) },
              { label: "Returns", render: (row) => String(row.summary.volatility.observations) },
              { label: "1Y return", render: (row) => <Delta value={row.summary.periodReturn} /> },
            ]}
          />
        </LiveFrame>
      );

    case "drawdown":
      return (
        <LiveFrame
          title="Maximum drawdown, trailing year"
          note="Peak-to-trough decline on adjusted closes. Recovery is the first close back at or above the prior peak."
        >
          <SymbolTable
            caption="Maximum drawdown with peak, trough and recovery for each covered stock, deepest first"
            rows={sortBy((row) => row.summary.drawdown.maxDrawdown, "asc")}
            columns={[
              { label: "Max drawdown", render: (row) => formatPercent(row.summary.drawdown.maxDrawdown) },
              { label: "Peak", render: (row) => formatDate(row.summary.drawdown.peakTimestamp) },
              { label: "Trough", render: (row) => formatDate(row.summary.drawdown.troughTimestamp) },
              {
                label: "Recovered",
                render: (row) =>
                  row.summary.drawdown.recoveryTimestamp ? formatDate(row.summary.drawdown.recoveryTimestamp) : <span className="text-muted">Not yet</span>,
              },
              { label: "Current", render: (row) => formatPercent(row.summary.drawdown.currentDrawdown) },
            ]}
          />
        </LiveFrame>
      );

    case "sharpe":
    case "sortino": {
      const bySortino = kind === "sortino";
      return (
        <LiveFrame
          title={bySortino ? "Sortino and Sharpe ratios, trailing year" : "Sharpe ratios, trailing year"}
          note="Annualized from daily returns with a risk-free rate of zero. With one year of data each ratio carries a standard error of roughly ±1."
        >
          <SymbolTable
            caption={`${bySortino ? "Sortino" : "Sharpe"} ratio for each covered stock, highest first`}
            rows={sortBy((row) => (bySortino ? row.summary.sortino : row.summary.sharpe))}
            columns={[
              { label: "Sharpe", render: (row) => formatRatio(row.summary.sharpe) },
              { label: "Sortino", render: (row) => formatRatio(row.summary.sortino) },
              { label: "1Y return", render: (row) => <Delta value={row.summary.periodReturn} /> },
              { label: "Volatility", render: (row) => formatPercent(row.summary.volatility.annualized) },
            ]}
          />
        </LiveFrame>
      );
    }

    case "beta": {
      const comparisons = compositeComparisons();
      return (
        <LiveFrame
          title="Beta against the SL10 composite"
          note="Daily returns over the trailing year, aligned by date. SL10 is an equal-weight index of the ten covered stocks, not the S&P 500, so these betas measure sensitivity to this group."
        >
          <SymbolTable
            caption="Beta, correlation and tracking error against the SL10 composite, highest beta first"
            rows={sortBy((row) => comparisons.get(row.symbol)?.beta ?? null)}
            columns={[
              { label: "Beta", render: (row) => formatRatio(comparisons.get(row.symbol)?.beta) },
              { label: "Correlation", render: (row) => formatRatio(comparisons.get(row.symbol)?.correlation) },
              { label: "Tracking error", render: (row) => formatPercent(comparisons.get(row.symbol)?.trackingError) },
              { label: "Volatility", render: (row) => formatPercent(row.summary.volatility.annualized) },
            ]}
          />
        </LiveFrame>
      );
    }

    case "correlation":
      return <CorrelationMatrixPanel />;

    case "cagr":
      return (
        <LiveFrame
          title="Compound annual growth rate, trailing year"
          note="From adjusted closes over calendar days. Over a window of almost exactly one year, CAGR and the total return nearly coincide."
        >
          <SymbolTable
            caption="CAGR and total return for each covered stock, highest first"
            rows={sortBy((row) => row.summary.cagr.value)}
            columns={[
              { label: "CAGR", render: (row) => <Delta value={row.summary.cagr.value} /> },
              { label: "Total return", render: (row) => <Delta value={row.summary.periodReturn} /> },
              {
                label: "Calendar days",
                render: (row) => (row.summary.cagr.days === null ? EMPTY : String(Math.round(row.summary.cagr.days))),
              },
            ]}
          />
        </LiveFrame>
      );

    case "deflated-sharpe":
      return <DeflatedSharpePanel />;

    case "walk-forward":
      return <WalkForwardPanel />;
  }
}

function CorrelationMatrixPanel() {
  const { symbols, matrix } = correlationMatrix(SYMBOLS.map((symbol) => ({ symbol, bars: PRICE_BOOK[symbol] })));
  const average = averagePairwiseCorrelation(matrix);
  return (
    <LiveFrame
      title="Correlation matrix of daily returns"
      note={`Pearson correlation of daily returns, each pair aligned on its shared trading days. Average pairwise correlation across the ten names: ${formatRatio(average)}.`}
    >
      <TableScroll>
        <table className="w-full min-w-[640px] border-collapse">
          <caption className="sr-only">Pairwise correlation of daily returns between the covered stocks</caption>
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
            {symbols.map((rowSymbol, i) => (
              <tr key={rowSymbol}>
                <th scope="row" className="border-b border-hairline px-3 py-2 text-left">
                  <Link href={`/analytics/${rowSymbol}`} className="font-mono text-[12px] font-semibold text-ink hover:underline">
                    {rowSymbol}
                  </Link>
                </th>
                {symbols.map((columnSymbol, j) => {
                  const value = matrix[i][j];
                  const strength = value === null || i === j ? 0 : Math.round(Math.max(0, value) * 45);
                  return (
                    <Td
                      key={columnSymbol}
                      align="right"
                      className={i === j ? "text-faint" : undefined}
                      style={{ background: strength > 0 ? `color-mix(in srgb, var(--color-accent) ${strength}%, transparent)` : undefined }}
                    >
                      {formatRatio(value)}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </LiveFrame>
  );
}

function DeflatedSharpePanel() {
  const { bars, spec, axes } = exampleSetup();
  const result = sweep(bars, spec, axes, { symbol: EXAMPLE_SYMBOL });
  const [fastAxis, slowAxis] = result.axes;
  const best = result.best;
  const scale = Math.max(0.01, ...result.cells.map((cell) => Math.abs(cell.sharpe ?? 0)));
  const cellFor = (fast: number, slow: number) =>
    result.cells.find((cell) => cell.params.fast === fast && cell.params.slow === slow);

  return (
    <LiveFrame
      title={`Worked example: ${EXAMPLE_SYMBOL} SMA crossover sweep`}
      eyebrow={`${result.cells.length} parameter cells · trailing year to ${formatDate(ASOF)}`}
      note={`Each cell is a full backtest of the SMA crossover rule on ${EXAMPLE_SYMBOL} with the default costs. The best cell would need a Sharpe ratio near the expected best under the null before it could be told apart from the luckiest of ${result.cells.length} worthless rules.`}
    >
      <MetricGrid className="border-x-0">
        <MetricCell>
          <Metric
            label="Best Sharpe"
            value={formatRatio(result.distribution.bestSharpe)}
            hint={best ? `Fast ${best.params.fast}, slow ${best.params.slow}` : undefined}
          />
        </MetricCell>
        <MetricCell>
          <Metric label="Median Sharpe" value={formatRatio(result.distribution.medianSharpe)} hint="Across every cell" />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Expected best if worthless"
            value={formatRatio(result.expectedMaxSharpeUnderNull)}
            hint={`Best of ${result.cells.length} zero-skill rules`}
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Deflated Sharpe"
            value={formatRatio(result.deflatedSharpe)}
            hint="Probability the best is genuine"
          />
        </MetricCell>
      </MetricGrid>

      {fastAxis && slowAxis && (
        <TableScroll className="border-t border-hairline">
          <table className="w-full min-w-[520px] border-collapse">
            <caption className="sr-only">Sharpe ratio of each fast and slow average combination</caption>
            <thead>
              <tr>
                <Th>Fast \ Slow</Th>
                {slowAxis.values.map((slow) => (
                  <Th key={slow} align="right">
                    {slow}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fastAxis.values.map((fast) => (
                <tr key={fast}>
                  <th scope="row" className="border-b border-hairline px-3 py-2 text-left font-mono text-[12px] font-semibold text-ink">
                    {fast}
                  </th>
                  {slowAxis.values.map((slow) => {
                    const sharpe = cellFor(fast, slow)?.sharpe ?? null;
                    const strength = sharpe === null ? 0 : Math.round((Math.abs(sharpe) / scale) * 40);
                    const colour = (sharpe ?? 0) >= 0 ? "var(--color-pos)" : "var(--color-neg)";
                    const isBest = best?.params.fast === fast && best?.params.slow === slow;
                    return (
                      <Td
                        key={slow}
                        align="right"
                        className={isBest ? "font-semibold text-ink outline outline-1 -outline-offset-1 outline-ink" : undefined}
                        style={{ background: strength > 0 ? `color-mix(in srgb, ${colour} ${strength}%, transparent)` : undefined }}
                      >
                        {formatRatio(sharpe)}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </LiveFrame>
  );
}

function WalkForwardPanel() {
  const { bars, spec, axes } = exampleSetup();
  const slowAxis = axes[axes.length - 1];
  const result = walkForward(bars, spec, slowAxis ? [slowAxis] : [], {
    folds: 3,
    symbol: EXAMPLE_SYMBOL,
    minBarsPerSlice: 90,
  });

  return (
    <LiveFrame
      title={`Worked example: ${EXAMPLE_SYMBOL} SMA crossover, three folds`}
      eyebrow={`Anchored walk-forward · trailing year to ${formatDate(ASOF)}`}
      note={
        <>
          The slow average is chosen from {slowAxis?.values.join(", ")} on each in-sample slice, then traded unchanged on
          the next. {result.warnings.join(" ")}
        </>
      }
    >
      <MetricGrid columns={3} className="border-x-0">
        <MetricCell>
          <Metric label="Mean in-sample return" value={formatPercent(result.meanInSampleReturn, { signed: true })} tone={result.meanInSampleReturn} />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Mean out-of-sample return"
            value={formatPercent(result.meanOutOfSampleReturn, { signed: true })}
            tone={result.meanOutOfSampleReturn}
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Efficiency"
            value={formatRatio(result.efficiency)}
            hint={`Out-of-sample positive in ${formatPercent(result.hitRate, { digits: 0 })} of folds`}
          />
        </MetricCell>
      </MetricGrid>
      <TableScroll className="border-t border-hairline">
        <table className="w-full min-w-[640px] border-collapse">
          <caption className="sr-only">Walk-forward folds with in-sample and out-of-sample results</caption>
          <thead>
            <tr>
              <Th>Fold</Th>
              <Th>In-sample</Th>
              <Th align="right">Chosen slow</Th>
              <Th align="right">In-sample return</Th>
              <Th>Out-of-sample</Th>
              <Th align="right">Out-of-sample return</Th>
            </tr>
          </thead>
          <tbody>
            {result.folds.map((fold) => (
              <tr key={fold.index}>
                <Td>{fold.index + 1}</Td>
                <Td>
                  {formatDate(fold.inSampleStart)} – {formatDate(fold.inSampleEnd)}
                </Td>
                <Td align="right">{fold.chosenParams.slow ?? EMPTY}</Td>
                <Td align="right">
                  <Delta value={fold.inSampleReturn} />
                </Td>
                <Td>
                  {formatDate(fold.outOfSampleStart)} – {formatDate(fold.outOfSampleEnd)}
                </Td>
                <Td align="right">
                  <Delta value={fold.outOfSampleReturn} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </LiveFrame>
  );
}

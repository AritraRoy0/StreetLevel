"use client";

/**
 * The backtest workspace.
 *
 * The full validated history for every covered symbol arrives from the server
 * once. Everything after that, including sweeps, is a pure recomputation inside
 * `useMemo`, so changing a parameter is instant and there is no window in which
 * the chart and the statistics describe different runs.
 *
 * Sweeps and walk-forward are opt-in rather than automatic. Each runs dozens of
 * simulations, and doing that on every keystroke would make the controls feel
 * broken for a result the reader did not ask for.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PriceChart } from "@/components/charts/price-chart";
import type { ChartMarker, IndicatorPane, Overlay } from "@/components/charts/price-chart";
import { StrategyPanel } from "@/components/backtest/strategy-panel";
import {
  BenchmarkPanel,
  HeadlineStatistics,
  SweepPanel,
  TradeLedger,
  WalkForwardPanel,
} from "@/components/backtest/result-panels";
import { decodeState, encodeState } from "@/components/backtest/url-state";
import {
  Badge,
  Callout,
  Delta,
  Eyebrow,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  Segmented,
  TableScroll,
  Td,
  Th,
  ToggleChip,
} from "@/components/ui";
import {
  EMPTY,
  formatCount,
  formatDate,
  formatPercent,
  formatPrice,
  formatPriceChange,
  formatRatio,
  RANGE_DESCRIPTIONS,
  RANGE_LABELS,
  resolveRange,
} from "@/lib/analytics";
import type { Bar, RangeKey } from "@/lib/analytics";
import {
  INTRABAR_POLICY,
  RULE_DEFINITIONS,
  buildBenchmarkReport,
  guardedRun,
  integerRange,
  runBacktest,
  runPortfolioBacktest,
  sweep as runSweep,
  walkForward,
} from "@/lib/backtest";
import type { PortfolioBacktestSpec, StrategySpec } from "@/lib/backtest";

const RANGE_CHOICES: RangeKey[] = ["3M", "6M", "YTD", "1Y", "MAX"];

export function BacktestWorkspace({
  priceBook,
  symbols,
  compositeBars,
  datasetNote,
  initialQuery,
}: {
  priceBook: Record<string, Bar[]>;
  symbols: string[];
  compositeBars: Bar[];
  datasetNote: string;
  initialQuery: string;
}) {
  const router = useRouter();

  /**
   * The query arrives as a prop from the server page rather than through
   * `useSearchParams`, which would opt this whole subtree out of server
   * rendering and leave a shared link showing a skeleton until hydration.
   */
  const initial = useMemo(
    () => decodeState(new URLSearchParams(initialQuery), { symbol: symbols[0], symbols }),
    [initialQuery, symbols],
  );

  const [symbol, setSymbol] = useState(initial.symbol);
  const [selectedSymbols, setSelectedSymbols] = useState(initial.symbols);
  const [multiSymbol, setMultiSymbol] = useState(initial.multiSymbol);
  const [range, setRange] = useState<RangeKey>(initial.range);
  const [spec, setSpec] = useState<StrategySpec>(initial.spec);
  const [allocation, setAllocation] = useState(initial.allocation);
  const [maxPositions, setMaxPositions] = useState(initial.maxPositions);
  const [showSweep, setShowSweep] = useState(false);
  const [showWalkForward, setShowWalkForward] = useState(false);
  const [sweepMetric, setSweepMetric] = useState<"sharpe" | "totalReturn" | "maxDrawdown">("sharpe");
  const [showTrades, setShowTrades] = useState(true);
  const [activeMarker, setActiveMarker] = useState<ChartMarker | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  /** Keeps the address bar in step without pushing a history entry per keystroke. */
  const syncUrl = useCallback(
    (next: Partial<Parameters<typeof encodeState>[0]>) => {
      const query = encodeState({
        symbol,
        symbols: selectedSymbols,
        multiSymbol,
        range,
        spec,
        allocation,
        maxPositions,
        volatilityTarget: initial.volatilityTarget,
        ...next,
      });
      router.replace(`/performance?${query}`, { scroll: false });
    },
    [router, symbol, selectedSymbols, multiSymbol, range, spec, allocation, maxPositions, initial.volatilityTarget],
  );

  const updateSpec = useCallback(
    (patch: Partial<StrategySpec>) => {
      setSpec((current) => {
        const next = { ...current, ...patch };
        syncUrl({ spec: next });
        return next;
      });
    },
    [syncUrl],
  );

  // The window the run covers, resolved from the full history.
  const windowBars = useMemo(() => {
    const bars = priceBook[symbol] ?? [];
    return resolveRange(bars, range)?.bars ?? bars;
  }, [priceBook, symbol, range]);

  const singleRun = useMemo(() => {
    if (multiSymbol) return null;
    return guardedRun(windowBars, spec, { symbol });
  }, [multiSymbol, windowBars, spec, symbol]);

  const result = singleRun?.result ?? null;

  const frictionless = useMemo(() => {
    if (!result) return null;
    return runBacktest(
      windowBars,
      { ...spec, costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 } },
      { symbol },
    );
  }, [result, windowBars, spec, symbol]);

  const benchmark = useMemo(() => {
    if (!result || !frictionless) return null;
    // The composite is trimmed to the same window so the comparison aligns.
    const compositeWindow = resolveRange(compositeBars, range)?.bars ?? compositeBars;
    return buildBenchmarkReport(result, frictionless, compositeWindow);
  }, [result, frictionless, compositeBars, range]);

  const portfolioRun = useMemo(() => {
    if (!multiSymbol || selectedSymbols.length === 0) return null;
    const trimmed: Record<string, Bar[]> = {};
    for (const item of selectedSymbols) {
      const bars = priceBook[item] ?? [];
      trimmed[item] = resolveRange(bars, range)?.bars ?? bars;
    }
    const portfolioSpec: PortfolioBacktestSpec = {
      ...spec,
      allocation,
      maxPositions,
      volatilityTarget: initial.volatilityTarget,
    };
    return runPortfolioBacktest(trimmed, selectedSymbols, portfolioSpec);
  }, [multiSymbol, selectedSymbols, priceBook, range, spec, allocation, maxPositions, initial.volatilityTarget]);

  // Two sweep axes, taken from the rule's own declared parameters.
  const sweepAxes = useMemo(() => {
    const params = RULE_DEFINITIONS[spec.rule].params;
    if (params.length < 2) return [];
    const [first, second] = params;
    const axisFor = (param: (typeof params)[number]) => {
      const centre = spec.params[param.key] ?? param.default;
      const stride = Math.max(1, Math.round((param.max - param.min) / 40));
      const from = Math.max(param.min, Math.round(centre - stride * 3));
      const to = Math.min(param.max, Math.round(centre + stride * 3));
      return { param: param.key, values: integerRange(from, to, stride) };
    };
    return [axisFor(first), axisFor(second)];
  }, [spec.rule, spec.params]);

  const sweepResult = useMemo(() => {
    if (!showSweep || multiSymbol || sweepAxes.length < 2) return null;
    return runSweep(windowBars, spec, sweepAxes, { symbol });
  }, [showSweep, multiSymbol, sweepAxes, windowBars, spec, symbol]);

  const walkForwardResult = useMemo(() => {
    if (!showWalkForward || multiSymbol) return null;
    const axes = sweepAxes.length > 0 ? [sweepAxes[sweepAxes.length - 1]] : [];
    if (axes.length === 0) return null;
    return walkForward(windowBars, spec, axes, { folds: 3, symbol, minBarsPerSlice: 90 });
  }, [showWalkForward, multiSymbol, sweepAxes, windowBars, spec, symbol]);

  /** Trade entries and exits, as chart annotations. */
  const tradeMarkers: ChartMarker[] = useMemo(() => {
    if (!showTrades || !result) return [];
    const markers: ChartMarker[] = [];
    for (const trade of result.trades) {
      markers.push({
        index: trade.entryIndex,
        timestamp: trade.entryTimestamp,
        tone: "neutral",
        glyph: "B",
        title: `Bought ${formatCount(trade.shares)} at ${formatPrice(trade.entryPrice)}`,
        lines: [`Entry ${formatDate(trade.entryTimestamp)} at ${formatPrice(trade.entryPrice)}`],
      });
      if (trade.exitIndex !== null) {
        markers.push({
          index: trade.exitIndex,
          timestamp: trade.exitTimestamp ?? trade.entryTimestamp,
          tone: (trade.netProfit ?? 0) >= 0 ? "positive" : "negative",
          glyph: "S",
          below: true,
          title: `Sold at ${formatPrice(trade.exitPrice)} for ${formatPriceChange(trade.netProfit)}`,
          lines: [
            `Exit ${formatDate(trade.exitTimestamp)} at ${formatPrice(trade.exitPrice)}`,
            `Net ${formatPriceChange(trade.netProfit)} over ${trade.holdingBars} bars`,
            `Reason: ${trade.exitReason ?? "signal"}`,
          ],
        });
      }
    }
    return markers;
  }, [showTrades, result]);

  const equityBars: Bar[] = useMemo(() => {
    const source = multiSymbol ? portfolioRun?.equity : result?.equity;
    if (!source) return [];
    return source.map((point) => ({
      timestamp: point.timestamp,
      open: point.equity,
      high: point.equity,
      low: point.equity,
      close: point.equity,
      adjClose: point.equity,
      volume: 0,
    }));
  }, [multiSymbol, portfolioRun, result]);

  /** Buy-and-hold equity as an overlay on the same axis. */
  const equityOverlays: Overlay[] = useMemo(() => {
    if (multiSymbol || !result) return [];
    return [
      {
        key: "hold",
        label: "Buy and hold",
        color: "var(--chart-benchmark)",
        values: result.benchmarkEquity.map((point) => point.equity),
        dashed: true,
      },
    ];
  }, [multiSymbol, result]);

  const equityPanes: IndicatorPane[] = useMemo(() => {
    const series = multiSymbol ? portfolioRun?.drawdownSeries : result?.drawdownSeries;
    if (!series || series.length === 0) return [];
    return [
      {
        key: "underwater",
        label: "Underwater",
        height: 72,
        kind: "line",
        series: [{ key: "dd", label: "Drawdown", color: "var(--chart-neg)", values: series }],
        format: (value) => `${(value * 100).toFixed(1)}%`,
      },
    ];
  }, [multiSymbol, portfolioRun, result]);

  const copyLink = useCallback(() => {
    const query = encodeState({
      symbol,
      symbols: selectedSymbols,
      multiSymbol,
      range,
      spec,
      allocation,
      maxPositions,
      volatilityTarget: initial.volatilityTarget,
    });
    const url = `${window.location.origin}/performance?${query}`;
    void navigator.clipboard?.writeText(url).then(
      () => {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
      },
      () => setLinkCopied(false),
    );
  }, [symbol, selectedSymbols, multiSymbol, range, spec, allocation, maxPositions, initial.volatilityTarget]);

  const toggleSymbol = useCallback(
    (item: string) => {
      setSelectedSymbols((current) => {
        const next = current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item];
        const safe = next.length === 0 ? current : next;
        syncUrl({ symbols: safe });
        return safe;
      });
    },
    [syncUrl],
  );

  return (
    <div className="space-y-8">
      {/* ----------------------------------------------------------------- */}
      {/* Standing disclosure                                               */}
      {/* ----------------------------------------------------------------- */}
      <Callout tone="warning" title="This is a simulator, not evidence">
        <p>{datasetNote}</p>
        <p className="mt-1.5">
          Ten large-capitalisation survivors over a single year, with no delisted names, carries severe survivorship
          bias, and one non-overlapping year is a single observation of any annual statistic. A parameter sweep over
          it will always find a winner. Read what follows as a demonstration of method, not as a finding about a rule.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-ink">Fill assumptions</summary>
          <ul className="mt-1.5 space-y-0.5">
            {INTRABAR_POLICY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </Callout>

      {/* ----------------------------------------------------------------- */}
      {/* Controls                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Window"
            value={range}
            onChange={(next) => {
              setRange(next);
              syncUrl({ range: next });
            }}
            options={RANGE_CHOICES.map((key) => ({
              value: key,
              label: RANGE_LABELS[key],
              title: RANGE_DESCRIPTIONS[key],
            }))}
          />
          {multiSymbol && (
            <>
              <Segmented
                size="sm"
                label="Allocation"
                value={allocation}
                onChange={(next) => {
                  setAllocation(next);
                  syncUrl({ allocation: next });
                }}
                options={[
                  { value: "equal_weight", label: "Equal weight" },
                  { value: "volatility_target", label: "Vol target" },
                ]}
              />
              <Segmented
                size="sm"
                label="Position slots"
                value={String(maxPositions)}
                onChange={(next) => {
                  const slots = Number(next);
                  setMaxPositions(slots);
                  syncUrl({ maxPositions: slots });
                }}
                options={["1", "2", "3", "4", "6"].map((value) => ({ value, label: value }))}
              />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip active={showTrades} onChange={setShowTrades}>
            Trade markers
          </ToggleChip>
          <ToggleChip active={showSweep} onChange={setShowSweep}>
            Parameter sweep
          </ToggleChip>
          <ToggleChip active={showWalkForward} onChange={setShowWalkForward}>
            Walk forward
          </ToggleChip>
          <button
            type="button"
            onClick={copyLink}
            className="border border-hairline px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            {linkCopied ? "Link copied" : "Copy link"}
          </button>
        </div>
      </div>

      {initial.issues.length > 0 && (
        <Callout tone="neutral" title="Adjusted from the link">
          <ul className="space-y-0.5">
            {initial.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Callout>
      )}

      {singleRun && singleRun.issues.length > 0 && (
        <Callout tone="neutral" title="Specification adjusted">
          <ul className="space-y-0.5">
            {singleRun.issues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </Callout>
      )}

      {singleRun && singleRun.errors.length > 0 && (
        <Callout tone="negative" title="The run could not be completed">
          <ul className="space-y-0.5">
            {singleRun.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Callout>
      )}

      <div className="grid gap-8 xl:grid-cols-[340px_1fr]">
        <StrategyPanel
          spec={spec}
          symbols={symbols}
          symbol={symbol}
          multiSymbol={multiSymbol}
          selectedSymbols={selectedSymbols}
          onSpecChange={updateSpec}
          onSymbolChange={(next) => {
            setSymbol(next);
            syncUrl({ symbol: next });
          }}
          onMultiSymbolChange={(next) => {
            setMultiSymbol(next);
            syncUrl({ multiSymbol: next });
          }}
          onToggleSymbol={toggleSymbol}
        />

        <div className="min-w-0 space-y-8">
          {/* Single-symbol results ---------------------------------------- */}
          {!multiSymbol && result && (
            <>
              <HeadlineStatistics result={result} />

              <Panel>
                <PanelHeader
                  title="Equity curve"
                  eyebrow={`${RULE_DEFINITIONS[spec.rule].label} on ${symbol} · ${formatDate(result.equity[0]?.timestamp ?? null)} to ${formatDate(result.equity[result.equity.length - 1]?.timestamp ?? null)}`}
                  actions={
                    singleRun?.cached ? <Badge tone="neutral">Cached</Badge> : undefined
                  }
                />
                <div className="p-4">
                  {equityBars.length > 1 ? (
                    <PriceChart
                      bars={equityBars}
                      chartType="area"
                      showVolume={false}
                      overlays={equityOverlays}
                      panes={equityPanes}
                      height={280}
                      readout="value"
                      valueLabel="Equity"
                    />
                  ) : (
                    <p className="py-8 text-center text-[12px] text-muted">Not enough sessions to chart.</p>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title={`${symbol} with trades marked`}
                  eyebrow="Entries above the axis, exits below, coloured by outcome"
                />
                <div className="p-4">
                  <PriceChart
                    bars={result.bars}
                    chartType="line"
                    showVolume
                    markers={tradeMarkers}
                    onMarkerSelect={setActiveMarker}
                    height={260}
                  />
                </div>
                {activeMarker && (
                  <div className="border-t border-hairline bg-sunken px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Eyebrow>{formatDate(activeMarker.timestamp)}</Eyebrow>
                        <ul className="mt-1.5 space-y-1">
                          {(activeMarker.lines ?? [activeMarker.title]).map((line) => (
                            <li key={line} className="text-[12px] leading-snug text-ink-soft">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveMarker(null)}
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-ink"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </Panel>

              {benchmark && <BenchmarkPanel report={benchmark} result={result} />}

              {showSweep && sweepResult && (
                <SweepPanel
                  sweep={sweepResult}
                  metric={sweepMetric}
                  onMetricChange={setSweepMetric}
                  onSelectCell={(params) => updateSpec({ params: { ...spec.params, ...params } })}
                />
              )}
              {showSweep && !sweepResult && (
                <Callout tone="neutral" title="No sweep available">
                  {RULE_DEFINITIONS[spec.rule].label} does not expose two parameters to sweep.
                </Callout>
              )}

              {showWalkForward && walkForwardResult && <WalkForwardPanel result={walkForwardResult} />}

              <TradeLedger result={result} />
            </>
          )}

          {/* Multi-symbol results ---------------------------------------- */}
          {multiSymbol && portfolioRun && (
            <>
              <MetricGrid>
                <MetricCell>
                  <Metric
                    label="Total return"
                    value={formatPercent(portfolioRun.totalReturn, { signed: true })}
                    hint={`${portfolioRun.symbols.length} names, ${maxPositions} position ${maxPositions === 1 ? "slot" : "slots"}`}
                    size="lg"
                  />
                </MetricCell>
                <MetricCell>
                  <Metric
                    label="Annualized"
                    value={formatPercent(portfolioRun.cagr)}
                    hint={`${portfolioRun.equity.length} shared sessions`}
                    size="lg"
                  />
                </MetricCell>
                <MetricCell>
                  <Metric
                    label="Max drawdown"
                    value={formatPercent(portfolioRun.maxDrawdown)}
                    hint={`Volatility ${formatPercent(portfolioRun.volatility)}`}
                    size="lg"
                  />
                </MetricCell>
                <MetricCell>
                  <Metric
                    label="Sharpe"
                    value={formatRatio(portfolioRun.sharpe)}
                    hint={`Average correlation ${formatRatio(portfolioRun.averageCorrelation)}`}
                    size="lg"
                  />
                </MetricCell>
              </MetricGrid>

              <Panel>
                <PanelHeader
                  title="Portfolio equity"
                  eyebrow="One cash account shared across every leg"
                />
                <div className="p-4">
                  {equityBars.length > 1 ? (
                    <PriceChart
                      bars={equityBars}
                      chartType="area"
                      showVolume={false}
                      panes={equityPanes}
                      height={280}
                      readout="value"
                      valueLabel="Equity"
                    />
                  ) : (
                    <p className="py-8 text-center text-[12px] text-muted">Not enough shared sessions to chart.</p>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader
                  title="Attribution by symbol"
                  eyebrow={`${portfolioRun.trades.filter((trade) => !trade.open).length} closed trades`}
                />
                <TableScroll>
                  <table className="w-full min-w-[620px] border-collapse">
                    <thead>
                      <tr>
                        <Th>Symbol</Th>
                        <Th align="right">Contribution</Th>
                        <Th align="right">Realized</Th>
                        <Th align="right">Unrealized</Th>
                        <Th align="right">Trades</Th>
                        <Th align="right">Exposure</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...portfolioRun.contributions]
                        .sort((a, b) => (b.contribution ?? 0) - (a.contribution ?? 0))
                        .map((entry) => (
                          <tr key={entry.symbol} className="hover:bg-sunken">
                            <Td>
                              <span className="font-mono text-[12px] font-semibold text-ink">{entry.symbol}</span>
                            </Td>
                            <Td align="right">
                              <Delta value={entry.contribution} />
                            </Td>
                            <Td align="right">{formatPriceChange(entry.realizedProfit)}</Td>
                            <Td align="right">{formatPriceChange(entry.unrealizedProfit)}</Td>
                            <Td align="right">{entry.closedTrades}</Td>
                            <Td align="right">{formatPercent(entry.exposure, { digits: 0 })}</Td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </TableScroll>
                <p className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
                  Contribution is each symbol&apos;s share of the portfolio&apos;s return over the window, with cash
                  moved into or out of the position removed first. Entries compete for position slots and are ranked by
                  trailing volatility, lowest first, so the result does not depend on the order the names were listed.
                </p>
              </Panel>

              {portfolioRun.warnings.length > 0 && (
                <Callout tone="neutral" title="About this run">
                  <ul className="space-y-0.5">
                    {portfolioRun.warnings.slice(0, 8).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </Callout>
              )}
            </>
          )}

          {multiSymbol && !portfolioRun && (
            <Callout tone="neutral" title="Select at least one symbol">
              Choose the names the strategy should trade.
            </Callout>
          )}

          {!multiSymbol && !result && !singleRun?.errors.length && (
            <Callout tone="neutral" title="Nothing to simulate">
              The selected window holds no usable bars. {EMPTY}
            </Callout>
          )}
        </div>
      </div>
    </div>
  );
}

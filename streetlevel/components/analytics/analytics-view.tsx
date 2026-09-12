"use client";

/**
 * The analytics workspace for a single symbol.
 *
 * The full validated history arrives from the server once. Every range,
 * interval, overlay and indicator change is then a pure recomputation over
 * that array inside `useMemo`, so switching from three months to five years is
 * instant and cannot produce a loading state, a request, or a chance to show
 * stale numbers next to fresh ones.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriceChart } from "@/components/charts/price-chart";
import type { ChartType, IndicatorPane, Overlay } from "@/components/charts/price-chart";
import { ComparisonPanel } from "@/components/analytics/comparison-panel";
import { IndicatorSummary, RiskSummary } from "@/components/analytics/indicator-summary";
import { MovingAverageTable, PeriodPerformance } from "@/components/analytics/performance-tables";
import { NewsPanel } from "@/components/news-panel";
import { DataQualityNotice } from "@/components/data-quality-notice";
import {
  Badge,
  Callout,
  Delta,
  Eyebrow,
  Field,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  Segmented,
  Select,
  ToggleChip,
} from "@/components/ui";
import type { SegmentedOption } from "@/components/ui";
import {
  buildEventMarkers,
  buildSummary,
  EMPTY,
  formatCompactCurrency,
  formatDate,
  formatPercent,
  formatPoints,
  formatPrice,
  formatPriceChange,
  formatVolume,
  INTERVAL_LABELS,
  RANGE_DESCRIPTIONS,
  RANGE_KEYS,
  RANGE_LABELS,
} from "@/lib/analytics";
import type {
  Bar,
  DataQuality,
  EventMarker,
  Interval,
  NewsArticle,
  PositionMetrics,
  RangeKey,
} from "@/lib/analytics";
import { INTERVAL_SUPPORT } from "@/lib/analytics-validation";
import type { SymbolProfile } from "@/lib/market-data";

const OVERLAY_SPECS = [
  { key: "sma20", label: "SMA 20", color: "var(--chart-ma-1)", field: "sma20" },
  { key: "sma50", label: "SMA 50", color: "var(--chart-ma-2)", field: "sma50" },
  { key: "sma200", label: "SMA 200", color: "var(--chart-ma-3)", field: "sma200" },
  { key: "ema12", label: "EMA 12", color: "var(--chart-ma-4)", field: "ema12" },
  { key: "ema26", label: "EMA 26", color: "var(--chart-ma-5)", field: "ema26" },
] as const;

type OverlayKey = (typeof OVERLAY_SPECS)[number]["key"];
type PaneKey = "rsi" | "macd" | "drawdown";

const INTERVAL_OPTIONS: SegmentedOption<Interval>[] = (
  ["1d", "1w", "1mo", "1h", "5m"] as Interval[]
).map((interval) => ({
  value: interval,
  label: INTERVAL_LABELS[interval],
  disabled: !INTERVAL_SUPPORT[interval].available,
  title: INTERVAL_SUPPORT[interval].available
    ? INTERVAL_LABELS[interval]
    : INTERVAL_SUPPORT[interval].reason,
}));

export function AnalyticsView({
  symbol,
  profile,
  bars,
  quality,
  benchmarkSymbol,
  benchmarkBars,
  benchmarkOptions,
  news,
  position,
  peers,
}: {
  symbol: string;
  profile: SymbolProfile;
  bars: Bar[];
  quality: DataQuality;
  benchmarkSymbol: string;
  benchmarkBars: Bar[];
  benchmarkOptions: Array<{ symbol: string; label: string; description: string }>;
  news: Array<NewsArticle & { duplicateSources: string[] }>;
  position: PositionMetrics | null;
  peers: Array<{ symbol: string; name: string }>;
}) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("1Y");
  const [interval, setInterval] = useState<Interval>("1d");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [overlays, setOverlays] = useState<Set<OverlayKey>>(new Set<OverlayKey>(["sma50"]));
  const [showBands, setShowBands] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [panes, setPanes] = useState<Set<PaneKey>>(new Set<PaneKey>(["rsi"]));
  const [showMarkers, setShowMarkers] = useState(true);
  const [activeMarker, setActiveMarker] = useState<EventMarker | null>(null);

  const summary = useMemo(
    () => buildSummary(symbol, bars, { range, interval }),
    [symbol, bars, range, interval],
  );

  const markers = useMemo(
    () => (showMarkers ? buildEventMarkers(news, summary.bars.map((bar) => bar.timestamp)) : []),
    [news, summary.bars, showMarkers],
  );

  const chartOverlays: Overlay[] = useMemo(
    () =>
      OVERLAY_SPECS.filter((spec) => overlays.has(spec.key)).map((spec) => ({
        key: spec.key,
        label: spec.label,
        color: spec.color,
        values: summary.indicators[spec.field],
      })),
    [overlays, summary.indicators],
  );

  const chartPanes: IndicatorPane[] = useMemo(() => {
    const built: IndicatorPane[] = [];
    if (panes.has("rsi")) {
      built.push({
        key: "rsi",
        label: "RSI 14",
        height: 66,
        kind: "line",
        domain: [0, 100],
        guides: [
          { value: 70, label: "70" },
          { value: 30, label: "30" },
        ],
        series: [{ key: "rsi", label: "RSI", color: "var(--chart-ma-4)", values: summary.indicators.rsi14 }],
        format: (value) => value.toFixed(1),
      });
    }
    if (panes.has("macd")) {
      built.push({
        key: "macd",
        label: "MACD 12/26/9",
        height: 66,
        kind: "histogram",
        series: [
          { key: "histogram", label: "Hist", color: "var(--color-faint)", values: summary.indicators.macdHistogram },
          { key: "macd", label: "MACD", color: "var(--chart-price)", values: summary.indicators.macd },
          { key: "signal", label: "Signal", color: "var(--chart-ma-2)", values: summary.indicators.macdSignal },
        ],
      });
    }
    if (panes.has("drawdown")) {
      built.push({
        key: "drawdown",
        label: "Drawdown",
        height: 58,
        kind: "line",
        series: [{ key: "dd", label: "DD", color: "var(--chart-neg)", values: summary.indicators.drawdown }],
        format: (value) => `${(value * 100).toFixed(1)}%`,
      });
    }
    return built;
  }, [panes, summary.indicators]);

  const toggleSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const extremes = summary.extremes;
  const rangePosition = extremes.position;

  return (
    <div className="space-y-10">
      {/* ----------------------------------------------------------------- */}
      {/* Symbol header                                                      */}
      {/* ----------------------------------------------------------------- */}
      <header className="border-b border-hairline-strong pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-[30px] font-semibold tracking-tight text-ink">{symbol}</h1>
              <Badge>{profile.sector}</Badge>
              {quality.stale && <Badge tone="warning">Delayed</Badge>}
              {position && <Badge tone="accent">Held</Badge>}
            </div>
            <p className="mt-1.5 text-[14px] text-ink-soft">{profile.name}</p>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted">{profile.description}</p>
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[34px] font-medium leading-none tracking-tight text-ink tabular-nums">
                {formatPrice(summary.lastPrice)}
              </span>
              <Delta value={summary.lastChangePercent} className="text-[15px]" />
            </div>
            <p className="text-[11px] text-muted">
              {formatPriceChange(summary.lastChange)} on the session · close {formatDate(summary.lastBarTimestamp)}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
              <span>Market cap {formatCompactCurrency(profile.marketCap)}</span>
              <span>P/E {Number.isFinite(profile.peRatio) ? profile.peRatio.toFixed(1) : EMPTY}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Field label="Symbol">
            <Select
              ariaLabel="Selected symbol"
              value={symbol}
              onChange={(next) => router.push(`/analytics/${next}`)}
              options={peers.map((peer) => ({ value: peer.symbol, label: `${peer.symbol} · ${peer.name}` }))}
            />
          </Field>
          <Link
            href="/portfolio"
            className="border border-hairline px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            Portfolio
          </Link>
        </div>
      </header>

      <DataQualityNotice quality={quality} />

      {summary.truncated && (
        <Callout tone="warning" title="Window shortened">
          History for {symbol} begins {formatDate(bars[0]?.timestamp)}, which is after the start of the{" "}
          {RANGE_LABELS[range]} range. Every figure below covers the shorter window that is actually available.
        </Callout>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Summary metrics                                                    */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <div className="mb-0 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4">
          <div>
            <Eyebrow className="mb-2">{RANGE_DESCRIPTIONS[range]}</Eyebrow>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Window summary</h2>
            <p className="mt-1 text-[12px] text-muted">
              {formatDate(summary.windowStart)} to {formatDate(summary.windowEnd)} · {summary.bars.length} bars ·{" "}
              {INTERVAL_LABELS[interval].toLowerCase()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Date range"
              value={range}
              onChange={setRange}
              options={RANGE_KEYS.map((key) => ({
                value: key,
                label: RANGE_LABELS[key],
                title: RANGE_DESCRIPTIONS[key],
              }))}
            />
            <Segmented label="Bar interval" value={interval} onChange={setInterval} options={INTERVAL_OPTIONS} />
          </div>
        </div>

        <MetricGrid>
          <MetricCell>
            <Metric
              label="Period return"
              value={formatPercent(summary.periodReturn, { signed: true })}
              hint={`${formatPriceChange(summary.periodChange)} in price terms`}
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Annualized growth"
              value={formatPercent(summary.cagr.value)}
              hint={
                summary.cagr.insufficientHistory
                  ? "Window under eleven months"
                  : `Compounded over ${Math.round(summary.cagr.days ?? 0)} days`
              }
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Volatility"
              value={formatPercent(summary.volatility.annualized)}
              hint={`Annualized, ${summary.volatility.observations} returns${summary.volatility.sufficient ? "" : " (thin)"}`}
              size="lg"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Max drawdown"
              value={formatPercent(summary.drawdown.maxDrawdown)}
              hint={
                summary.drawdown.troughTimestamp
                  ? `Trough ${formatDate(summary.drawdown.troughTimestamp)}`
                  : "No decline in this window"
              }
              size="lg"
            />
          </MetricCell>

          <MetricCell>
            <Metric
              label="Period high"
              value={formatPrice(extremes.high.value)}
              hint={formatDate(extremes.high.timestamp)}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Period low"
              value={formatPrice(extremes.low.value)}
              hint={formatDate(extremes.low.timestamp)}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Range position"
              value={rangePosition === null ? EMPTY : formatPercent(rangePosition, { digits: 0 })}
              hint="Where the last close sits between the low and the high"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Average volume"
              value={formatVolume(summary.volume.average)}
              hint={
                summary.volume.periodOverPeriod === null
                  ? "No preceding window to compare"
                  : `${formatPercent(summary.volume.periodOverPeriod, { signed: true })} against the prior window`
              }
            />
          </MetricCell>
        </MetricGrid>

        {summary.warnings.length > 0 && (
          <details className="mt-4 border border-hairline bg-surface">
            <summary className="cursor-pointer px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-ink">
              {summary.warnings.length} note{summary.warnings.length === 1 ? "" : "s"} about this window
            </summary>
            <ul className="space-y-1 border-t border-hairline px-4 py-3 text-[11px] leading-relaxed text-muted">
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Chart                                                              */}
      {/* ----------------------------------------------------------------- */}
      <Panel>
        <PanelHeader
          title="Price and volume"
          eyebrow={`${summary.bars.length} bars · ${INTERVAL_LABELS[interval].toLowerCase()}`}
          actions={
            <Segmented
              size="sm"
              label="Chart type"
              value={chartType}
              onChange={setChartType}
              options={[
                { value: "area", label: "Area" },
                { value: "line", label: "Line" },
                { value: "candles", label: "Candles" },
              ]}
            />
          }
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-hairline px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Eyebrow className="mr-1">Overlays</Eyebrow>
            {OVERLAY_SPECS.map((spec) => (
              <ToggleChip
                key={spec.key}
                active={overlays.has(spec.key)}
                swatch={spec.color}
                onChange={() => setOverlays((current) => toggleSet(current, spec.key))}
              >
                {spec.label}
              </ToggleChip>
            ))}
            <ToggleChip active={showBands} swatch="var(--color-faint)" onChange={setShowBands}>
              Bollinger
            </ToggleChip>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Eyebrow className="mr-1">Panes</Eyebrow>
            <ToggleChip active={showVolume} onChange={setShowVolume}>
              Volume
            </ToggleChip>
            <ToggleChip active={panes.has("rsi")} onChange={() => setPanes((current) => toggleSet(current, "rsi"))}>
              RSI
            </ToggleChip>
            <ToggleChip active={panes.has("macd")} onChange={() => setPanes((current) => toggleSet(current, "macd"))}>
              MACD
            </ToggleChip>
            <ToggleChip
              active={panes.has("drawdown")}
              onChange={() => setPanes((current) => toggleSet(current, "drawdown"))}
            >
              Drawdown
            </ToggleChip>
            <ToggleChip active={showMarkers} onChange={setShowMarkers}>
              News
            </ToggleChip>
          </div>
        </div>

        <div className="p-4">
          <PriceChart
            bars={summary.bars}
            chartType={chartType}
            overlays={chartOverlays}
            band={
              showBands
                ? {
                    upper: summary.indicators.bollingerUpper,
                    lower: summary.indicators.bollingerLower,
                    color: "var(--color-faint)",
                  }
                : null
            }
            showVolume={showVolume}
            panes={chartPanes}
            markers={markers}
            onMarkerSelect={setActiveMarker}
            height={340}
          />
        </div>

        <p className="border-t border-hairline px-4 py-2.5 text-[11px] text-muted">
          Drag across the plot to zoom, double-click or press Escape to reset. Focus the chart and use the arrow keys
          to step through sessions. Non-trading days are not plotted, so weekends and holidays leave no gap.
        </p>

        {activeMarker && (
          <div className="border-t border-hairline bg-sunken px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Eyebrow>{formatDate(activeMarker.timestamp)}</Eyebrow>
                <ul className="mt-1.5 space-y-1">
                  {activeMarker.articles.map((article) => (
                    <li key={article.id} className="text-[12px] leading-snug text-ink-soft">
                      <span className="font-semibold text-ink">{article.source}</span> — {article.title}
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

      {/* ----------------------------------------------------------------- */}
      {/* Readings and risk                                                  */}
      {/* ----------------------------------------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-2">
        <IndicatorSummary summary={summary} />
        <RiskSummary summary={summary} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <PeriodPerformance summary={summary} />
        <MovingAverageTable summary={summary} />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Comparison                                                         */}
      {/* ----------------------------------------------------------------- */}
      <ComparisonPanel
        symbol={symbol}
        bars={summary.bars}
        defaultBenchmark={benchmarkSymbol}
        defaultBenchmarkBars={benchmarkBars}
        options={benchmarkOptions}
        range={range}
        interval={interval}
      />

      {/* ----------------------------------------------------------------- */}
      {/* Position and news                                                  */}
      {/* ----------------------------------------------------------------- */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {position ? (
          <Panel className="min-w-0">
            <PanelHeader title="Your position" eyebrow="From the sample transaction log" />
            <div className="grid grid-cols-2 gap-y-5 p-4 sm:grid-cols-3">
              <Metric label="Shares" value={position.shares.toLocaleString("en-US")} size="sm" />
              <Metric label="Average cost" value={formatPrice(position.averageCost)} size="sm" />
              <Metric label="Market value" value={formatPrice(position.marketValue)} size="sm" />
              <Metric
                label="Unrealized"
                value={formatPriceChange(position.unrealizedPl)}
                hint={formatPercent(position.unrealizedPlPercent, { signed: true })}
                size="sm"
              />
              <Metric label="Realized" value={formatPriceChange(position.realizedPl)} size="sm" />
              <Metric
                label="Weight"
                value={formatPercent(position.weight, { digits: 1 })}
                hint="Share of portfolio value"
                size="sm"
              />
            </div>
          </Panel>
        ) : (
          <Panel className="min-w-0">
            <PanelHeader title="Your position" eyebrow="From the sample transaction log" />
            <p className="px-4 py-8 text-center text-[12px] text-muted">
              No position in {symbol}. Open the{" "}
              <Link href="/portfolio" className="underline underline-offset-2 hover:text-ink">
                portfolio
              </Link>{" "}
              to see current holdings.
            </p>
          </Panel>
        )}

        <NewsPanel
          articles={news}
          symbol={symbol}
          title="Coverage"
          emptyMessage={`No sample coverage tagged ${symbol}.`}
        />
      </section>

      <p className="border-t border-hairline pt-4 text-[11px] leading-relaxed text-muted">
        Returns, volatility and drawdown are computed from split- and dividend-adjusted closes. Open, high, low and
        volume come from the unadjusted bars, so the candles match what traded on the day. RSI at{" "}
        {formatPoints(summary.rsi.value)} uses Wilder&apos;s 14-period smoothing.
      </p>
    </div>
  );
}

"use client";

/**
 * The analytics workspace for a single symbol.
 *
 * The full validated history arrives from the server once. Every range,
 * interval, overlay and indicator change is then a pure recomputation over
 * that array inside `useMemo`, so switching from three months to five years is
 * instant and cannot produce a loading state, a request, or a chance to show
 * stale numbers next to fresh ones.
 *
 * The range and interval drive every section on the page, from the summary
 * figures down to the benchmark comparison, so they live in a bar that sticks
 * under the navigation. They used to sit above the summary and scroll away
 * before the reader reached the chart they most affect.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { PriceChart } from "@/components/charts/price-chart";
import { MarkerDetail } from "@/components/charts/marker-detail";
import type { ChartMarker, ChartType, IndicatorPane, Overlay } from "@/components/charts/price-chart";
import { ComparisonPanel } from "@/components/analytics/comparison-panel";
import { IndicatorSummary, RiskSummary } from "@/components/analytics/indicator-summary";
import { MovingAverageTable, PeriodPerformance } from "@/components/analytics/performance-tables";
import { SymbolSwitcher } from "@/components/analytics/symbol-switcher";
import { NewsPanel } from "@/components/news-panel";
import { DataQualityNotice } from "@/components/data-quality-notice";
import {
  Badge,
  Callout,
  Delta,
  EmptyState,
  Eyebrow,
  Field,
  Kbd,
  Metric,
  MetricCell,
  MetricGrid,
  Notice,
  Panel,
  PanelHeader,
  PanelNote,
  Segmented,
  Select,
  ToggleChip,
  buttonClass,
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
  Interval,
  NewsArticle,
  PositionMetrics,
  RangeKey,
} from "@/lib/analytics";
import { INTERVAL_SUPPORT } from "@/lib/analytics-validation";
import type { SymbolProfile } from "@/lib/market-data";
import type { DirectoryEntry } from "@/lib/symbol-directory";
import { cn } from "@/lib/utils";

const OVERLAY_SPECS = [
  { key: "sma20", label: "SMA 20", color: "var(--chart-ma-1)", field: "sma20" },
  { key: "sma50", label: "SMA 50", color: "var(--chart-ma-2)", field: "sma50" },
  { key: "sma200", label: "SMA 200", color: "var(--chart-ma-3)", field: "sma200" },
  { key: "ema12", label: "EMA 12", color: "var(--chart-ma-4)", field: "ema12" },
  { key: "ema26", label: "EMA 26", color: "var(--chart-ma-5)", field: "ema26" },
] as const;

type OverlayKey = (typeof OVERLAY_SPECS)[number]["key"];
type PaneKey = "rsi" | "macd" | "drawdown";

const INTERVALS: Interval[] = ["1d", "1w", "1mo", "1h", "5m"];

const INTERVAL_OPTIONS: SegmentedOption<Interval>[] = INTERVALS.map((interval) => ({
  value: interval,
  label: INTERVAL_LABELS[interval],
  disabled: !INTERVAL_SUPPORT[interval].available,
  title: INTERVAL_SUPPORT[interval].available
    ? INTERVAL_LABELS[interval]
    : INTERVAL_SUPPORT[interval].reason,
}));

const RANGE_OPTIONS: SegmentedOption<RangeKey>[] = RANGE_KEYS.map((key) => ({
  value: key,
  label: RANGE_LABELS[key],
  title: RANGE_DESCRIPTIONS[key],
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
  directory,
  backtestable,
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
  /** Every covered symbol with its latest move, for the switcher. */
  directory: DirectoryEntry[];
  /** Whether the backtest workspace can run this symbol. The composite cannot. */
  backtestable: boolean;
}) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const [interval, setInterval] = useState<Interval>("1d");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [overlays, setOverlays] = useState<Set<OverlayKey>>(new Set<OverlayKey>(["sma50"]));
  const [showBands, setShowBands] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [panes, setPanes] = useState<Set<PaneKey>>(new Set<PaneKey>(["rsi"]));
  const [showMarkers, setShowMarkers] = useState(true);
  const [activeMarker, setActiveMarker] = useState<ChartMarker | null>(null);

  /**
   * Whether the symbol header is on screen. When it scrolls away, the sticky
   * control bar picks up the ticker and price so the reader never loses track
   * of which name the numbers below belong to.
   */
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHeaderVisible(entry.isIntersecting), {
      rootMargin: "-104px 0px 0px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const summary = useMemo(
    () => buildSummary(symbol, bars, { range, interval }),
    [symbol, bars, range, interval],
  );

  /**
   * News events, mapped onto the chart's domain-agnostic marker type. The
   * grouped articles are kept alongside so a click can still open them.
   */
  const eventMarkers = useMemo(
    () => (showMarkers ? buildEventMarkers(news, summary.bars.map((bar) => bar.timestamp)) : []),
    [news, summary.bars, showMarkers],
  );

  const markers: ChartMarker[] = useMemo(
    () =>
      eventMarkers.map((marker) => ({
        index: marker.index,
        timestamp: marker.timestamp,
        tone: marker.sentiment,
        title: `${marker.articles.length} ${marker.articles.length === 1 ? "story" : "stories"}`,
        lines: marker.articles.map((article) => `${article.source} — ${article.title}`),
      })),
    [eventMarkers],
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
  const isComposite = profile.sector === "Composite index";
  const priceText = isComposite && summary.lastPrice !== null ? summary.lastPrice.toFixed(2) : formatPrice(summary.lastPrice);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ----------------------------------------------------------------- */}
      {/* Symbol header                                                      */}
      {/* ----------------------------------------------------------------- */}
      <header ref={headerRef} className="mb-5 space-y-5 sm:mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-mono text-[28px] font-semibold leading-none tracking-tight text-ink sm:text-[32px]">
                {symbol}
              </h1>
              <span className="text-[15px] text-ink-soft">{profile.name}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge>{profile.sector}</Badge>
              {position && (
                <a href="#position" className="transition-opacity hover:opacity-80">
                  <Badge tone="accent">Held · {formatPercent(position.weight, { digits: 1 })} of book</Badge>
                </a>
              )}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{profile.description}</p>
          </div>

          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[32px] font-medium leading-none tracking-tight text-ink tabular-nums sm:text-[36px]">
                {priceText}
              </span>
              <Delta value={summary.lastChangePercent} className="text-[15px]" />
            </div>
            <p className="text-[12px] text-muted">
              <Delta value={summary.lastChange}>{formatPriceChange(summary.lastChange)}</Delta> on the session · close{" "}
              {formatDate(summary.lastBarTimestamp)}
            </p>
            {!isComposite && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                <span>
                  Market cap <span className="font-mono text-ink-soft">{formatCompactCurrency(profile.marketCap)}</span>
                </span>
                <span>
                  P/E{" "}
                  <span className="font-mono text-ink-soft">
                    {Number.isFinite(profile.peRatio) ? profile.peRatio.toFixed(1) : EMPTY}
                  </span>
                </span>
              </p>
            )}
            {backtestable && (
              <Link
                href={`/performance?symbol=${encodeURIComponent(symbol)}`}
                className={buttonClass({ variant: "secondary", size: "xs", className: "mt-1.5" })}
              >
                <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                Backtest {symbol}
              </Link>
            )}
          </div>
        </div>

        <SymbolSwitcher entries={directory} current={symbol} />
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Window controls, pinned under the navigation                       */}
      {/* ----------------------------------------------------------------- */}
      <div className="sticky top-[var(--nav-height)] z-30 -mx-4 border-y border-hairline bg-paper/90 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex min-h-12 items-center gap-3 py-2">
          <div
            aria-hidden={headerVisible}
            className={cn(
              "hidden min-w-0 items-baseline gap-2.5 transition-opacity duration-200 sm:flex",
              headerVisible ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            <span className="font-mono text-[14px] font-semibold text-ink">{symbol}</span>
            <span className="font-mono text-[13px] tabular-nums text-ink-soft">{priceText}</span>
            <Delta value={summary.lastChangePercent} className="text-[12px]" />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Segmented size="sm" label="Date range" value={range} onChange={setRange} options={RANGE_OPTIONS} />
            <Segmented
              size="sm"
              label="Bar interval"
              value={interval}
              onChange={setInterval}
              options={INTERVAL_OPTIONS}
              className="hidden md:inline-flex"
            />
            <Field label="Bars" className="h-7 shrink-0 gap-1 px-2 md:hidden" labelClassName="sr-only sm:not-sr-only">
              <Select
                ariaLabel="Bar interval"
                value={interval}
                onChange={setInterval}
                options={INTERVALS.filter((item) => INTERVAL_SUPPORT[item].available).map((item) => ({
                  value: item,
                  label: INTERVAL_LABELS[item],
                }))}
                className="text-[11px]"
              />
            </Field>
          </div>
        </div>
      </div>

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
      <section aria-labelledby="window-summary">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <Eyebrow className="mb-2">{RANGE_DESCRIPTIONS[range]}</Eyebrow>
            <h2 id="window-summary" className="text-lg font-semibold tracking-tight text-ink">
              Window summary
            </h2>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-muted">
            {formatDate(summary.windowStart)} – {formatDate(summary.windowEnd)} · {summary.bars.length} bars ·{" "}
            {INTERVAL_LABELS[interval].toLowerCase()}
          </p>
        </div>

        <MetricGrid>
          <MetricCell>
            <Metric
              label="Period return"
              value={formatPercent(summary.periodReturn, { signed: true })}
              tone={summary.periodReturn}
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
              hint={<RangeGauge position={rangePosition} />}
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
          <Notice
            className="mt-3"
            title={`${summary.warnings.length} note${summary.warnings.length === 1 ? "" : "s"} about this window`}
          >
            <ul className="space-y-1">
              {summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Notice>
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

        <div className="flex flex-col gap-y-2 border-b border-hairline px-4 py-2.5 lg:flex-row lg:items-center lg:gap-x-6">
          <ChipRow label="Overlays">
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
          </ChipRow>

          <ChipRow label="Panes">
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
          </ChipRow>
        </div>

        <div className="p-3 sm:p-4">
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

        {activeMarker && (
          <MarkerDetail marker={activeMarker} onClose={() => setActiveMarker(null)} />
        )}

        <PanelNote className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="hidden items-center gap-1.5 sm:inline-flex">Drag across the plot to zoom</span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Kbd>Esc</Kbd> or double-click to reset
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> step through sessions
          </span>
          <span className="sm:hidden">Touch and drag across the plot to read values.</span>
          <span className="text-faint sm:ml-auto">Non-trading days are not plotted, so weekends leave no gap.</span>
        </PanelNote>
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
      <section className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel id="position" className="min-w-0 scroll-mt-32">
          <PanelHeader
            title="Your position"
            eyebrow="From the sample transaction log"
            actions={
              <Link href="/portfolio" className={buttonClass({ variant: "ghost", size: "xs" })}>
                Portfolio
              </Link>
            }
          />
          {position ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-3">
              <Metric label="Shares" value={position.shares.toLocaleString("en-US")} size="sm" />
              <Metric label="Average cost" value={formatPrice(position.averageCost)} size="sm" />
              <Metric label="Market value" value={formatPrice(position.marketValue)} size="sm" />
              <Metric
                label="Unrealized"
                value={formatPriceChange(position.unrealizedPl)}
                tone={position.unrealizedPl}
                hint={formatPercent(position.unrealizedPlPercent, { signed: true })}
                size="sm"
              />
              <Metric
                label="Realized"
                value={formatPriceChange(position.realizedPl)}
                tone={position.realizedPl}
                size="sm"
              />
              <Metric
                label="Weight"
                value={formatPercent(position.weight, { digits: 1 })}
                hint="Share of portfolio value"
                size="sm"
              />
            </div>
          ) : (
            <EmptyState
              title={`No position in ${symbol}`}
              description="The sample transaction log never bought this name."
              action={
                <Link href="/portfolio" className={buttonClass({ variant: "secondary", size: "xs" })}>
                  See current holdings
                </Link>
              }
            />
          )}
        </Panel>

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

/** A labelled row of chips that scrolls sideways on a phone instead of wrapping. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Eyebrow className="w-16 shrink-0 lg:w-auto">{label}</Eyebrow>
      <div className="scrollbar-none fade-end fade-end-sm-none -my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 sm:flex-wrap">
        {children}
      </div>
    </div>
  );
}

/** Where the last close sits between the window's low and high, drawn as a rule. */
function RangeGauge({ position }: { position: number | null }) {
  if (position === null) return <>Where the last close sits between the low and the high</>;
  const clamped = Math.min(1, Math.max(0, position));
  return (
    <span className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="relative block h-1 w-full max-w-[160px] bg-sunken">
        <span className="absolute inset-y-0 left-0 bg-hairline-strong" style={{ width: `${clamped * 100}%` }} />
        <span
          className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 bg-ink"
          style={{ left: `${clamped * 100}%` }}
        />
      </span>
      <span>Last close between the window low and high</span>
    </span>
  );
}

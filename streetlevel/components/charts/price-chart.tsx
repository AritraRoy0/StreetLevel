"use client";

/**
 * The main price chart.
 *
 * Everything is drawn into a single SVG with stacked plot regions that share
 * one horizontal scale. That is what keeps the crosshair, the volume bars and
 * every indicator pane locked to the same bar: there is one index, one band
 * scale, and one pointer handler for the whole stack.
 *
 * Interaction:
 * - Move the pointer, or focus the chart and use the arrow keys, to read values.
 * - Drag horizontally to zoom into a span; double-click or press Escape to reset.
 * - Touch drag reads values rather than zooming, which is the gesture people expect.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  areaPath,
  bandWidth,
  bandX,
  clampZoom,
  dateTickIndices,
  downsampleIndices,
  linearScale,
  linePath,
  mergeDomains,
  nearestIndex,
  niceTicks,
  valueDomain,
} from "./chart-math";
import { useChartSize } from "./use-chart-size";
import {
  EMPTY,
  formatDate,
  formatDayMonth,
  formatMonthYear,
  formatPercent,
  formatPrice,
  formatVolume,
} from "@/lib/analytics";
import type { Bar, EventMarker, Maybe } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export type ChartType = "area" | "line" | "candles";

export interface Overlay {
  key: string;
  label: string;
  color: string;
  values: Maybe[];
  dashed?: boolean;
}

export interface IndicatorPane {
  key: string;
  label: string;
  height: number;
  kind: "line" | "histogram";
  series: Array<{ key: string; label: string; color: string; values: Maybe[] }>;
  /** Horizontal reference lines, such as RSI's 30 and 70. */
  guides?: Array<{ value: number; label?: string }>;
  /** Fixed domain when the indicator has a natural scale, such as RSI's 0-100. */
  domain?: [number, number];
  format?: (value: number) => string;
}

const AXIS_WIDTH = 56;
const BOTTOM_AXIS = 22;
const PANE_GAP = 10;

/**
 * Beyond this many bars the series is thinned before drawing.
 *
 * A wide desktop plot is around 1,400 pixels, so past roughly this count the
 * extra path commands land on the same pixel columns and buy nothing while
 * still costing parse and layout time. Ten years of daily bars is about 2,500.
 */
const MAX_RENDERED_BARS = 1200;

export function PriceChart({
  bars,
  chartType = "area",
  overlays = [],
  band,
  showVolume = true,
  panes = [],
  markers = [],
  height = 320,
  onMarkerSelect,
  readout = "ohlcv",
  valueLabel = "Value",
  className,
}: {
  bars: Bar[];
  chartType?: ChartType;
  overlays?: Overlay[];
  band?: { upper: Maybe[]; lower: Maybe[]; color: string } | null;
  showVolume?: boolean;
  panes?: IndicatorPane[];
  markers?: EventMarker[];
  height?: number;
  onMarkerSelect?: (marker: EventMarker) => void;
  /**
   * `ohlcv` suits a real bar series. `value` suits a single-valued series such
   * as an account-value curve, where open, high, low and volume are synthetic
   * and printing them would be noise dressed up as data.
   */
  readout?: "ohlcv" | "value";
  valueLabel?: string;
  className?: string;
}) {
  const { ref, width } = useChartSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [zoom, setZoom] = useState<{ start: number; end: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  // The zoom window is an index range into the full bar array. Resetting it
  // when the incoming series changes length avoids showing a stale slice.
  const view = useMemo(() => {
    if (!zoom || zoom.end >= bars.length) return { bars, offset: 0 };
    return { bars: bars.slice(zoom.start, zoom.end + 1), offset: zoom.start };
  }, [bars, zoom]);

  /**
   * One selection of positions, derived from the bars and then applied to
   * every series. Sharing it is what keeps overlays, indicator panes, the
   * crosshair and the event markers pointing at the same session after
   * thinning.
   */
  const selection = useMemo(() => {
    const source = view.bars;
    if (source.length <= MAX_RENDERED_BARS) return null;
    return downsampleIndices(source.length, MAX_RENDERED_BARS, (index) => source[index].close);
  }, [view.bars]);

  const visible = useMemo(
    () => (selection ? selection.map((index) => view.bars[index]) : view.bars),
    [selection, view.bars],
  );
  const count = visible.length;

  const sliceOverlay = useCallback(
    (values: Maybe[]) => {
      const zoomed = zoom && zoom.end < values.length ? values.slice(zoom.start, zoom.end + 1) : values;
      return selection ? selection.map((index) => zoomed[index] ?? null) : zoomed;
    },
    [zoom, selection],
  );

  const volumeHeight = showVolume ? 54 : 0;
  const paneHeight = panes.reduce((total, pane) => total + pane.height + PANE_GAP, 0);
  const priceHeight = Math.max(120, height);
  const totalHeight = priceHeight + (showVolume ? volumeHeight + PANE_GAP : 0) + paneHeight + BOTTOM_AXIS;
  const plotWidth = Math.max(80, width - AXIS_WIDTH);

  const x = useCallback((index: number) => bandX(index, count, plotWidth, 2), [count, plotWidth]);
  const barW = bandWidth(count, plotWidth, 2, 0.62);

  const priceDomain = useMemo(() => {
    const domains: [number, number][] = [];
    if (chartType === "candles") {
      domains.push(valueDomain(visible.flatMap((bar) => [bar.high, bar.low])));
    } else {
      domains.push(valueDomain(visible.map((bar) => bar.close)));
    }
    for (const overlay of overlays) domains.push(valueDomain(sliceOverlay(overlay.values)));
    if (band) {
      domains.push(valueDomain(sliceOverlay(band.upper)));
      domains.push(valueDomain(sliceOverlay(band.lower)));
    }
    return mergeDomains(domains);
  }, [visible, overlays, band, chartType, sliceOverlay]);

  const priceScale = useMemo(() => linearScale(priceDomain, [priceHeight - 8, 8]), [priceDomain, priceHeight]);

  const volumeTop = priceHeight + PANE_GAP;
  const volumeScale = useMemo(
    () =>
      linearScale(valueDomain(visible.map((bar) => bar.volume), { includeZero: true, padding: 0.02 }), [
        volumeTop + volumeHeight,
        volumeTop + 6,
      ]),
    [visible, volumeTop, volumeHeight],
  );

  const paneLayout = useMemo(() => {
    // Each pane's vertical offset is the sum of the heights before it, derived
    // from the array rather than accumulated in place so the computation stays
    // a pure function of its inputs.
    const firstTop = priceHeight + (showVolume ? volumeHeight + PANE_GAP : 0) + PANE_GAP;
    return panes.map((pane, index) => {
      const top =
        firstTop + panes.slice(0, index).reduce((total, earlier) => total + earlier.height + PANE_GAP, 0);
      const sliced = pane.series.map((series) => ({ ...series, values: sliceOverlay(series.values) }));
      const domain =
        pane.domain ??
        mergeDomains(
          sliced.map((series) =>
            valueDomain(series.values, { includeZero: pane.kind === "histogram", padding: 0.1 }),
          ),
        );
      return { pane, top, scale: linearScale(domain, [top + pane.height, top + 4]), series: sliced, domain };
    });
  }, [panes, priceHeight, showVolume, volumeHeight, sliceOverlay]);

  const timestamps = useMemo(() => visible.map((bar) => bar.timestamp), [visible]);
  const tickIndices = useMemo(
    () => dateTickIndices(timestamps, Math.max(3, Math.floor(plotWidth / 110))),
    [timestamps, plotWidth],
  );
  const spanDays = useMemo(() => {
    if (timestamps.length < 2) return 0;
    return (new Date(timestamps[timestamps.length - 1]).getTime() - new Date(timestamps[0]).getTime()) / 86_400_000;
  }, [timestamps]);
  const axisLabel = spanDays > 400 ? formatMonthYear : formatDayMonth;

  const priceTicks = useMemo(() => niceTicks(priceScale.domain, 5), [priceScale]);

  const pointerIndex = useCallback(
    (event: { clientX: number }) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return nearestIndex(event.clientX - rect.left, count, plotWidth, 2);
    },
    [count, plotWidth],
  );

  const handleMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const index = pointerIndex(event);
      if (index === null) return;
      setHover(index);
      setDrag((current) => (current ? { ...current, to: index } : null));
    },
    [pointerIndex],
  );

  const handleDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      // Only a mouse drag zooms; a touch drag should read values, not rescale.
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      const index = pointerIndex(event);
      if (index === null) return;
      setDrag({ from: index, to: index });
    },
    [pointerIndex],
  );

  /** Maps a rendered position back to its index in the unthinned bar array. */
  const toSourceIndex = useCallback(
    (rendered: number) => view.offset + (selection ? selection[rendered] : rendered),
    [selection, view.offset],
  );

  const handleUp = useCallback(() => {
    if (!drag) return;
    const picked = clampZoom(drag.from, drag.to, count, 5);
    if (picked) {
      // The drag was measured in rendered positions; the zoom window has to be
      // stored against the full series or a second zoom would compound the
      // thinning.
      setZoom({ start: toSourceIndex(picked.start), end: toSourceIndex(picked.end) });
    }
    setDrag(null);
  }, [drag, count, toSourceIndex]);

  const handleKey = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (event.key === "Escape") {
        setZoom(null);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setHover((current) => {
          const base = current ?? count - 1;
          const next = event.key === "ArrowLeft" ? base - 1 : base + 1;
          return Math.min(count - 1, Math.max(0, next));
        });
      }
      if (event.key === "Home") setHover(0);
      if (event.key === "End") setHover(count - 1);
    },
    [count],
  );

  if (bars.length === 0) {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center border border-dashed border-hairline-strong bg-surface", className)}
        style={{ height: totalHeight }}
      >
        <p className="text-[12px] text-muted">No price history to chart.</p>
      </div>
    );
  }

  const activeIndex = hover !== null && hover < count ? hover : null;
  const activeBar = activeIndex !== null ? visible[activeIndex] : null;
  const readoutIndex = activeIndex ?? count - 1;
  const closes = visible.map((bar) => bar.close);
  // Markers carry indices into the full series. Translate each into the
  // rendered position it belongs to, snapping to the nearest kept bar when the
  // series has been thinned so a marker never drifts off its session.
  const markerLookup = new Map<number, EventMarker>();
  for (const marker of markers) {
    const local = marker.index - view.offset;
    if (local < 0 || local >= view.bars.length) continue;
    let rendered = local;
    if (selection) {
      rendered = 0;
      let best = Infinity;
      for (let i = 0; i < selection.length; i += 1) {
        const distance = Math.abs(selection[i] - local);
        if (distance < best) {
          best = distance;
          rendered = i;
        }
        if (selection[i] > local) break;
      }
    }
    if (rendered >= 0 && rendered < count) markerLookup.set(rendered, marker);
  }

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          className="absolute right-0 top-0 z-10 border border-hairline bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-ink"
        >
          Reset zoom
        </button>
      )}

      <svg
        ref={svgRef}
        role="img"
        aria-label={`Price chart, ${count} sessions from ${formatDate(timestamps[0])} to ${formatDate(timestamps[count - 1])}`}
        tabIndex={0}
        width={width}
        height={totalHeight}
        className="chart-surface block cursor-crosshair outline-none"
        onPointerMove={handleMove}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={() => {
          setHover(null);
          setDrag(null);
        }}
        onDoubleClick={() => setZoom(null)}
        onKeyDown={handleKey}
      >
        {/* Horizontal grid and the price axis, labelled on the right. */}
        {priceTicks.map((tick) => {
          const y = priceScale(tick);
          if (!Number.isFinite(y)) return null;
          return (
            <g key={`price-tick-${tick}`}>
              <line x1={0} x2={plotWidth} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
              <text
                x={plotWidth + 8}
                y={y + 3}
                className="fill-[var(--color-faint)] font-mono"
                style={{ fontSize: 10 }}
              >
                {formatPrice(tick).replace("$", "")}
              </text>
            </g>
          );
        })}

        {/* Bollinger envelope, drawn first so the price line sits above it. */}
        {band && (
          <>
            <path
              d={linePath(sliceOverlay(band.upper), x, priceScale)}
              fill="none"
              stroke={band.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <path
              d={linePath(sliceOverlay(band.lower), x, priceScale)}
              fill="none"
              stroke={band.color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          </>
        )}

        {chartType === "area" && (
          <path d={areaPath(closes, x, priceScale, priceHeight - 8)} fill="var(--chart-price-fill)" />
        )}

        {chartType === "candles"
          ? visible.map((bar, index) => {
              const up = bar.close >= bar.open;
              const colour = up ? "var(--chart-pos)" : "var(--chart-neg)";
              const cx = x(index);
              const openY = priceScale(bar.open);
              const closeY = priceScale(bar.close);
              const top = Math.min(openY, closeY);
              const bodyHeight = Math.max(1, Math.abs(closeY - openY));
              return (
                <g key={bar.timestamp}>
                  <line
                    x1={cx}
                    x2={cx}
                    y1={priceScale(bar.high)}
                    y2={priceScale(bar.low)}
                    stroke={colour}
                    strokeWidth={1}
                  />
                  <rect
                    x={cx - barW / 2}
                    y={top}
                    width={barW}
                    height={bodyHeight}
                    fill={up ? "var(--color-surface)" : colour}
                    stroke={colour}
                    strokeWidth={1}
                  />
                </g>
              );
            })
          : (
            <path
              d={linePath(closes, x, priceScale)}
              fill="none"
              stroke="var(--chart-price)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}

        {overlays.map((overlay) => (
          <path
            key={overlay.key}
            d={linePath(sliceOverlay(overlay.values), x, priceScale)}
            fill="none"
            stroke={overlay.color}
            strokeWidth={1.25}
            strokeDasharray={overlay.dashed ? "4 3" : undefined}
            strokeLinejoin="round"
          />
        ))}

        {/* News event markers, pinned to the session that traded on the story. */}
        {Array.from(markerLookup.entries()).map(([index, marker]) => {
          const cx = x(index);
          const colour =
            marker.sentiment === "positive"
              ? "var(--chart-pos)"
              : marker.sentiment === "negative"
                ? "var(--chart-neg)"
                : "var(--color-faint)";
          return (
            <g
              key={`marker-${marker.timestamp}`}
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                onMarkerSelect?.(marker);
              }}
            >
              <title>{`${marker.articles.length} ${marker.articles.length === 1 ? "story" : "stories"} on ${formatDate(marker.timestamp)}`}</title>
              <line x1={cx} x2={cx} y1={priceHeight - 16} y2={priceHeight - 6} stroke={colour} strokeWidth={1} />
              <circle cx={cx} cy={priceHeight - 18} r={3} fill="var(--color-surface)" stroke={colour} strokeWidth={1.25} />
            </g>
          );
        })}

        {/* Volume pane. */}
        {showVolume &&
          visible.map((bar, index) => {
            const up = index === 0 ? true : bar.close >= visible[index - 1].close;
            const y = volumeScale(bar.volume);
            const base = volumeTop + volumeHeight;
            return (
              <rect
                key={`vol-${bar.timestamp}`}
                x={x(index) - barW / 2}
                y={Math.min(y, base)}
                width={barW}
                height={Math.max(0.5, base - y)}
                fill={up ? "var(--chart-pos)" : "var(--chart-neg)"}
                opacity={0.28}
              />
            );
          })}
        {showVolume && (
          <>
            <line
              x1={0}
              x2={plotWidth}
              y1={volumeTop + volumeHeight}
              y2={volumeTop + volumeHeight}
              stroke="var(--chart-axis)"
              strokeWidth={1}
            />
            <text x={2} y={volumeTop + 10} className="fill-[var(--color-faint)]" style={{ fontSize: 9, letterSpacing: "0.1em" }}>
              VOLUME
            </text>
            <text
              x={plotWidth + 8}
              y={volumeTop + 10}
              className="fill-[var(--color-faint)] font-mono"
              style={{ fontSize: 9 }}
            >
              {formatVolume(volumeScale.domain[1])}
            </text>
          </>
        )}

        {/* Indicator panes. */}
        {paneLayout.map(({ pane, top, scale, series, domain }) => (
          <g key={pane.key}>
            <line x1={0} x2={plotWidth} y1={top} y2={top} stroke="var(--chart-grid)" strokeWidth={1} />
            {(pane.guides ?? []).map((guide) => (
              <g key={`${pane.key}-guide-${guide.value}`}>
                <line
                  x1={0}
                  x2={plotWidth}
                  y1={scale(guide.value)}
                  y2={scale(guide.value)}
                  stroke="var(--chart-axis)"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
                <text
                  x={plotWidth + 8}
                  y={scale(guide.value) + 3}
                  className="fill-[var(--color-faint)] font-mono"
                  style={{ fontSize: 9 }}
                >
                  {guide.label ?? guide.value}
                </text>
              </g>
            ))}
            {pane.kind === "histogram"
              ? series.flatMap((entry) =>
                  entry.values.map((value, index) =>
                    value === null ? null : (
                      <rect
                        key={`${pane.key}-${entry.key}-${index}`}
                        x={x(index) - barW / 2}
                        y={Math.min(scale(value), scale(0))}
                        width={barW}
                        height={Math.max(0.5, Math.abs(scale(value) - scale(0)))}
                        fill={value >= 0 ? "var(--chart-pos)" : "var(--chart-neg)"}
                        opacity={0.4}
                      />
                    ),
                  ),
                )
              : series.map((entry) => (
                  <path
                    key={`${pane.key}-${entry.key}`}
                    d={linePath(entry.values, x, scale)}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={1.25}
                  />
                ))}
            {pane.kind === "histogram" &&
              series
                .filter((entry) => entry.key !== "histogram")
                .map((entry) => (
                  <path
                    key={`${pane.key}-line-${entry.key}`}
                    d={linePath(entry.values, x, scale)}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={1.25}
                  />
                ))}
            <text x={2} y={top + 11} className="fill-[var(--color-faint)]" style={{ fontSize: 9, letterSpacing: "0.1em" }}>
              {pane.label.toUpperCase()}
            </text>
            {!pane.domain && (
              <text
                x={plotWidth + 8}
                y={top + 11}
                className="fill-[var(--color-faint)] font-mono"
                style={{ fontSize: 9 }}
              >
                {(pane.format ?? ((value: number) => value.toFixed(2)))(domain[1])}
              </text>
            )}
          </g>
        ))}

        {/* Time axis. */}
        <line
          x1={0}
          x2={plotWidth}
          y1={totalHeight - BOTTOM_AXIS}
          y2={totalHeight - BOTTOM_AXIS}
          stroke="var(--chart-axis)"
          strokeWidth={1}
        />
        {tickIndices.map((index) => (
          <text
            key={`x-${index}`}
            x={Math.min(Math.max(x(index), 14), plotWidth - 14)}
            y={totalHeight - 7}
            textAnchor="middle"
            className="fill-[var(--color-faint)]"
            style={{ fontSize: 10 }}
          >
            {axisLabel(timestamps[index])}
          </text>
        ))}

        {/* Drag-to-zoom selection. */}
        {drag && Math.abs(drag.to - drag.from) > 0 && (
          <rect
            x={Math.min(x(drag.from), x(drag.to))}
            y={0}
            width={Math.abs(x(drag.to) - x(drag.from))}
            height={totalHeight - BOTTOM_AXIS}
            fill="var(--color-ink)"
            opacity={0.06}
          />
        )}

        {/* Crosshair. */}
        {activeIndex !== null && activeBar && (
          <g pointerEvents="none">
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={0}
              y2={totalHeight - BOTTOM_AXIS}
              stroke="var(--chart-crosshair)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.45}
            />
            <line
              x1={0}
              x2={plotWidth}
              y1={priceScale(activeBar.close)}
              y2={priceScale(activeBar.close)}
              stroke="var(--chart-crosshair)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.25}
            />
            <circle cx={x(activeIndex)} cy={priceScale(activeBar.close)} r={3} fill="var(--chart-price)" />
            <rect
              x={plotWidth + 1}
              y={priceScale(activeBar.close) - 8}
              width={AXIS_WIDTH - 2}
              height={16}
              fill="var(--color-ink)"
            />
            <text
              x={plotWidth + 8}
              y={priceScale(activeBar.close) + 3}
              className="fill-[var(--color-surface)] font-mono"
              style={{ fontSize: 10 }}
            >
              {formatPrice(activeBar.close).replace("$", "")}
            </text>
          </g>
        )}
      </svg>

      {/*
        Before the pointer enters the plot the readout describes the latest
        bar, overlays and indicator values included. Showing em dashes there
        would imply the values are unavailable rather than simply un-hovered.
      */}
      <ChartReadout
        bar={visible[readoutIndex]}
        mode={readout}
        valueLabel={valueLabel}
        previous={readoutIndex > 0 ? visible[readoutIndex - 1] : null}
        overlays={overlays.map((overlay) => ({
          label: overlay.label,
          color: overlay.color,
          value: sliceOverlay(overlay.values)[readoutIndex] ?? null,
        }))}
        panes={paneLayout.map(({ pane, series }) => ({
          label: pane.label,
          format: pane.format,
          entries: series.map((entry) => ({
            label: entry.label,
            color: entry.color,
            value: entry.values[readoutIndex] ?? null,
          })),
        }))}
      />
    </div>
  );
}

/**
 * The hover readout under the chart.
 *
 * It occupies the same space whether or not the pointer is over the plot,
 * falling back to the latest bar. A readout that appears and disappears makes
 * the layout jump every time the mouse crosses the chart.
 */
function ChartReadout({
  bar,
  previous,
  overlays,
  panes,
  mode,
  valueLabel,
}: {
  bar: Bar;
  previous: Bar | null;
  overlays: Array<{ label: string; color: string; value: Maybe }>;
  panes: Array<{ label: string; format?: (value: number) => string; entries: Array<{ label: string; color: string; value: Maybe }> }>;
  mode: "ohlcv" | "value";
  valueLabel: string;
}) {
  const shown = bar;
  const change = previous && previous.close > 0 ? shown.close / previous.close - 1 : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-3 text-[11px]">
      <span className="font-mono font-semibold tabular-nums text-ink">{formatDate(shown.timestamp)}</span>
      {mode === "ohlcv" ? (
        <>
          <ReadoutValue label="O" value={formatPrice(shown.open)} />
          <ReadoutValue label="H" value={formatPrice(shown.high)} />
          <ReadoutValue label="L" value={formatPrice(shown.low)} />
          <ReadoutValue label="C" value={formatPrice(shown.close)} />
          <ReadoutValue label="Vol" value={formatVolume(shown.volume)} />
        </>
      ) : (
        <ReadoutValue label={valueLabel} value={formatPrice(shown.close)} />
      )}
      {change !== null && (
        <span
          className={cn(
            "font-mono tabular-nums",
            change > 0 ? "text-pos" : change < 0 ? "text-neg" : "text-muted",
          )}
        >
          {formatPercent(change, { signed: true })}
        </span>
      )}
      {overlays.map((overlay) => (
        <span key={overlay.label} className="inline-flex items-center gap-1.5 text-muted">
          <span aria-hidden="true" className="h-0.5 w-3" style={{ background: overlay.color }} />
          {overlay.label}
          <span className="font-mono tabular-nums text-ink-soft">
            {overlay.value === null ? EMPTY : formatPrice(overlay.value)}
          </span>
        </span>
      ))}
      {panes.flatMap((pane) =>
        pane.entries.map((entry) => (
          <span key={`${pane.label}-${entry.label}`} className="inline-flex items-center gap-1.5 text-muted">
            <span aria-hidden="true" className="h-0.5 w-3" style={{ background: entry.color }} />
            {entry.label}
            <span className="font-mono tabular-nums text-ink-soft">
              {entry.value === null ? EMPTY : (pane.format ?? ((value: number) => value.toFixed(2)))(entry.value)}
            </span>
          </span>
        )),
      )}
    </div>
  );
}

function ReadoutValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-muted">
      <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      <span className="font-mono tabular-nums text-ink-soft">{value}</span>
    </span>
  );
}

"use client";

/**
 * Normalized performance chart.
 *
 * Both series are rebased to 100 on the first date they share, so the y-axis
 * reads as "value of 100 invested on day one" and the two lines are directly
 * comparable regardless of their share prices. The 100 line is drawn explicitly
 * because the whole chart is about distance from it.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { bandX, dateTickIndices, linearScale, linePath, nearestIndex, niceTicks, valueDomain } from "./chart-math";
import { useChartSize } from "./use-chart-size";
import { EMPTY, formatDate, formatDayMonth, formatMonthYear, formatPercent } from "@/lib/analytics";
import type { NormalizedPoint } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const AXIS_WIDTH = 44;
const BOTTOM_AXIS = 22;

export function ComparisonChart({
  points,
  baseLabel,
  benchmarkLabel,
  height = 240,
  className,
}: {
  points: NormalizedPoint[];
  baseLabel: string;
  benchmarkLabel: string;
  height?: number;
  className?: string;
}) {
  const { ref, width } = useChartSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = Math.max(80, width - AXIS_WIDTH);
  const count = points.length;
  const x = useCallback((index: number) => bandX(index, count, plotWidth, 2), [count, plotWidth]);

  const baseValues = useMemo(() => points.map((point) => point.base), [points]);
  const benchValues = useMemo(() => points.map((point) => point.benchmark), [points]);

  const scale = useMemo(() => {
    const domain = valueDomain([...baseValues, ...benchValues, 100], { padding: 0.08 });
    return linearScale(domain, [height - 8, 8]);
  }, [baseValues, benchValues, height]);

  const timestamps = useMemo(() => points.map((point) => point.timestamp), [points]);
  const tickIndices = useMemo(
    () => dateTickIndices(timestamps, Math.max(3, Math.floor(plotWidth / 110))),
    [timestamps, plotWidth],
  );
  const spanDays =
    timestamps.length > 1
      ? (new Date(timestamps[timestamps.length - 1]).getTime() - new Date(timestamps[0]).getTime()) / 86_400_000
      : 0;
  const axisLabel = spanDays > 400 ? formatMonthYear : formatDayMonth;

  if (count === 0) {
    return (
      <div
        ref={ref}
        className={cn("flex items-center justify-center border border-dashed border-hairline-strong bg-surface", className)}
        style={{ height: height + BOTTOM_AXIS }}
      >
        <p className="text-[12px] text-muted">These two series share no trading days.</p>
      </div>
    );
  }

  const activeIndex = hover !== null && hover < count ? hover : count - 1;
  const active = points[activeIndex];

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={`${baseLabel} against ${benchmarkLabel}, both rebased to 100`}
        width={width}
        height={height + BOTTOM_AXIS}
        className="chart-surface block cursor-crosshair"
        onPointerMove={(event) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          setHover(nearestIndex(event.clientX - rect.left, count, plotWidth, 2));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {niceTicks(scale.domain, 4).map((tick) => (
          <g key={`tick-${tick}`}>
            <line
              x1={0}
              x2={plotWidth}
              y1={scale(tick)}
              y2={scale(tick)}
              stroke={tick === 100 ? "var(--chart-axis)" : "var(--chart-grid)"}
              strokeWidth={1}
            />
            <text x={plotWidth + 6} y={scale(tick) + 3} className="fill-[var(--color-faint)] font-mono" style={{ fontSize: 10 }}>
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {/* The break-even line sits above the grid so it is never obscured. */}
        <line x1={0} x2={plotWidth} y1={scale(100)} y2={scale(100)} stroke="var(--chart-axis)" strokeWidth={1} />

        <path d={linePath(benchValues, x, scale)} fill="none" stroke="var(--chart-benchmark)" strokeWidth={1.25} />
        <path d={linePath(baseValues, x, scale)} fill="none" stroke="var(--chart-price)" strokeWidth={1.75} />

        {tickIndices.map((index) => (
          <text
            key={`x-${index}`}
            x={Math.min(Math.max(x(index), 14), plotWidth - 14)}
            y={height + BOTTOM_AXIS - 7}
            textAnchor="middle"
            className="fill-[var(--color-faint)]"
            style={{ fontSize: 10 }}
          >
            {axisLabel(timestamps[index])}
          </text>
        ))}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(activeIndex)} x2={x(activeIndex)} y1={0} y2={height} stroke="var(--chart-crosshair)" strokeWidth={1} strokeDasharray="2 3" opacity={0.4} />
            {active.base !== null && <circle cx={x(activeIndex)} cy={scale(active.base)} r={3} fill="var(--chart-price)" />}
            {active.benchmark !== null && (
              <circle cx={x(activeIndex)} cy={scale(active.benchmark)} r={3} fill="var(--chart-benchmark)" />
            )}
          </g>
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline pt-3 text-[11px]">
        <span className="font-mono font-semibold tabular-nums text-ink">{formatDate(active.timestamp)}</span>
        <LegendValue label={baseLabel} colour="var(--chart-price)" value={active.base} />
        <LegendValue label={benchmarkLabel} colour="var(--chart-benchmark)" value={active.benchmark} />
        <span className="text-muted">
          Spread{" "}
          <span className="font-mono tabular-nums text-ink-soft">
            {active.base === null || active.benchmark === null
              ? EMPTY
              : formatPercent((active.base - active.benchmark) / 100, { signed: true })}
          </span>
        </span>
      </div>
    </div>
  );
}

function LegendValue({ label, colour, value }: { label: string; colour: string; value: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span aria-hidden="true" className="h-0.5 w-4" style={{ background: colour }} />
      {label}
      <span className="font-mono tabular-nums text-ink-soft">{value === null ? EMPTY : value.toFixed(1)}</span>
    </span>
  );
}

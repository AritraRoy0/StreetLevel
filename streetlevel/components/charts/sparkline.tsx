/**
 * A trend glyph for table rows.
 *
 * Deliberately unlabelled and unscaled: it shows shape, not level. The colour
 * carries the only quantitative claim it makes, which is whether the series
 * finished above or below where it started.
 *
 * `fluid` draws it at the width of its container instead of a fixed one. The
 * geometry is laid out in a viewBox and stretched, and the stroke is marked
 * non-scaling so it keeps its weight however wide the box gets. That keeps the
 * component server-rendered, with no measuring and no layout shift.
 */

import { bandX, linearScale, linePath, valueDomain } from "./chart-math";
import { cn } from "@/lib/utils";
import type { Maybe } from "@/lib/analytics";

export function Sparkline({
  values,
  width = 96,
  height = 26,
  tone = "auto",
  fill = false,
  fluid = false,
  label,
  className,
}: {
  values: readonly Maybe[];
  width?: number;
  height?: number;
  tone?: "auto" | "ink" | "muted";
  /** Shade the area under the line. */
  fill?: boolean;
  /** Stretch to the container's width, keeping `height`. */
  fluid?: boolean;
  /** When given, the glyph is announced instead of hidden from assistive tech. */
  label?: string;
  className?: string;
}) {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (clean.length < 2) {
    return <div aria-hidden="true" className={cn("shrink-0", className)} style={{ width: fluid ? "100%" : width, height }} />;
  }

  const scale = linearScale(valueDomain(clean, { padding: 0.12 }), [height - 2, 2]);
  const x = (index: number) => bandX(index, clean.length, width, 1);
  const path = linePath(clean, x, scale);
  const rising = clean[clean.length - 1] >= clean[0];
  const stroke =
    tone === "ink"
      ? "var(--chart-price)"
      : tone === "muted"
        ? "var(--color-faint)"
        : rising
          ? "var(--chart-pos)"
          : "var(--chart-neg)";
  const area = fill ? `${path} L${x(clean.length - 1).toFixed(2)},${height} L${x(0).toFixed(2)},${height} Z` : null;

  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block shrink-0 overflow-visible", className)}
    >
      {area && <path d={area} fill={stroke} opacity={0.08} />}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Thins a series to about `points` values spread evenly across its whole span,
 * always keeping the first and last, so a glyph labelled "1Y" draws the year
 * rather than only its final weeks.
 */
export function thinSeries(values: readonly number[], points: number): number[] {
  if (values.length <= points) return [...values];
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, index) => values[Math.round(index * step)]);
}

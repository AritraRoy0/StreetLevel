/**
 * A trend glyph for table rows.
 *
 * Deliberately unlabelled and unscaled: it shows shape, not level. The colour
 * carries the only quantitative claim it makes, which is whether the series
 * finished above or below where it started.
 */

import { bandX, linearScale, linePath, valueDomain } from "./chart-math";
import { cn } from "@/lib/utils";
import type { Maybe } from "@/lib/analytics";

export function Sparkline({
  values,
  width = 96,
  height = 26,
  tone = "auto",
  className,
}: {
  values: readonly Maybe[];
  width?: number;
  height?: number;
  tone?: "auto" | "ink" | "muted";
  className?: string;
}) {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (clean.length < 2) {
    return <div aria-hidden="true" className={cn("h-[26px] w-24", className)} />;
  }

  const scale = linearScale(valueDomain(clean, { padding: 0.12 }), [height - 2, 2]);
  const path = linePath(clean, (index) => bandX(index, clean.length, width, 1), scale);
  const rising = clean[clean.length - 1] >= clean[0];
  const stroke =
    tone === "ink"
      ? "var(--chart-price)"
      : tone === "muted"
        ? "var(--color-faint)"
        : rising
          ? "var(--chart-pos)"
          : "var(--chart-neg)";

  return (
    <svg width={width} height={height} aria-hidden="true" className={cn("block", className)}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}

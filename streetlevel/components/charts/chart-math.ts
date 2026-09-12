/**
 * Pure geometry for the SVG charts.
 *
 * Kept free of React and of the DOM so chart behaviour can be unit-tested:
 * scales, tick selection, path building and hit testing are where charts
 * actually go wrong, and they are all decidable without rendering anything.
 *
 * Bars are laid out on a **band scale indexed by position**, not by elapsed
 * time. That is the whole of the weekend and market-holiday handling: a series
 * that jumps Friday to Monday draws as two adjacent bars, with no dead gap,
 * because the x-axis counts sessions rather than days.
 */

import type { Maybe } from "@/lib/analytics";

export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
  invert(pixel: number): number;
}

/**
 * Linear scale from a data domain to a pixel range.
 *
 * A zero-width domain (every value identical) would divide by zero, so it is
 * widened by one unit and the series draws as a flat line through the middle
 * of the plot rather than collapsing onto an edge.
 */
export function linearScale(domain: [number, number], range: [number, number]): Scale {
  let [d0, d1] = domain;
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) {
    d0 = 0;
    d1 = 1;
  }
  if (d0 === d1) {
    d0 -= 0.5;
    d1 += 0.5;
  }
  const [r0, r1] = range;
  const span = d1 - d0;

  const scale = ((value: number) => {
    if (!Number.isFinite(value)) return Number.NaN;
    return r0 + ((value - d0) / span) * (r1 - r0);
  }) as Scale;

  scale.domain = [d0, d1];
  scale.range = range;
  scale.invert = (pixel: number) => d0 + ((pixel - r0) / (r1 - r0)) * span;
  return scale;
}

/**
 * Horizontal position of bar `index` within a plot `width` wide.
 * Bars sit at the centre of their band, so the first and last are inset by
 * half a band and never clip against the axis.
 */
export function bandX(index: number, count: number, width: number, padding = 0): number {
  if (count <= 0) return padding;
  if (count === 1) return padding + (width - 2 * padding) / 2;
  const inner = width - 2 * padding;
  const step = inner / count;
  return padding + step * index + step / 2;
}

/** Width of one band, used for candle bodies and volume bars. */
export function bandWidth(count: number, width: number, padding = 0, ratio = 0.7): number {
  if (count <= 0) return 0;
  const inner = width - 2 * padding;
  return Math.max(0.5, (inner / count) * ratio);
}

/**
 * Nearest bar index to a pixel position, clamped to the series.
 * This is the crosshair's hit test; clamping means dragging off either edge
 * keeps the readout pinned to the first or last bar instead of blanking.
 */
export function nearestIndex(x: number, count: number, width: number, padding = 0): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  const inner = width - 2 * padding;
  const step = inner / count;
  const raw = Math.floor((x - padding) / step);
  return Math.min(count - 1, Math.max(0, raw));
}

/**
 * Pads a value domain by a fraction of its span so the series does not touch
 * the top and bottom of the plot.
 *
 * `includeZero` is for volume, where a bar chart that does not start at zero
 * exaggerates every difference.
 */
export function valueDomain(
  values: readonly Maybe[],
  { padding = 0.06, includeZero = false }: { padding?: number; includeZero?: boolean } = {},
): [number, number] {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (clean.length === 0) return [0, 1];
  const max = Math.max(...clean);
  let min = Math.min(...clean);
  if (includeZero) min = Math.min(0, min);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * padding;
  return [min - pad, max + pad];
}

/** Union of several domains, for overlaying moving averages on a price axis. */
export function mergeDomains(domains: readonly [number, number][]): [number, number] {
  const usable = domains.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (usable.length === 0) return [0, 1];
  return [Math.min(...usable.map(([a]) => a)), Math.max(...usable.map(([, b]) => b))];
}

/**
 * Round tick values covering a domain, at 1, 2, 2.5 or 5 times a power of ten.
 * Returns at most `count + 2` ticks and never an empty array.
 */
export function niceTicks(domain: [number, number], count = 5): number[] {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= max + step * 1e-6; value += step) {
    // Re-round to kill accumulated floating point drift such as 0.30000000004.
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks.length > 0 ? ticks : [min, max];
}

/**
 * Picks bar indices to label on the time axis.
 *
 * Labels are placed at natural calendar boundaries (a change of month, or of
 * year on long ranges) rather than at even pixel intervals, so the axis reads
 * as dates a person recognises. When there are fewer boundaries than requested
 * labels, evenly spaced indices are used instead.
 */
export function dateTickIndices(timestamps: readonly string[], maxTicks = 6): number[] {
  if (timestamps.length === 0) return [];
  if (timestamps.length <= maxTicks) return timestamps.map((_, index) => index);

  const first = new Date(timestamps[0]);
  const last = new Date(timestamps[timestamps.length - 1]);
  const spanDays = (last.getTime() - first.getTime()) / 86_400_000;

  const boundaries: number[] = [];
  const useYear = spanDays > 900;
  let previous = "";
  for (let i = 0; i < timestamps.length; i += 1) {
    const date = new Date(timestamps[i]);
    const key = useYear ? String(date.getUTCFullYear()) : `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (key !== previous) {
      boundaries.push(i);
      previous = key;
    }
  }

  if (boundaries.length >= 2 && boundaries.length <= maxTicks + 2) return boundaries;
  if (boundaries.length > maxTicks) {
    const stride = Math.ceil(boundaries.length / maxTicks);
    return boundaries.filter((_, index) => index % stride === 0);
  }

  const stride = Math.max(1, Math.floor((timestamps.length - 1) / (maxTicks - 1)));
  const evenly: number[] = [];
  for (let i = 0; i < timestamps.length; i += stride) evenly.push(i);
  if (evenly[evenly.length - 1] !== timestamps.length - 1) evenly.push(timestamps.length - 1);
  return evenly;
}

export interface PathPoint {
  x: number;
  y: number;
}

/**
 * SVG path for a series that may contain gaps.
 *
 * A `null` starts a new subpath rather than interpolating across it. Drawing a
 * straight line over a warm-up period or a missing session invents data that
 * was never there, which is exactly what a moving-average overlay must not do.
 */
export function linePath(values: readonly Maybe[], x: (index: number) => number, y: (value: number) => number): string {
  let path = "";
  let penDown = false;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || !Number.isFinite(value)) {
      penDown = false;
      continue;
    }
    const px = x(i);
    const py = y(value);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${px.toFixed(2)} ${py.toFixed(2)}`;
    penDown = true;
  }
  return path;
}

/**
 * Closed path for a filled area under a series.
 * Only the longest unbroken run is filled; stitching separate runs into one
 * polygon would shade regions the data does not cover.
 */
export function areaPath(
  values: readonly Maybe[],
  x: (index: number) => number,
  y: (value: number) => number,
  baseline: number,
): string {
  const runs: Array<Array<{ index: number; value: number }>> = [];
  let current: Array<{ index: number; value: number }> = [];
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || !Number.isFinite(value)) {
      if (current.length > 0) runs.push(current);
      current = [];
      continue;
    }
    current.push({ index: i, value });
  }
  if (current.length > 0) runs.push(current);
  if (runs.length === 0) return "";

  const longest = runs.reduce((best, run) => (run.length > best.length ? run : best));
  if (longest.length < 2) return "";

  let path = `M${x(longest[0].index).toFixed(2)} ${baseline.toFixed(2)}`;
  for (const point of longest) path += `L${x(point.index).toFixed(2)} ${y(point.value).toFixed(2)}`;
  path += `L${x(longest[longest.length - 1].index).toFixed(2)} ${baseline.toFixed(2)}Z`;
  return path;
}

/**
 * Chooses which positions of a long series to render, thinning it to roughly
 * `limit` points.
 *
 * Returns **indices** rather than items so the caller can apply the same
 * selection to the bars and to every overlay and indicator series. Thinning
 * each array independently would misalign the crosshair from the line it is
 * supposed to be reading.
 *
 * Each bucket contributes its minimum and its maximum, in the order they
 * occur, rather than a single sampled point. Plain every-nth sampling drops
 * spikes: a one-session gap down that falls between two samples simply
 * vanishes from the chart. Min/max bucketing keeps the envelope of the data
 * even at a tenth of the points.
 *
 * The first and last positions are always kept, so a chart still starts and
 * ends on real observations.
 */
export function downsampleIndices(
  count: number,
  limit: number,
  valueAt: (index: number) => number | null,
): number[] {
  if (count <= limit || limit < 4) return Array.from({ length: count }, (_, index) => index);

  const bucketSize = count / (limit / 2);
  const out: number[] = [];

  for (let start = 0; start < count; start += bucketSize) {
    const from = Math.floor(start);
    const to = Math.min(count, Math.floor(start + bucketSize));
    if (to <= from) continue;

    let minIndex = -1;
    let maxIndex = -1;
    let minValue = Infinity;
    let maxValue = -Infinity;
    for (let index = from; index < to; index += 1) {
      const value = valueAt(index);
      if (value === null || !Number.isFinite(value)) continue;
      if (value < minValue) {
        minValue = value;
        minIndex = index;
      }
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    }
    // A bucket with no finite value still contributes its first position, so
    // a run of gaps keeps its width on the x-axis instead of collapsing.
    if (minIndex === -1 && maxIndex === -1) {
      out.push(from);
      continue;
    }
    const first = Math.min(minIndex, maxIndex);
    const second = Math.max(minIndex, maxIndex);
    out.push(first);
    if (second !== first) out.push(second);
  }

  if (out.length === 0 || out[0] !== 0) out.unshift(0);
  if (out[out.length - 1] !== count - 1) out.push(count - 1);
  return out;
}

/** Clamps a zoom selection to valid, non-degenerate bar indices. */
export function clampZoom(
  start: number,
  end: number,
  count: number,
  minimumBars = 5,
): { start: number; end: number } | null {
  if (count <= minimumBars) return null;
  let from = Math.round(Math.min(start, end));
  let to = Math.round(Math.max(start, end));
  from = Math.max(0, Math.min(count - 1, from));
  to = Math.max(0, Math.min(count - 1, to));
  if (to - from + 1 < minimumBars) return null;
  return { start: from, end: to };
}

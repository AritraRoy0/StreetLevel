/**
 * The StreetLevel primitive set.
 *
 * These are the only building blocks the pages use. Keeping them in one file
 * means the visual language is enforced by construction rather than by
 * convention: there is no second way to draw a metric card.
 *
 * Two rules run through all of them. Structure is a one-pixel hairline, never
 * a shadow or a fill. And any value that could be unavailable is rendered
 * through the formatters, so it degrades to an em dash instead of to "NaN".
 */

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EMPTY, formatPercent, signOf } from "@/lib/analytics";

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

/** Small capitalised label used above a heading or inside a card. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold uppercase tracking-[0.16em] text-muted", className)}>
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      {...rest}
      className={cn("border border-hairline bg-surface", className)}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Values                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A signed figure coloured by direction.
 *
 * Colour is backed up by an explicit sign character so the meaning survives for
 * anyone who cannot separate the two hues.
 */
export function Delta({
  value,
  children,
  className,
  showSign = true,
}: {
  value: number | null | undefined;
  children?: ReactNode;
  className?: string;
  showSign?: boolean;
}) {
  const direction = signOf(value);
  const tone =
    direction === "positive" ? "text-pos" : direction === "negative" ? "text-neg" : "text-muted";
  return (
    <span className={cn("font-mono tabular-nums", tone, className)}>
      {children ?? formatPercent(value, { signed: showSign })}
    </span>
  );
}

/**
 * One labelled metric.
 *
 * `hint` carries the caveat that makes a number honest: the window it covers,
 * the sample it rests on, or why it is missing. It is part of the metric, not
 * decoration, which is why it sits in the primitive rather than being left to
 * each caller.
 */
export function Metric({
  label,
  value,
  hint,
  delta,
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueClass =
    size === "lg" ? "text-[28px] leading-8" : size === "sm" ? "text-base leading-6" : "text-xl leading-7";
  return (
    <div className={cn("min-w-0", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className={cn("font-mono font-medium tracking-tight text-ink tabular-nums", valueClass)}>{value}</span>
        {delta !== undefined && <Delta value={delta} className="text-[13px]" />}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</p>}
    </div>
  );
}

/**
 * A responsive grid of metrics separated by hairlines.
 *
 * The negative margin plus per-cell borders produce a single shared grid of
 * rules rather than a set of boxed cards, which is quieter and keeps the
 * columns aligned across breakpoints.
 */
export function MetricGrid({
  children,
  columns = 4,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const columnClass =
    columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={cn("grid grid-cols-1 border-hairline", columnClass, className)}>
      {children}
    </div>
  );
}

export function MetricCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-hairline px-4 py-5 sm:[&:nth-child(even)]:border-l lg:[&:nth-child(even)]:border-l-0 lg:[&:not(:nth-child(4n+1))]:border-l", className)}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Disabled options stay visible so the user can see what exists but is unavailable. */
  disabled?: boolean;
  title?: string;
}

/**
 * A single-choice control rendered as a row of buttons.
 *
 * Unavailable options are shown disabled rather than hidden. A range picker
 * that silently drops the intervals a data source cannot serve leaves the user
 * wondering whether the feature exists; a greyed-out control with a tooltip
 * answers the question.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const padding = size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11px]";
  return (
    <div role="group" aria-label={label} className={cn("inline-flex flex-wrap border border-hairline bg-surface", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "border-r border-hairline font-semibold uppercase tracking-wider transition-colors last:border-r-0",
              padding,
              active ? "bg-ink text-surface" : "text-muted hover:bg-sunken hover:text-ink",
              option.disabled && "cursor-not-allowed text-faint hover:bg-transparent hover:text-faint",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled native select, styled to match the hairline language. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2 border border-hairline bg-surface px-2.5 py-1.5", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn("min-w-0 cursor-pointer bg-transparent font-mono text-[12px] font-semibold text-ink outline-none", className)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** A small checkbox styled as a toggle chip, used for chart overlays. */
export function ToggleChip({
  active,
  onChange,
  children,
  swatch,
  className,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
  children: ReactNode;
  swatch?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        active ? "border-hairline-strong bg-sunken text-ink" : "border-hairline bg-surface text-faint hover:text-muted",
        className,
      )}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className="h-0.5 w-3.5 shrink-0"
          style={{ background: active ? swatch : "var(--color-hairline-strong)" }}
        />
      )}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export type Tone = "neutral" | "positive" | "negative" | "warning" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-hairline text-muted",
  positive: "border-pos/30 text-pos",
  negative: "border-neg/30 text-neg",
  warning: "border-warn/30 text-warn",
  accent: "border-accent/30 text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * An inline notice. Used for data-quality warnings, insufficient history and
 * degraded states, which are conditions the user needs to know about but that
 * do not stop the page working.
 */
export function Callout({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const accentBar =
    tone === "negative" ? "bg-neg" : tone === "warning" ? "bg-warn" : tone === "positive" ? "bg-pos" : "bg-hairline-strong";
  return (
    <div className={cn("flex gap-3 border border-hairline bg-surface p-3", className)}>
      <span aria-hidden="true" className={cn("w-0.5 shrink-0", accentBar)} />
      <div className="min-w-0 text-[12px] leading-relaxed text-muted">
        {title && <p className="mb-0.5 font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/** Placeholder for a section that has nothing to show, with the reason why. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 border border-dashed border-hairline-strong bg-surface px-6 py-12 text-center", className)}>
      <p className="font-mono text-lg text-faint">{EMPTY}</p>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-[12px] leading-relaxed text-muted">{description}</p>}
      {action}
    </div>
  );
}

/** A rectangle standing in for content that has not loaded. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("sl-skeleton h-4 w-full", className)} />;
}

export function SkeletonMetric() {
  return (
    <div className="px-4 py-5">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-3 h-6 w-28" />
      <Skeleton className="mt-2.5 h-2.5 w-32" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tables                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a table so wide content scrolls inside its own container.
 * Without this a dense table drags the whole page sideways on a phone.
 */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("-mx-px overflow-x-auto", className)}>{children}</div>;
}

export function Th({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-hairline px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  style,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <td
      style={style}
      className={cn(
        "whitespace-nowrap border-b border-hairline px-3 py-2.5 text-[12px] text-ink-soft",
        align === "right" ? "text-right font-mono tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * The StreetLevel primitive set.
 *
 * These are the only building blocks the pages use. Keeping them in one file
 * means the visual language is enforced by construction rather than by
 * convention: there is no second way to draw a metric card or a button.
 *
 * Two rules run through all of them. Structure is a one-pixel hairline, never
 * a shadow or a fill. And any value that could be unavailable is rendered
 * through the formatters, so it degrades to an em dash instead of to "NaN".
 */

import type { ComponentPropsWithoutRef, CSSProperties, KeyboardEvent, ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
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
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A keyboard key, for shortcut hints. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center border border-hairline-strong bg-surface px-1 font-mono text-[10px] font-medium leading-none text-muted",
        className,
      )}
    >
      {children}
    </kbd>
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
    <section {...rest} className={cn("border border-hairline bg-surface", className)}>
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
  title: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1 truncate">{eyebrow}</Eyebrow>}
        <h3 className="truncate text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      {actions && <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * The methodology line at the foot of a panel.
 *
 * Every panel that states how its figures were computed does it in the same
 * place and the same voice, so a reader learns where to look for the caveat.
 */
export function PanelNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted", className)}>
      {children}
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
 *
 * The large size steps down on a phone, where two metrics share a row and a
 * figure like `+$38,448.18` at full size would overrun its column.
 */
export function Metric({
  label,
  value,
  hint,
  delta,
  size = "md",
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  size?: "sm" | "md" | "lg";
  /** Colours the value itself by direction, for figures whose sign is the point. */
  tone?: number | null;
  className?: string;
}) {
  const valueClass =
    size === "lg"
      ? "text-[21px] leading-7 sm:text-[26px] sm:leading-8 xl:text-[28px]"
      : size === "sm"
        ? "text-[15px] leading-6 sm:text-base"
        : "text-[17px] leading-6 sm:text-xl sm:leading-7";
  const direction = tone === undefined ? null : signOf(tone);
  const toneClass = direction === "positive" ? "text-pos" : direction === "negative" ? "text-neg" : "text-ink";
  return (
    <div className={cn("min-w-0", className)}>
      <Eyebrow className="truncate">{label}</Eyebrow>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:mt-2">
        <span className={cn("font-mono font-medium tracking-tight tabular-nums", toneClass, valueClass)}>{value}</span>
        {delta !== undefined && <Delta value={delta} className="text-[13px]" />}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-4 text-muted sm:mt-1.5">{hint}</p>}
    </div>
  );
}

/**
 * A grid of metrics separated by hairlines.
 *
 * The rules are the one-pixel gaps of a grid laid over a hairline-coloured
 * background, rather than borders on each cell. Per-cell borders have to be
 * switched on and off by `nth-child` at every breakpoint, and the earlier
 * version got that wrong at four columns; gaps cannot. On a phone the grid
 * keeps two columns, which halves the scrolling a stack of eight figures cost.
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
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-4";
  return (
    <div className={cn("grid gap-px border border-hairline bg-hairline", columnClass, className)}>{children}</div>
  );
}

export function MetricCell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-w-0 bg-surface px-3.5 py-4 sm:px-4 sm:py-5", className)}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "xs" | "sm" | "md";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-surface hover:bg-ink-soft hover:border-ink-soft",
  secondary: "border-hairline-strong bg-surface text-ink hover:bg-sunken",
  ghost: "border-transparent text-muted hover:bg-sunken hover:text-ink",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 px-2.5 text-[10px]",
  sm: "h-8 gap-1.5 px-3 text-[10px]",
  md: "h-10 gap-2 px-4 text-[11px]",
};

/**
 * Class names for anything that looks like a button, including links.
 *
 * Exported as a function rather than only as a component so a Next `<Link>`
 * can wear it without a wrapper element.
 */
export function buttonClass({
  variant = "secondary",
  size = "sm",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap border font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANT[variant],
    BUTTON_SIZE[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: { variant?: ButtonVariant; size?: ButtonSize } & ComponentPropsWithoutRef<"button">) {
  return <button type={type} {...rest} className={buttonClass({ variant, size, className })} />;
}

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
 *
 * The row never wraps. On a narrow screen it scrolls sideways inside its own
 * box instead, because a nine-option control broken over two lines reads as
 * two controls.
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
  const padding = size === "sm" ? "h-7 px-1.5 text-[10px] sm:px-2" : "h-8 px-2.5 text-[11px]";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "scrollbar-none inline-flex max-w-full overflow-x-auto border border-hairline bg-surface",
        className,
      )}
    >
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
              "shrink-0 whitespace-nowrap border-r border-hairline font-semibold uppercase tracking-wider transition-colors last:border-r-0",
              padding,
              active ? "bg-ink text-surface" : "text-muted hover:bg-sunken hover:text-ink",
              option.disabled && "cursor-not-allowed text-faint/70 line-through decoration-hairline-strong hover:bg-transparent hover:text-faint/70",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Tabs that switch a region of the page.
 *
 * Unlike `Segmented`, which sets a parameter, these change what is shown, so
 * they carry the tab roles and arrow-key movement a screen reader expects.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: {
  tabs: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
}) {
  // Siblings are found through the event rather than a ref, so this file stays
  // free of hooks and can still be imported by server components.
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("scrollbar-none flex overflow-x-auto border-b border-hairline-strong", className)}
    >
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.value}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "-mb-px flex shrink-0 flex-col items-start border-b-2 pb-3 pt-1 text-left transition-colors [&:not(:first-child)]:ml-6 sm:[&:not(:first-child)]:ml-10",
              active ? "border-ink text-ink" : "border-transparent text-muted hover:border-hairline-strong hover:text-ink",
            )}
          >
            <span className="text-[12px] font-semibold uppercase tracking-wider">{tab.label}</span>
            {tab.hint && <span className="mt-0.5 hidden text-[11px] font-normal normal-case text-muted sm:block">{tab.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled native control, styled to match the hairline language. */
export function Field({
  label,
  children,
  className,
  labelClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 border border-hairline bg-surface px-2.5 transition-colors focus-within:border-ink hover:border-hairline-strong",
        className,
      )}
    >
      <span className={cn("shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted", labelClassName)}>
        {label}
      </span>
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
    <span className="relative flex min-w-0 flex-1 items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={cn(
          "w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-5 text-right font-mono text-[12px] font-semibold text-ink outline-none",
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface text-ink">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute right-0 h-3 w-3 text-muted" />
    </span>
  );
}

/**
 * A small on/off switch styled as a chip, used for chart overlays and options.
 *
 * The state is shown by a filled mark as well as by the fill of the chip, so
 * "on" never rests on a background shade alone. Chips that stand for a chart
 * series show the series colour instead of the mark.
 */
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
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap border px-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
        active
          ? "border-hairline-strong bg-sunken text-ink"
          : "border-hairline bg-surface text-muted hover:border-hairline-strong hover:text-ink",
        className,
      )}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className="h-0.5 w-3.5 shrink-0 transition-colors"
          style={{ background: active ? swatch : "var(--color-hairline-strong)" }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 shrink-0 border transition-colors",
            active ? "border-ink bg-ink" : "border-hairline-strong bg-transparent",
          )}
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
  neutral: "border-hairline-strong text-muted",
  positive: "border-pos/35 text-pos",
  negative: "border-neg/35 text-neg",
  warning: "border-warn/35 text-warn",
  accent: "border-accent/35 text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const CALLOUT_BAR: Record<Tone, string> = {
  neutral: "bg-hairline-strong",
  positive: "bg-pos",
  negative: "bg-neg",
  warning: "bg-warn",
  accent: "bg-accent",
};

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
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "negative" ? "alert" : undefined}
      className={cn("flex gap-3 border border-hairline bg-surface p-3", className)}
    >
      <span aria-hidden="true" className={cn("w-0.5 shrink-0", CALLOUT_BAR[tone])} />
      <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-muted">
        {title && <p className="mb-0.5 font-semibold text-ink">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * A notice whose detail is folded away.
 *
 * For conditions that apply to the whole page and do not change while it is
 * open, such as a stale snapshot. The headline stays visible on every visit;
 * the particulars are one click away rather than a permanent block of text
 * above the content.
 */
export function Notice({
  tone = "neutral",
  title,
  summary,
  children,
  className,
}: {
  tone?: Tone;
  title: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", CALLOUT_BAR[tone])} />
      <span className="min-w-0 flex-1 text-[12px] leading-relaxed">
        <span className="font-semibold text-ink">{title}</span>
        {summary && <span className="text-muted"> · {summary}</span>}
      </span>
    </>
  );

  if (!children) {
    return <div className={cn("flex items-start gap-2.5 border border-hairline bg-surface px-3 py-2", className)}>{body}</div>;
  }

  return (
    <details className={cn("group border border-hairline bg-surface", className)}>
      <summary className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-sunken">
        {body}
        <span className="mt-px inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <span className="group-open:hidden">Details</span>
          <span className="hidden group-open:inline">Hide</span>
          <ChevronRight aria-hidden="true" className="sl-disclosure-icon h-3 w-3 transition-transform" />
        </span>
      </summary>
      <div className="border-t border-hairline px-3 py-2.5 pl-7 text-[12px] leading-relaxed text-muted">{children}</div>
    </details>
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
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <p aria-hidden="true" className="font-mono text-lg text-faint">{EMPTY}</p>
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-[12px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A rectangle standing in for content that has not loaded. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("sl-skeleton h-4 w-full", className)} />;
}

export function SkeletonMetric() {
  return (
    <div className="bg-surface px-3.5 py-4 sm:px-4 sm:py-5">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-3 h-6 w-28" />
      <Skeleton className="mt-2.5 h-2.5 w-32 max-w-full" />
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

export type SortDirection = "asc" | "desc";

export function Th({
  children,
  align = "left",
  className,
  sort,
  onSort,
}: {
  children?: ReactNode;
  align?: "left" | "right";
  className?: string;
  /**
   * The column's current sort, or `null` when it is sortable but not active.
   * Leave undefined for a column that does not sort.
   */
  sort?: SortDirection | null;
  onSort?: () => void;
}) {
  const sortable = sort !== undefined && onSort !== undefined;
  const Icon = sort === "asc" ? ArrowUp : sort === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
      className={cn(
        "whitespace-nowrap border-b border-hairline bg-surface px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            "group/sort inline-flex items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-ink",
            align === "right" && "flex-row-reverse",
            sort && "text-ink",
          )}
        >
          {children}
          <Icon
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 transition-opacity",
              sort ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
            )}
          />
        </button>
      ) : (
        children
      )}
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

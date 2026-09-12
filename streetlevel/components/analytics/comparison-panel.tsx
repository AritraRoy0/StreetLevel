"use client";

/**
 * Benchmark comparison.
 *
 * The default benchmark ships with the page, so the section renders complete
 * on first paint. Choosing a different one fetches that series from the
 * analytics API, which is where the loading skeleton, the error state and the
 * abort-on-change handling earn their keep.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import {
  Callout,
  Delta,
  Eyebrow,
  Field,
  Metric,
  Panel,
  PanelHeader,
  Select,
  Skeleton,
} from "@/components/ui";
import {
  compareToBenchmark,
  formatDate,
  formatPercent,
  formatRatio,
} from "@/lib/analytics";
import type { Bar, Interval, RangeKey } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface BenchmarkOption {
  symbol: string;
  label: string;
  description: string;
}

export function ComparisonPanel({
  symbol,
  bars,
  defaultBenchmark,
  defaultBenchmarkBars,
  options,
  range,
  interval,
  className,
}: {
  symbol: string;
  bars: Bar[];
  defaultBenchmark: string;
  defaultBenchmarkBars: Bar[];
  options: BenchmarkOption[];
  range: RangeKey;
  interval: Interval;
  className?: string;
}) {
  const [selected, setSelected] = useState(defaultBenchmark);
  const [fetched, setFetched] = useState<Record<string, Bar[]>>({ [defaultBenchmark]: defaultBenchmarkBars });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (target: string) => {
      if (fetched[target]) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/analytics/${encodeURIComponent(target)}/history?range=MAX&interval=1d`,
          { signal: controller.signal },
        );
        const payload = await response.json();

        if (!response.ok) {
          // The API's own message is written for display, so it is shown as-is.
          const message = payload?.error?.message ?? `Request failed with status ${response.status}.`;
          const action = payload?.error?.action ? ` ${payload.error.action}` : "";
          throw new Error(`${message}${action}`);
        }

        const data = Array.isArray(payload?.data) ? (payload.data as Bar[]) : [];
        if (data.length === 0) throw new Error(`No price history came back for ${target}.`);

        setFetched((current) => ({ ...current, [target]: data }));
        setStatus("idle");
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the benchmark series.");
      }
    },
    [fetched],
  );

  /**
   * Selection drives the fetch directly rather than through an effect. The
   * default benchmark is already in `fetched`, so the section renders complete
   * with no request on mount, and there is no render pass that exists only to
   * discover that data is needed.
   */
  const handleSelect = useCallback(
    (target: string) => {
      setSelected(target);
      void load(target);
    },
    [load],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const selectedOption = options.find((option) => option.symbol === selected);

  /**
   * The comparison is computed over the asset's currently selected window.
   * Alignment then trims the benchmark to the days both actually traded, so a
   * benchmark with a different listing date or holiday calendar cannot skew it.
   */
  const comparison = useMemo(() => {
    const benchmarkBars = fetched[selected] ?? [];
    if (benchmarkBars.length === 0) return null;
    return compareToBenchmark(bars, benchmarkBars, {
      baseSymbol: symbol,
      benchmarkSymbol: selected,
      interval,
    });
  }, [bars, fetched, symbol, selected, interval]);

  const picker = (
    <Field label="Benchmark">
      <Select
        ariaLabel="Benchmark symbol"
        value={selected}
        onChange={handleSelect}
        options={options
          .filter((option) => option.symbol !== symbol)
          .map((option) => ({ value: option.symbol, label: option.label }))}
      />
    </Field>
  );

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title={`${symbol} against ${selectedOption?.label ?? selected}`}
        eyebrow={`Rebased to 100 · ${range} window`}
        actions={picker}
      />

      {status === "loading" && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-[240px] w-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index}>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2 h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="p-4">
          <Callout tone="negative" title="Could not load that benchmark">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setFetched((current) => {
                  const next = { ...current };
                  delete next[selected];
                  return next;
                });
                void load(selected);
              }}
              className="mt-2 border border-hairline-strong px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink hover:bg-sunken"
            >
              Try again
            </button>
          </Callout>
        </div>
      )}

      {status === "idle" && comparison && (
        <>
          <div className="p-4">
            <ComparisonChart
              points={comparison.normalized}
              baseLabel={symbol}
              benchmarkLabel={selected}
            />
          </div>

          <div className="grid grid-cols-2 gap-y-5 border-t border-hairline px-4 py-4 sm:grid-cols-4">
            <Metric
              label="Excess return"
              value={formatPercent(comparison.excessReturn, { signed: true })}
              hint={
                comparison.outperforming === null
                  ? "Not available"
                  : comparison.outperforming
                    ? "Outperforming"
                    : "Underperforming"
              }
              size="sm"
            />
            <Metric
              label="Correlation"
              value={formatRatio(comparison.correlation)}
              hint={`${comparison.alignedPoints} common sessions`}
              size="sm"
            />
            <Metric
              label="Beta"
              value={formatRatio(comparison.beta)}
              hint="Sensitivity to the benchmark"
              size="sm"
            />
            <Metric
              label="Tracking error"
              value={formatPercent(comparison.trackingError)}
              hint={`Info ratio ${formatRatio(comparison.informationRatio)}`}
              size="sm"
            />
          </div>

          <div className="grid gap-x-8 gap-y-2 border-t border-hairline px-4 py-3 text-[11px] sm:grid-cols-2">
            <ComparisonLine label={`${symbol} return`} value={comparison.baseReturn} />
            <ComparisonLine label={`${selected} return`} value={comparison.benchmarkReturn} />
            <ComparisonLine label={`${symbol} volatility`} value={comparison.baseVolatility} signed={false} />
            <ComparisonLine label={`${selected} volatility`} value={comparison.benchmarkVolatility} signed={false} />
            <ComparisonLine label={`${symbol} max drawdown`} value={comparison.baseMaxDrawdown} signed={false} />
            <ComparisonLine label={`${selected} max drawdown`} value={comparison.benchmarkMaxDrawdown} signed={false} />
          </div>

          <div className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
            <p>
              Aligned {formatDate(comparison.windowStart)} to {formatDate(comparison.windowEnd)}.
            </p>
            {comparison.warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-faint">
                {comparison.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {status === "idle" && !comparison && (
        <p className="px-4 py-8 text-center text-[12px] text-muted">Select a benchmark to compare against.</p>
      )}
    </Panel>
  );
}

function ComparisonLine({
  label,
  value,
  signed = true,
}: {
  label: string;
  value: number | null;
  signed?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5 last:border-b-0">
      <Eyebrow className="normal-case tracking-normal text-muted">{label}</Eyebrow>
      {signed ? (
        <Delta value={value} className="text-[12px]" />
      ) : (
        <span className="font-mono text-[12px] tabular-nums text-ink-soft">{formatPercent(value)}</span>
      )}
    </div>
  );
}

/**
 * The hardened entry point: validation, bounds, determinism and memoization.
 *
 * Everything below this file is pure and unbounded. This is where a run is
 * checked for sanity, capped so it cannot lock the page, and cached by a hash
 * of the inputs that produced it.
 *
 * Determinism is a design property rather than a feature here: nothing in the
 * engine reads a clock, a random source or ambient state, so the same
 * specification over the same bars always yields the same result. That is what
 * makes the cache key sound.
 */

import { isNum } from "../analytics/math.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { runBacktest } from "./statistics.ts";
import { RULE_DEFINITIONS, paramOf } from "./signals.ts";
import type { RuleKind, StrategySpec } from "./types.ts";
import { DEFAULT_STRATEGY } from "./types.ts";

/** Upper bound on bars in a single run, so an enormous window cannot stall the UI. */
export const MAX_BARS = 20_000;

/** Runs held in the memo before the oldest is dropped. */
const MEMO_CAPACITY = 60;

export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Clamps a specification into a runnable one and reports what it changed.
 *
 * Invalid input is corrected rather than rejected, because these values arrive
 * from URL parameters that anyone can edit. A malformed link should open a
 * working page with a note, not an error screen.
 */
export function sanitizeSpec(input: Partial<StrategySpec> | null | undefined): {
  spec: StrategySpec;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const base = input ?? {};

  const rule: RuleKind = (base.rule && RULE_DEFINITIONS[base.rule] ? base.rule : DEFAULT_STRATEGY.rule) as RuleKind;
  if (base.rule && !RULE_DEFINITIONS[base.rule]) {
    issues.push({ field: "rule", message: `Unknown rule "${base.rule}"; fell back to ${DEFAULT_STRATEGY.rule}.` });
  }

  // Parameters are clamped to each rule's declared bounds.
  const params: Record<string, number> = {};
  for (const definition of RULE_DEFINITIONS[rule].params) {
    const raw = base.params?.[definition.key];
    if (!isNum(raw)) {
      params[definition.key] = definition.default;
      continue;
    }
    const clamped = Math.min(definition.max, Math.max(definition.min, raw));
    if (clamped !== raw) {
      issues.push({
        field: `params.${definition.key}`,
        message: `${definition.label} was clamped to ${clamped}, the nearest allowed value.`,
      });
    }
    params[definition.key] = clamped;
  }

  const initialCapital = isNum(base.initialCapital) && base.initialCapital > 0 ? base.initialCapital : DEFAULT_STRATEGY.initialCapital;
  if (base.initialCapital !== undefined && initialCapital !== base.initialCapital) {
    issues.push({ field: "initialCapital", message: "Starting capital must be positive; the default was used." });
  }

  const clampFraction = (value: unknown, fallback: number, field: string, max = 1): number => {
    if (!isNum(value)) return fallback;
    if (value < 0 || value > max) {
      issues.push({ field, message: `Value must sit between 0 and ${max}; it was clamped.` });
      return Math.min(max, Math.max(0, value));
    }
    return value;
  };

  const spec: StrategySpec = {
    rule,
    params,
    sizing: {
      kind: base.sizing?.kind ?? DEFAULT_STRATEGY.sizing.kind,
      value: isNum(base.sizing?.value) ? Math.max(0, base.sizing!.value) : DEFAULT_STRATEGY.sizing.value,
      wholeShares: base.sizing?.wholeShares ?? DEFAULT_STRATEGY.sizing.wholeShares,
      maxLeverage: clampFraction(base.sizing?.maxLeverage, DEFAULT_STRATEGY.sizing.maxLeverage, "sizing.maxLeverage", 1),
    },
    costs: {
      commission: isNum(base.costs?.commission) ? Math.max(0, base.costs!.commission) : DEFAULT_STRATEGY.costs.commission,
      commissionKind: base.costs?.commissionKind ?? DEFAULT_STRATEGY.costs.commissionKind,
      slippageBps: isNum(base.costs?.slippageBps) ? Math.min(1000, Math.max(0, base.costs!.slippageBps)) : DEFAULT_STRATEGY.costs.slippageBps,
      spreadBps: isNum(base.costs?.spreadBps) ? Math.min(1000, Math.max(0, base.costs!.spreadBps)) : DEFAULT_STRATEGY.costs.spreadBps,
    },
    exits: {
      stopLossPct: clampFraction(base.exits?.stopLossPct, DEFAULT_STRATEGY.exits.stopLossPct, "exits.stopLossPct"),
      takeProfitPct: isNum(base.exits?.takeProfitPct) ? Math.max(0, Math.min(10, base.exits!.takeProfitPct)) : DEFAULT_STRATEGY.exits.takeProfitPct,
      trailingStopPct: clampFraction(base.exits?.trailingStopPct, DEFAULT_STRATEGY.exits.trailingStopPct, "exits.trailingStopPct"),
      maxHoldBars: isNum(base.exits?.maxHoldBars) ? Math.max(0, Math.floor(base.exits!.maxHoldBars)) : DEFAULT_STRATEGY.exits.maxHoldBars,
    },
    timing: base.timing === "next_close" ? "next_close" : "next_open",
    conflict: base.conflict ?? DEFAULT_STRATEGY.conflict,
    rebalance: base.rebalance ?? DEFAULT_STRATEGY.rebalance,
    initialCapital,
  };

  // Cross-field checks the per-field clamps cannot see.
  if (spec.rule === "sma_cross" || spec.rule === "ema_cross" || spec.rule === "macd_cross") {
    if (paramOf(spec, "fast") >= paramOf(spec, "slow")) {
      issues.push({ field: "params", message: "The fast period must be shorter than the slow one; the rule will not trade." });
    }
  }
  if (spec.rule === "rsi_threshold" && paramOf(spec, "buyBelow") >= paramOf(spec, "sellAbove")) {
    issues.push({ field: "params", message: "The buy threshold must sit below the sell threshold; the rule will not trade." });
  }
  if (spec.exits.stopLossPct > 0 && spec.exits.takeProfitPct > 0 && spec.exits.takeProfitPct <= spec.exits.stopLossPct) {
    issues.push({
      field: "exits",
      message: "The target is no further away than the stop, so the trade cannot win on a symmetric move.",
    });
  }

  return { spec, issues };
}

/**
 * Serializes a value with object keys sorted at every level.
 *
 * `JSON.stringify(value, keys)` looks like it would do this, but its second
 * argument is a property *allowlist* that applies at every depth. Passing the
 * top-level keys therefore drops every nested key, so two specifications
 * differing only in their parameters serialized identically and collided in the
 * run cache, returning one strategy's result for another's request.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

/**
 * A stable, order-independent hash of a specification and a data window.
 *
 * Keys are sorted at every level before hashing, so two specifications that
 * differ only in property order share a cache entry while two that differ in
 * any value do not. The window is identified by its endpoints and length, which
 * is enough here: bars are immutable once validated, so the same three values
 * cannot describe two different series.
 */
export function runKey(bars: readonly Bar[], spec: StrategySpec, symbol: string): string {
  const canonical = canonicalize(spec);
  const window = bars.length === 0 ? "empty" : `${bars[0].timestamp}:${bars[bars.length - 1].timestamp}:${bars.length}`;

  // A short non-cryptographic digest is enough to key an in-process memo.
  let hash = 2166136261;
  const payload = `${symbol}|${window}|${canonical}`;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${symbol}:${bars.length}:${(hash >>> 0).toString(36)}`;
}

const memo = new Map<string, ReturnType<typeof runBacktest>>();

/** Clears the memo. Called when the underlying data changes. */
export function clearRunCache(): void {
  memo.clear();
}

export function runCacheSize(): number {
  return memo.size;
}

export interface GuardedRun {
  result: ReturnType<typeof runBacktest> | null;
  issues: ValidationIssue[];
  /** True when the result came from the memo rather than a fresh simulation. */
  cached: boolean;
  /** Fatal problems that stopped the run entirely. */
  errors: string[];
}

/**
 * Validates, bounds, runs and memoizes a backtest.
 *
 * The memo is keyed on the inputs, never on elapsed time. A timed expiry would
 * be wrong in both directions here: it would recompute an identical answer
 * while the data is unchanged, and it would keep serving a stale one for the
 * length of its window after the data moved. `clearRunCache` is the only
 * invalidation, and the data layer owns when to call it.
 */
export function guardedRun(
  bars: readonly Bar[],
  input: Partial<StrategySpec>,
  options: { symbol?: string; riskFreeRate?: number } = {},
): GuardedRun {
  const symbol = options.symbol ?? "ASSET";
  const { spec, issues } = sanitizeSpec(input);
  const errors: string[] = [];

  if (bars.length === 0) {
    return { result: null, issues, cached: false, errors: ["No price history in the selected window."] };
  }
  if (bars.length > MAX_BARS) {
    errors.push(`The window holds ${bars.length} bars, above the ${MAX_BARS} this engine will simulate at once.`);
    return { result: null, issues, cached: false, errors };
  }

  const key = runKey(bars, spec, symbol);
  const hit = memo.get(key);
  if (hit) {
    // Refresh recency so the memo evicts least-recently-used.
    memo.delete(key);
    memo.set(key, hit);
    return { result: hit, issues, cached: true, errors };
  }

  let result: ReturnType<typeof runBacktest>;
  try {
    result = runBacktest(bars, spec, { symbol, riskFreeRate: options.riskFreeRate });
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "The simulation failed.");
    return { result: null, issues, cached: false, errors };
  }

  // Last line of defence: nothing non-finite may reach the UI.
  const suspect = ([
    ["total return", result.totalReturn],
    ["CAGR", result.cagr],
    ["volatility", result.volatility],
    ["max drawdown", result.maxDrawdown],
  ] as Array<[string, Maybe]>).filter(([, value]) => value !== null && !Number.isFinite(value));
  if (suspect.length > 0) {
    errors.push(`The simulation produced a non-finite ${suspect.map(([label]) => label).join(", ")}.`);
    return { result: null, issues, cached: false, errors };
  }
  if (result.equity.some((point) => !Number.isFinite(point.equity))) {
    errors.push("The equity curve contains a non-finite value; the run was discarded.");
    return { result: null, issues, cached: false, errors };
  }

  memo.set(key, result);
  while (memo.size > MEMO_CAPACITY) {
    const oldest = memo.keys().next();
    if (oldest.done) break;
    memo.delete(oldest.value);
  }

  return { result, issues, cached: false, errors };
}

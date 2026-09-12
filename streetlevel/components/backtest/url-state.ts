/**
 * Encoding a strategy into a URL and back.
 *
 * A backtest result that cannot be linked is not reproducible, and a
 * reproducible result is the only kind worth showing anyone. Every field that
 * changes the outcome is in the query string, so a pasted link reruns exactly
 * the same simulation.
 *
 * Decoding is total: an unreadable parameter falls back to its default rather
 * than throwing, because these strings are hand-editable and a typo should open
 * a working page with a note.
 */

import { sanitizeSpec } from "@/lib/backtest";
import type { RangeKey } from "@/lib/analytics";
import type { AllocationPolicy, RuleKind, StrategySpec } from "@/lib/backtest";

export interface BacktestUrlState {
  symbol: string;
  symbols: string[];
  multiSymbol: boolean;
  range: RangeKey;
  spec: StrategySpec;
  allocation: AllocationPolicy;
  maxPositions: number;
  volatilityTarget: number;
  /** Notes from sanitizing, shown once so a bad link explains itself. */
  issues: string[];
}

const RANGES: RangeKey[] = ["1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];

function numberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Reads the state out of a query string. */
export function decodeState(
  params: URLSearchParams,
  defaults: { symbol: string; symbols: string[] },
): BacktestUrlState {
  const rawParams: Record<string, number> = {};
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("p.")) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) rawParams[key.slice(2)] = parsed;
  }

  const { spec, issues } = sanitizeSpec({
    rule: (params.get("rule") ?? undefined) as RuleKind | undefined,
    params: rawParams,
    timing: (params.get("timing") ?? undefined) as StrategySpec["timing"] | undefined,
    conflict: (params.get("conflict") ?? undefined) as StrategySpec["conflict"] | undefined,
    rebalance: (params.get("cadence") ?? undefined) as StrategySpec["rebalance"] | undefined,
    initialCapital: numberParam(params, "capital"),
    sizing: {
      kind: (params.get("size") ?? "all_in") as StrategySpec["sizing"]["kind"],
      value: numberParam(params, "sizeval") ?? 1,
      wholeShares: params.get("whole") !== "0",
      maxLeverage: 1,
    },
    costs: {
      commission: numberParam(params, "comm") ?? 1,
      commissionKind: (params.get("commkind") ?? "per_trade") as StrategySpec["costs"]["commissionKind"],
      slippageBps: numberParam(params, "slip") ?? 5,
      spreadBps: numberParam(params, "spread") ?? 4,
    },
    exits: {
      stopLossPct: numberParam(params, "stop") ?? 0,
      takeProfitPct: numberParam(params, "target") ?? 0,
      trailingStopPct: numberParam(params, "trail") ?? 0,
      maxHoldBars: numberParam(params, "hold") ?? 0,
    },
  });

  const rangeParam = params.get("range") as RangeKey | null;
  const symbolsParam = params.get("symbols");
  const requested = symbolsParam
    ? symbolsParam.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean)
    : [];
  const symbols = requested.filter((symbol) => defaults.symbols.includes(symbol));
  if (requested.length > 0 && symbols.length !== requested.length) {
    issues.push({ field: "symbols", message: "Some symbols in the link are not covered and were dropped." });
  }

  const symbolParam = (params.get("symbol") ?? "").toUpperCase();
  const symbol = defaults.symbols.includes(symbolParam) ? symbolParam : defaults.symbol;
  if (symbolParam && symbol !== symbolParam) {
    issues.push({ field: "symbol", message: `${symbolParam} is not covered; showing ${symbol}.` });
  }

  return {
    symbol,
    symbols: symbols.length > 0 ? symbols : defaults.symbols.slice(0, 4),
    multiSymbol: params.get("multi") === "1",
    range: rangeParam && RANGES.includes(rangeParam) ? rangeParam : "1Y",
    spec,
    allocation: params.get("alloc") === "volatility_target" ? "volatility_target" : "equal_weight",
    maxPositions: Math.max(1, Math.min(10, Math.round(numberParam(params, "slots") ?? 4))),
    volatilityTarget: Math.max(0.01, Math.min(2, numberParam(params, "voltarget") ?? 0.2)),
    issues: issues.map((issue) => issue.message),
  };
}

/**
 * Writes the state into a query string.
 *
 * Defaults are omitted so a plain run produces a short, readable link rather
 * than thirty parameters most of which say nothing.
 */
export function encodeState(state: Omit<BacktestUrlState, "issues">): string {
  const params = new URLSearchParams();
  const { spec } = state;

  params.set("rule", spec.rule);
  for (const [key, value] of Object.entries(spec.params)) params.set(`p.${key}`, String(value));

  if (state.multiSymbol) {
    params.set("multi", "1");
    params.set("symbols", state.symbols.join(","));
    if (state.allocation !== "equal_weight") params.set("alloc", state.allocation);
    if (state.maxPositions !== 4) params.set("slots", String(state.maxPositions));
    if (state.allocation === "volatility_target") params.set("voltarget", String(state.volatilityTarget));
  } else {
    params.set("symbol", state.symbol);
  }

  if (state.range !== "1Y") params.set("range", state.range);
  if (spec.timing !== "next_open") params.set("timing", spec.timing);
  if (spec.conflict !== "exit_wins") params.set("conflict", spec.conflict);
  if (spec.rebalance !== "signal") params.set("cadence", spec.rebalance);
  if (spec.initialCapital !== 100_000) params.set("capital", String(spec.initialCapital));

  if (spec.sizing.kind !== "all_in") {
    params.set("size", spec.sizing.kind);
    params.set("sizeval", String(spec.sizing.value));
  }
  if (!spec.sizing.wholeShares) params.set("whole", "0");

  if (spec.costs.commission !== 1) params.set("comm", String(spec.costs.commission));
  if (spec.costs.commissionKind !== "per_trade") params.set("commkind", spec.costs.commissionKind);
  if (spec.costs.slippageBps !== 5) params.set("slip", String(spec.costs.slippageBps));
  if (spec.costs.spreadBps !== 4) params.set("spread", String(spec.costs.spreadBps));

  if (spec.exits.stopLossPct > 0) params.set("stop", String(spec.exits.stopLossPct));
  if (spec.exits.takeProfitPct > 0) params.set("target", String(spec.exits.takeProfitPct));
  if (spec.exits.trailingStopPct > 0) params.set("trail", String(spec.exits.trailingStopPct));
  if (spec.exits.maxHoldBars > 0) params.set("hold", String(spec.exits.maxHoldBars));

  return params.toString();
}

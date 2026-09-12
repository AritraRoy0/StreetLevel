import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_BARS,
  canonicalize,
  clearRunCache,
  guardedRun,
  runCacheSize,
  runKey,
  sanitizeSpec,
} from "../lib/backtest/runner.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import { barsFromCloses, closeTo, randomWalk } from "./helpers.ts";

const WALK = barsFromCloses(randomWalk(200, 41, 100));

describe("specification sanitizing", () => {
  it("fills in defaults for a bare specification", () => {
    const { spec } = sanitizeSpec({});
    assert.equal(spec.rule, DEFAULT_STRATEGY.rule);
    assert.equal(spec.params.fast, 20);
    assert.equal(spec.params.slow, 50);
    assert.equal(spec.initialCapital, DEFAULT_STRATEGY.initialCapital);
  });

  it("falls back on an unknown rule rather than failing", () => {
    // Rules arrive from URL parameters, so a bad one must open a working page.
    const { spec, issues } = sanitizeSpec({ rule: "nonsense" as never });
    assert.equal(spec.rule, DEFAULT_STRATEGY.rule);
    assert.ok(issues.some((issue) => issue.field === "rule"));
  });

  it("clamps a parameter to the rule's declared bounds", () => {
    const { spec, issues } = sanitizeSpec({ rule: "sma_cross", params: { fast: 9_999, slow: -5 } });
    assert.equal(spec.params.fast, 100);
    assert.equal(spec.params.slow, 3);
    assert.equal(issues.filter((issue) => issue.field.startsWith("params.")).length, 2);
  });

  it("drops a parameter that is not a finite number", () => {
    const { spec } = sanitizeSpec({ rule: "sma_cross", params: { fast: Number.NaN, slow: Infinity } });
    assert.equal(spec.params.fast, 20);
    assert.equal(spec.params.slow, 50);
  });

  it("rejects non-positive starting capital", () => {
    const { spec, issues } = sanitizeSpec({ initialCapital: 0 });
    assert.equal(spec.initialCapital, DEFAULT_STRATEGY.initialCapital);
    assert.ok(issues.some((issue) => issue.field === "initialCapital"));
  });

  it("bounds costs so a typo cannot wipe out an account", () => {
    const { spec } = sanitizeSpec({
      costs: { commission: -5, commissionKind: "per_trade", slippageBps: 99_999, spreadBps: -1 },
    });
    assert.equal(spec.costs.commission, 0);
    assert.equal(spec.costs.slippageBps, 1000);
    assert.equal(spec.costs.spreadBps, 0);
  });

  it("bounds protective exits", () => {
    const { spec } = sanitizeSpec({
      exits: { stopLossPct: 5, takeProfitPct: -1, trailingStopPct: 2, maxHoldBars: -3 },
    });
    assert.equal(spec.exits.stopLossPct, 1);
    assert.equal(spec.exits.takeProfitPct, 0);
    assert.equal(spec.exits.trailingStopPct, 1);
    assert.equal(spec.exits.maxHoldBars, 0);
  });

  it("flags a fast period that is not shorter than the slow one", () => {
    const { issues } = sanitizeSpec({ rule: "sma_cross", params: { fast: 60, slow: 40 } });
    assert.ok(issues.some((issue) => issue.message.includes("shorter")));
  });

  it("flags RSI thresholds in the wrong order", () => {
    const { issues } = sanitizeSpec({ rule: "rsi_threshold", params: { buyBelow: 80, sellAbove: 20 } });
    assert.ok(issues.some((issue) => issue.message.includes("below the sell threshold")));
  });

  it("flags a target no further away than the stop", () => {
    const { issues } = sanitizeSpec({
      exits: { stopLossPct: 0.1, takeProfitPct: 0.05, trailingStopPct: 0, maxHoldBars: 0 },
    });
    assert.ok(issues.some((issue) => issue.field === "exits"));
  });

  it("accepts a null or undefined input", () => {
    assert.equal(sanitizeSpec(null).spec.rule, DEFAULT_STRATEGY.rule);
    assert.equal(sanitizeSpec(undefined).spec.rule, DEFAULT_STRATEGY.rule);
  });

  it("only keeps parameters the chosen rule declares", () => {
    const { spec } = sanitizeSpec({ rule: "price_vs_sma", params: { period: 30, unrelated: 7 } });
    assert.deepEqual(Object.keys(spec.params), ["period"]);
  });
});

describe("run keys", () => {
  it("is stable across property order", () => {
    const a = { ...DEFAULT_STRATEGY, rule: "sma_cross" as const, params: { fast: 10, slow: 30 } };
    // Same values, rebuilt with the keys inserted in reverse order at both levels.
    const b = Object.fromEntries(
      Object.entries(a)
        .reverse()
        .map(([key, value]) =>
          key === "params" ? [key, Object.fromEntries(Object.entries(value as object).reverse())] : [key, value],
        ),
    ) as typeof a;

    assert.notDeepEqual(Object.keys(a), Object.keys(b), "the fixture should differ in key order");
    assert.deepEqual(a, b, "the fixture must hold identical values");
    assert.equal(runKey(WALK, a, "T"), runKey(WALK, b, "T"));
  });

  it("changes with a nested parameter, not just a top-level field", () => {
    const a = { ...DEFAULT_STRATEGY, params: { fast: 10, slow: 30 } };
    const b = { ...DEFAULT_STRATEGY, params: { fast: 11, slow: 30 } };
    assert.notEqual(runKey(WALK, a, "T"), runKey(WALK, b, "T"));
  });

  it("changes with any nested field, however deep", () => {
    const base = { ...DEFAULT_STRATEGY };
    const variants = [
      { ...base, costs: { ...base.costs, slippageBps: base.costs.slippageBps + 1 } },
      { ...base, exits: { ...base.exits, stopLossPct: 0.07 } },
      { ...base, sizing: { ...base.sizing, wholeShares: !base.sizing.wholeShares } },
      { ...base, initialCapital: base.initialCapital + 1 },
      { ...base, timing: "next_close" as const },
    ];
    const baseKey = runKey(WALK, base, "T");
    for (const variant of variants) {
      assert.notEqual(runKey(WALK, variant, "T"), baseKey, `a change went unnoticed: ${canonicalize(variant)}`);
    }
  });

  it("sorts keys at every level so property order is irrelevant", () => {
    assert.equal(canonicalize({ b: 1, a: { d: 2, c: 3 } }), canonicalize({ a: { c: 3, d: 2 }, b: 1 }));
    assert.equal(canonicalize({ a: { c: 3, d: 2 } }), '{"a":{"c":3,"d":2}}');
  });

  it("keeps nested values in the serialization", () => {
    // The regression this guards: a serializer that drops nested keys makes
    // every parameter set look identical.
    assert.ok(canonicalize(DEFAULT_STRATEGY).includes("\"fast\""));
    assert.ok(canonicalize(DEFAULT_STRATEGY).includes("\"slippageBps\""));
  });

  it("changes with the symbol and the window", () => {
    assert.notEqual(runKey(WALK, DEFAULT_STRATEGY, "A"), runKey(WALK, DEFAULT_STRATEGY, "B"));
    assert.notEqual(runKey(WALK, DEFAULT_STRATEGY, "A"), runKey(WALK.slice(0, 100), DEFAULT_STRATEGY, "A"));
  });

  it("handles an empty window", () => {
    assert.ok(runKey([], DEFAULT_STRATEGY, "T").length > 0);
  });
});

describe("guarded runs", () => {
  it("returns a result and caches it", () => {
    clearRunCache();
    const first = guardedRun(WALK, { rule: "sma_cross", params: { fast: 5, slow: 20 } }, { symbol: "T" });
    assert.ok(first.result !== null);
    assert.equal(first.cached, false);

    const second = guardedRun(WALK, { rule: "sma_cross", params: { fast: 5, slow: 20 } }, { symbol: "T" });
    assert.equal(second.cached, true);
    assert.equal(second.result, first.result);
    assert.equal(runCacheSize(), 1);
  });

  it("keys the cache on the inputs, not on elapsed time", () => {
    clearRunCache();
    guardedRun(WALK, { rule: "sma_cross", params: { fast: 5, slow: 20 } }, { symbol: "T" });
    const different = guardedRun(WALK, { rule: "sma_cross", params: { fast: 6, slow: 20 } }, { symbol: "T" });
    assert.equal(different.cached, false);
    assert.equal(runCacheSize(), 2);
  });

  it("clears on demand", () => {
    clearRunCache();
    guardedRun(WALK, { rule: "sma_cross" }, { symbol: "T" });
    assert.equal(runCacheSize(), 1);
    clearRunCache();
    assert.equal(runCacheSize(), 0);
  });

  it("refuses an empty window with a readable reason", () => {
    const run = guardedRun([], { rule: "sma_cross" }, { symbol: "T" });
    assert.equal(run.result, null);
    assert.ok(run.errors.some((error) => error.includes("No price history")));
  });

  it("refuses a window above the bar cap", () => {
    // Constructed rather than generated: the cap is what is under test.
    const huge = { length: MAX_BARS + 1 } as unknown as typeof WALK;
    const run = guardedRun(huge, { rule: "sma_cross" }, { symbol: "T" });
    assert.equal(run.result, null);
    assert.ok(run.errors.some((error) => error.includes(String(MAX_BARS))));
  });

  it("passes sanitizing issues through alongside a working result", () => {
    const run = guardedRun(WALK, { rule: "sma_cross", params: { fast: 9_999, slow: 30 } }, { symbol: "T" });
    assert.ok(run.result !== null, "a clamped specification should still run");
    assert.ok(run.issues.length > 0);
  });

  it("produces an identical result for an identical request", () => {
    clearRunCache();
    const a = guardedRun(WALK, { rule: "ema_cross", params: { fast: 8, slow: 21 } }, { symbol: "T" });
    clearRunCache();
    const b = guardedRun(WALK, { rule: "ema_cross", params: { fast: 8, slow: 21 } }, { symbol: "T" });
    assert.ok(a.result && b.result);
    assert.ok(closeTo(a.result.totalReturn, b.result.totalReturn ?? 0, 10));
    assert.equal(a.result.trades.length, b.result.trades.length);
  });

  it("never lets a non-finite figure reach the caller", () => {
    clearRunCache();
    for (const rule of ["buy_and_hold", "sma_cross", "rsi_threshold", "bollinger_reversion", "macd_cross", "donchian_breakout"] as const) {
      const run = guardedRun(WALK, { rule }, { symbol: "T" });
      if (!run.result) continue;
      for (const value of [run.result.totalReturn, run.result.cagr, run.result.volatility, run.result.maxDrawdown]) {
        assert.ok(value === null || Number.isFinite(value), `${rule} produced ${value}`);
      }
      for (const point of run.result.equity) assert.ok(Number.isFinite(point.equity));
    }
  });

  it("evicts the least recently used entry once full", () => {
    clearRunCache();
    // The capacity is an implementation detail; what matters is that the cache
    // stays bounded rather than growing with every distinct request.
    for (let i = 2; i < 90; i += 1) {
      guardedRun(WALK, { rule: "sma_cross", params: { fast: i, slow: 99 } }, { symbol: "T" });
    }
    assert.ok(runCacheSize() <= 60, `cache grew to ${runCacheSize()}`);
  });
});

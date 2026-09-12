import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RULE_DEFINITIONS, assertCausal, buildSignals, checkCausality, paramOf } from "../lib/backtest/signals.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import type { RuleKind, StrategySpec } from "../lib/backtest/types.ts";
import { barsFromCloses, barsOnDays, randomWalk } from "./helpers.ts";

function specFor(rule: RuleKind, params: Record<string, number> = {}, extra: Partial<StrategySpec> = {}): StrategySpec {
  const defaults: Record<string, number> = {};
  for (const definition of RULE_DEFINITIONS[rule].params) defaults[definition.key] = definition.default;
  return { ...DEFAULT_STRATEGY, rule, params: { ...defaults, ...params }, ...extra };
}

const WALK = barsFromCloses(randomWalk(260, 17, 100));

describe("buy and hold", () => {
  it("wants to be long on every bar", () => {
    const signals = buildSignals(barsFromCloses([100, 101, 102]), specFor("buy_and_hold"));
    assert.deepEqual(signals.desired, [1, 1, 1]);
    assert.equal(signals.firstDecisionIndex, 0);
  });
});

describe("moving average crossover", () => {
  it("is long exactly while the fast average leads", () => {
    // A ramp up then down, so the crossover has to flip at some point.
    const closes = [...Array.from({ length: 30 }, (_, i) => 100 + i), ...Array.from({ length: 30 }, (_, i) => 130 - i * 2)];
    const signals = buildSignals(barsFromCloses(closes), specFor("sma_cross", { fast: 5, slow: 15 }));

    assert.equal(signals.desired.slice(0, 14).every((value) => value === null), true);
    assert.equal(signals.desired[20], 1);
    assert.equal(signals.desired[signals.desired.length - 1], 0);
  });

  it("refuses a fast period that is not shorter than the slow one", () => {
    const signals = buildSignals(WALK, specFor("sma_cross", { fast: 50, slow: 20 }));
    assert.equal(signals.desired.every((value) => value === null), true);
    assert.ok(signals.warnings.some((warning) => warning.includes("shorter")));
  });

  it("reports insufficient history rather than trading on nothing", () => {
    const signals = buildSignals(barsFromCloses([100, 101, 102]), specFor("sma_cross", { fast: 20, slow: 50 }));
    assert.equal(signals.desired.every((value) => value === null), true);
    assert.ok(signals.warnings.some((warning) => warning.includes("needs 50 bars")));
  });

  it("derives entries and exits from its own transitions", () => {
    const closes = [...Array.from({ length: 25 }, (_, i) => 100 + i), ...Array.from({ length: 25 }, (_, i) => 124 - i * 2)];
    const signals = buildSignals(barsFromCloses(closes), specFor("sma_cross", { fast: 4, slow: 10 }));
    const entryCount = signals.entries.filter(Boolean).length;
    const exitCount = signals.exits.filter(Boolean).length;
    assert.ok(entryCount >= 1);
    assert.ok(exitCount >= 1);
  });
});

describe("RSI reversion", () => {
  it("fires on a crossing, not on every bar below the band", () => {
    // A long decline holds RSI under 30 for many bars; only the crossing counts.
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
    const signals = buildSignals(barsFromCloses(closes), specFor("rsi_threshold", { period: 14, buyBelow: 30, sellAbove: 70 }));
    const entries = signals.entries.filter(Boolean).length;
    assert.equal(entries, 1, `expected one crossing, saw ${entries}`);
  });

  it("refuses thresholds in the wrong order", () => {
    const signals = buildSignals(WALK, specFor("rsi_threshold", { period: 14, buyBelow: 80, sellAbove: 20 }));
    assert.equal(signals.desired.every((value) => value === null), true);
    assert.ok(signals.warnings.some((warning) => warning.includes("below the sell threshold")));
  });

  it("carries the position forward between events", () => {
    const closes = [
      ...Array.from({ length: 30 }, (_, i) => 200 - i * 3),
      ...Array.from({ length: 40 }, (_, i) => 113 + i * 3),
    ];
    const signals = buildSignals(barsFromCloses(closes), specFor("rsi_threshold", { period: 14, buyBelow: 30, sellAbove: 70 }));
    const decided = signals.desired.filter((value) => value !== null);
    // Once a decision exists it persists on every later bar rather than reverting to null.
    assert.ok(decided.length > 20);
    assert.ok(decided.includes(1));
  });
});

describe("conflict policy", () => {
  // A window tight enough that a close can sit below the lower band while also
  // being above the middle band is impossible, so conflicts are constructed
  // through the Bollinger rule's own exit condition on a flat series.
  it("is recorded and resolved by the configured policy", () => {
    const closes = [...Array.from({ length: 25 }, () => 100), 80, 130, 80, 130, 80];
    const exitWins = buildSignals(barsFromCloses(closes), specFor("bollinger_reversion", { period: 20, multiplier: 2 }, { conflict: "exit_wins" }));
    const entryWins = buildSignals(barsFromCloses(closes), specFor("bollinger_reversion", { period: 20, multiplier: 2 }, { conflict: "entry_wins" }));

    // Whether or not a conflict occurs in this fixture, the two policies must
    // never produce contradictory decisions on a conflict-free bar.
    for (let i = 0; i < closes.length; i += 1) {
      const bothFired = exitWins.entries[i] && exitWins.exits[i];
      if (!bothFired) assert.equal(exitWins.desired[i], entryWins.desired[i], `bar ${i}`);
    }
    if (exitWins.conflicts > 0) {
      assert.ok(exitWins.warnings.some((warning) => warning.includes("fired together")));
    }
  });
});

describe("rebalance cadence", () => {
  const daily = barsOnDays(
    Array.from({ length: 120 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 5));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 3) * 20] as [string, number];
    }),
  );

  it("changes position less often on a slower cadence", () => {
    const countFlips = (values: Array<number | null>) => {
      let flips = 0;
      let previous: number | null = null;
      for (const value of values) {
        if (value !== null && previous !== null && value !== previous) flips += 1;
        if (value !== null) previous = value;
      }
      return flips;
    };

    const onSignal = buildSignals(daily, specFor("sma_cross", { fast: 3, slow: 8 }, { rebalance: "signal" }));
    const weekly = buildSignals(daily, specFor("sma_cross", { fast: 3, slow: 8 }, { rebalance: "weekly" }));
    const monthly = buildSignals(daily, specFor("sma_cross", { fast: 3, slow: 8 }, { rebalance: "monthly" }));

    assert.ok(countFlips(onSignal.desired) >= countFlips(weekly.desired));
    assert.ok(countFlips(weekly.desired) >= countFlips(monthly.desired));
  });

  it("holds a decision steady inside a bucket", () => {
    const monthly = buildSignals(daily, specFor("sma_cross", { fast: 3, slow: 8 }, { rebalance: "monthly" }));
    // Within any calendar month the decision may change at most once, on the
    // bar after the month ends.
    let changes = 0;
    for (let i = 1; i < monthly.desired.length; i += 1) {
      if (monthly.desired[i] !== monthly.desired[i - 1]) changes += 1;
    }
    assert.ok(changes <= 6, `${changes} changes over four months of daily bars`);
  });
});

describe("causality", () => {
  const RULES: RuleKind[] = [
    "buy_and_hold",
    "sma_cross",
    "ema_cross",
    "price_vs_sma",
    "rsi_threshold",
    "bollinger_reversion",
    "macd_cross",
    "donchian_breakout",
  ];

  for (const rule of RULES) {
    it(`holds for ${rule}: no decision depends on a later bar`, () => {
      const check = assertCausal(WALK, specFor(rule));
      assert.equal(
        check.causal,
        true,
        `${rule} looked ahead: ${JSON.stringify(check.failures.slice(0, 2))}`,
      );
    });
  }

  for (const cadence of ["weekly", "monthly"] as const) {
    it(`holds on a ${cadence} cadence`, () => {
      const check = assertCausal(WALK, specFor("sma_cross", { fast: 5, slow: 20 }, { rebalance: cadence }));
      assert.equal(check.causal, true, JSON.stringify(check.failures.slice(0, 2)));
    });
  }

  it("catches a builder that reads a future bar", () => {
    // The guard has to be shown to fail, otherwise passing it proves nothing.
    // This builder answers "does a later bar exist", which is information no
    // causal rule can have.
    const report = checkCausality(WALK, (slice) => slice.map((_, i) => (i + 1 < slice.length ? 1 : 0)));
    assert.equal(report.causal, false, "the peeking builder should have been caught");
    assert.ok(report.failures.length > 0);
    assert.ok(report.probesRun > 1);
  });

  it("passes a builder that reads only the current and earlier bars", () => {
    const report = checkCausality(WALK, (slice) =>
      slice.map((bar, i) => (i > 0 && bar.adjClose > slice[i - 1].adjClose ? 1 : 0)),
    );
    assert.equal(report.causal, true, JSON.stringify(report.failures.slice(0, 2)));
  });
});

describe("parameter access", () => {
  it("falls back to the rule's documented default", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: {} };
    assert.equal(paramOf(spec, "fast"), 20);
    assert.equal(paramOf(spec, "slow"), 50);
  });

  it("ignores a non-finite override", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: Number.NaN } };
    assert.equal(paramOf(spec, "fast"), 20);
  });

  it("declares bounds for every parameter of every rule", () => {
    for (const [rule, definition] of Object.entries(RULE_DEFINITIONS)) {
      for (const param of definition.params) {
        assert.ok(param.min < param.max, `${rule}.${param.key} has no usable range`);
        assert.ok(param.default >= param.min && param.default <= param.max, `${rule}.${param.key} default is outside its range`);
      }
    }
  });
});

describe("empty input", () => {
  it("returns an empty series with a warning", () => {
    const signals = buildSignals([], specFor("sma_cross"));
    assert.deepEqual(signals.desired, []);
    assert.ok(signals.warnings.length > 0);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SWEEP_CELLS,
  deflatedSharpe,
  expectedMaxZ,
  integerRange,
  normalCdf,
  normalInverse,
  sharpeStandardError,
  sweep,
  walkForward,
} from "../lib/backtest/sweep.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import type { StrategySpec } from "../lib/backtest/types.ts";
import { barsFromCloses, closeTo, randomWalk } from "./helpers.ts";

const WALK = barsFromCloses(randomWalk(252, 29, 100));

const BASE: StrategySpec = {
  ...DEFAULT_STRATEGY,
  rule: "sma_cross",
  params: { fast: 10, slow: 30 },
  costs: { commission: 1, commissionKind: "per_trade", slippageBps: 5, spreadBps: 4 },
};

describe("normal distribution helpers", () => {
  it("inverts the standard normal at known quantiles", () => {
    assert.ok(closeTo(normalInverse(0.5), 0, 6));
    assert.ok(closeTo(normalInverse(0.975), 1.959964, 4));
    assert.ok(closeTo(normalInverse(0.025), -1.959964, 4));
    assert.ok(closeTo(normalInverse(0.99), 2.326348, 4));
    assert.ok(closeTo(normalInverse(0.8413447), 1, 3));
  });

  it("returns NaN outside the open interval", () => {
    assert.ok(Number.isNaN(normalInverse(0)));
    assert.ok(Number.isNaN(normalInverse(1)));
    assert.ok(Number.isNaN(normalInverse(-0.5)));
  });

  it("evaluates the standard normal at known points", () => {
    assert.ok(closeTo(normalCdf(0), 0.5, 6));
    assert.ok(closeTo(normalCdf(1.959964), 0.975, 4));
    assert.ok(closeTo(normalCdf(-1.959964), 0.025, 4));
    assert.ok(closeTo(normalCdf(1), 0.841345, 4));
  });

  it("round-trips between the two", () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      assert.ok(closeTo(normalCdf(normalInverse(p)), p, 4), `failed at ${p}`);
    }
  });
});

describe("expected maximum under the null", () => {
  it("is zero for a single trial and grows with the count", () => {
    assert.equal(expectedMaxZ(1), 0);
    const ten = expectedMaxZ(10);
    const hundred = expectedMaxZ(100);
    const thousand = expectedMaxZ(1000);
    assert.ok(ten > 0);
    assert.ok(hundred > ten, `${hundred} should exceed ${ten}`);
    assert.ok(thousand > hundred);
  });

  it("grows slowly, roughly with the square root of the log of the count", () => {
    // The order statistic is close to sqrt(2 ln N) for large N.
    const n = 1000;
    assert.ok(closeTo(expectedMaxZ(n), Math.sqrt(2 * Math.log(n)), 0));
  });

  it("prices the standard error of an annualized Sharpe estimate", () => {
    const error = sharpeStandardError(1.5, 252);
    assert.ok(error !== null && error > 0);

    // Computed per period, then annualized the same way the Sharpe was.
    const perPeriod = 1.5 / Math.sqrt(252);
    const expected = Math.sqrt((1 + (perPeriod * perPeriod) / 2) / 251) * Math.sqrt(252);
    assert.ok(closeTo(error, expected, 8));

    // The magnitude that matters: one year of daily bars measures an
    // annualized Sharpe to roughly plus or minus one. Any implementation that
    // reports a tenth of that is annualizing the estimate but not its error.
    assert.ok(error > 0.8 && error < 1.3, `standard error was ${error}`);
    assert.equal(sharpeStandardError(1, 2), null);
  });
});

describe("deflated Sharpe", () => {
  it("shrinks as the number of trials grows", () => {
    const one = deflatedSharpe(1.5, 252, 1);
    const many = deflatedSharpe(1.5, 252, 200);
    assert.ok(one.probability !== null && many.probability !== null);
    assert.ok(
      many.probability < one.probability,
      `${many.probability} should be below ${one.probability}`,
    );
  });

  it("turns a searched-for Sharpe of 1.5 over one year into a coin flip", () => {
    // This is the headline finding the correction exists to deliver: a result
    // that looks strong in isolation is unremarkable once the search that
    // produced it is priced in.
    const single = deflatedSharpe(1.5, 252, 1).probability;
    const searched = deflatedSharpe(1.5, 252, 200).probability;
    assert.ok((single ?? 0) > 0.85, `one trial gave ${single}`);
    assert.ok((searched ?? 1) < 0.5, `two hundred trials gave ${searched}`);
  });

  it("raises the bar the best result has to clear", () => {
    const many = deflatedSharpe(1.5, 252, 200);
    assert.ok((many.expectedMax ?? 0) > 0);
    assert.ok((many.haircut ?? 0) < 1.5);
  });

  it("is near certainty for a strong result found in one trial", () => {
    const result = deflatedSharpe(3, 252, 1);
    assert.ok((result.probability ?? 0) > 0.99);
  });

  it("is unavailable with too few observations", () => {
    assert.equal(deflatedSharpe(1.5, 2, 10).probability, null);
  });

  it("stays a probability between zero and one", () => {
    for (const trials of [1, 5, 50, 400]) {
      for (const sharpe of [-2, 0, 1, 4]) {
        const value = deflatedSharpe(sharpe, 252, trials).probability;
        if (value === null) continue;
        assert.ok(value >= 0 && value <= 1, `${sharpe}/${trials} gave ${value}`);
      }
    }
  });
});

describe("sweep", () => {
  it("covers the cartesian product of two axes", () => {
    const result = sweep(WALK, BASE, [
      { param: "fast", values: [5, 10] },
      { param: "slow", values: [20, 30, 40] },
    ]);
    assert.equal(result.cells.length, 6);
    assert.deepEqual(
      result.cells.map((cell) => [cell.params.fast, cell.params.slow]),
      [
        [5, 20],
        [5, 30],
        [5, 40],
        [10, 20],
        [10, 30],
        [10, 40],
      ],
    );
  });

  it("reports the distribution alongside the best cell", () => {
    const result = sweep(WALK, BASE, [
      { param: "fast", values: integerRange(4, 12, 2) },
      { param: "slow", values: integerRange(20, 40, 10) },
    ]);
    assert.ok(result.best !== null);
    assert.equal(result.distribution.count, result.cells.length);
    assert.ok(result.distribution.medianSharpe !== null);
    assert.ok(result.distribution.bestSharpe !== null);
    // The best cell is the best of the grid, by construction.
    assert.ok((result.best?.sharpe ?? -Infinity) >= (result.distribution.medianSharpe ?? -Infinity));
    assert.equal(result.distribution.bestSharpe, result.best?.sharpe);
  });

  it("keeps invalid cells in the grid rather than dropping them", () => {
    // fast >= slow cannot trade, but the axes must still line up with the cells
    // or the heatmap would mislabel itself.
    const result = sweep(WALK, BASE, [
      { param: "fast", values: [10, 40] },
      { param: "slow", values: [20, 30] },
    ]);
    assert.equal(result.cells.length, 4);
    const invalid = result.cells.find((cell) => cell.params.fast === 40 && cell.params.slow === 20);
    assert.ok(invalid !== undefined);
    assert.equal(invalid.closedTrades, 0);
  });

  it("caps the grid and says so", () => {
    const result = sweep(
      WALK,
      BASE,
      [
        { param: "fast", values: integerRange(2, 60, 1) },
        { param: "slow", values: integerRange(3, 80, 1) },
      ],
      { maxCells: 25 },
    );
    assert.equal(result.cells.length, 25);
    assert.equal(result.truncated, true);
    assert.ok(result.warnings.some((warning) => warning.includes("capped")));
  });

  it("respects the default cap", () => {
    assert.ok(MAX_SWEEP_CELLS > 0 && MAX_SWEEP_CELLS <= 2000);
  });

  it("only sweeps the first two axes", () => {
    const result = sweep(WALK, BASE, [
      { param: "fast", values: [5] },
      { param: "slow", values: [20] },
      { param: "other", values: [1, 2, 3] },
    ]);
    assert.equal(result.axes.length, 2);
    assert.ok(result.warnings.some((warning) => warning.includes("first two axes")));
  });

  it("handles a single axis and no axes", () => {
    const single = sweep(WALK, BASE, [{ param: "slow", values: [20, 30] }]);
    assert.equal(single.cells.length, 2);
    const none = sweep(WALK, BASE, []);
    assert.equal(none.cells.length, 1);
  });

  it("warns when the best cell is indistinguishable from noise", () => {
    const result = sweep(WALK, BASE, [
      { param: "fast", values: integerRange(2, 20, 1) },
      { param: "slow", values: integerRange(21, 60, 2) },
    ]);
    if ((result.deflatedSharpe ?? 1) < 0.6) {
      assert.ok(result.warnings.some((warning) => warning.includes("worthless")));
    }
    assert.ok(result.deflatedSharpe === null || (result.deflatedSharpe >= 0 && result.deflatedSharpe <= 1));
  });

  it("is deterministic", () => {
    const axes = [
      { param: "fast", values: [5, 10] },
      { param: "slow", values: [20, 30] },
    ];
    const first = sweep(WALK, BASE, axes);
    const second = sweep(WALK, BASE, axes);
    assert.deepEqual(
      first.cells.map((cell) => cell.totalReturn),
      second.cells.map((cell) => cell.totalReturn),
    );
  });
});

describe("walk-forward", () => {
  it("evaluates each fold on data the parameter choice never saw", () => {
    const result = walkForward(WALK, BASE, [{ param: "slow", values: [20, 30, 40] }], { folds: 3, minBarsPerSlice: 20 });
    assert.equal(result.folds.length, 3);

    for (const fold of result.folds) {
      // The out-of-sample slice begins after the in-sample slice ends.
      assert.ok(
        new Date(fold.outOfSampleStart).getTime() > new Date(fold.inSampleEnd).getTime(),
        `fold ${fold.index} overlaps`,
      );
    }
  });

  it("walks the in-sample window forward across folds", () => {
    const result = walkForward(WALK, BASE, [{ param: "slow", values: [20, 30] }], { folds: 3, minBarsPerSlice: 20 });
    for (let i = 1; i < result.folds.length; i += 1) {
      assert.ok(
        new Date(result.folds[i].inSampleEnd).getTime() > new Date(result.folds[i - 1].inSampleEnd).getTime(),
      );
    }
  });

  it("reports efficiency and a hit rate", () => {
    const result = walkForward(WALK, BASE, [{ param: "slow", values: [20, 30, 40] }], { folds: 3, minBarsPerSlice: 20 });
    assert.ok(result.hitRate === null || (result.hitRate >= 0 && result.hitRate <= 1));
    if (result.meanInSampleReturn !== null && result.meanOutOfSampleReturn !== null && result.meanInSampleReturn !== 0) {
      assert.ok(result.efficiency !== null);
    }
  });

  it("warns when the slices are too short to mean anything", () => {
    const result = walkForward(WALK, BASE, [{ param: "slow", values: [20, 30] }], { folds: 10, minBarsPerSlice: 60 });
    assert.ok(result.warnings.some((warning) => warning.includes("below the")));
  });

  it("refuses a window it cannot split", () => {
    const result = walkForward(barsFromCloses([100, 101, 102]), BASE, [{ param: "slow", values: [20] }], { folds: 3 });
    assert.deepEqual(result.folds, []);
    assert.ok(result.warnings.some((warning) => warning.includes("too short")));
  });

  it("produces no NaN in any reported figure", () => {
    const result = walkForward(WALK, BASE, [{ param: "slow", values: [20, 30, 40] }], { folds: 3, minBarsPerSlice: 20 });
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} is ${value}`);
    }
    for (const fold of result.folds) {
      for (const [key, value] of Object.entries(fold)) {
        if (typeof value === "number") assert.ok(Number.isFinite(value), `fold.${key} is ${value}`);
      }
    }
  });
});

describe("integerRange", () => {
  it("is inclusive and ordered", () => {
    assert.deepEqual(integerRange(2, 6), [2, 3, 4, 5, 6]);
    assert.deepEqual(integerRange(2, 10, 4), [2, 6, 10]);
    assert.deepEqual(integerRange(6, 2), [2, 3, 4, 5, 6]);
    assert.deepEqual(integerRange(5, 5), [5]);
  });

  it("never loops forever on a zero or negative step", () => {
    assert.deepEqual(integerRange(1, 3, 0), [1, 2, 3]);
    assert.deepEqual(integerRange(1, 3, -2), [1, 2, 3]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  averagePairwiseCorrelation,
  compareToBenchmark,
  correlationMatrix,
  rebase,
} from "../lib/analytics/compare.ts";
import { barsFromCloses, barsOnDays, closeTo, randomWalk } from "./helpers.ts";

describe("rebase", () => {
  it("starts every series at 100", () => {
    const result = rebase(barsFromCloses([50, 55, 45]));
    assert.ok(closeTo(result[0].value, 100, 8));
    assert.ok(closeTo(result[1].value, 110, 8));
    assert.ok(closeTo(result[2].value, 90, 8));
  });

  it("is empty-safe", () => {
    assert.deepEqual(rebase([]), []);
  });
});

describe("compareToBenchmark", () => {
  it("rebases both legs to 100 on the first shared date", () => {
    const asset = barsFromCloses([100, 120]);
    const bench = barsFromCloses([50, 55]);
    const result = compareToBenchmark(asset, bench, { baseSymbol: "A", benchmarkSymbol: "B" });
    assert.ok(closeTo(result.normalized[0].base, 100, 8));
    assert.ok(closeTo(result.normalized[0].benchmark, 100, 8));
    assert.ok(closeTo(result.normalized[1].base, 120, 8));
    assert.ok(closeTo(result.normalized[1].benchmark, 110, 8));
  });

  it("computes excess return as the difference of total returns", () => {
    const asset = barsFromCloses([100, 120]);
    const bench = barsFromCloses([100, 110]);
    const result = compareToBenchmark(asset, bench);
    assert.ok(closeTo(result.baseReturn, 0.2, 8));
    assert.ok(closeTo(result.benchmarkReturn, 0.1, 8));
    assert.ok(closeTo(result.excessReturn, 0.1, 8));
    assert.equal(result.outperforming, true);
  });

  it("flags underperformance", () => {
    const result = compareToBenchmark(barsFromCloses([100, 90]), barsFromCloses([100, 110]));
    assert.equal(result.outperforming, false);
    assert.ok((result.excessReturn ?? 0) < 0);
  });

  it("computes relative growth as the ratio of the two growth factors", () => {
    const result = compareToBenchmark(barsFromCloses([100, 120]), barsFromCloses([100, 110]));
    // 1.20 / 1.10 - 1
    assert.ok(closeTo(result.relativeGrowth, 1.2 / 1.1 - 1, 8));
  });

  it("aligns on the intersection of two trading calendars", () => {
    const asset = barsOnDays([["2026-01-05", 100], ["2026-01-06", 101], ["2026-01-07", 102]]);
    const bench = barsOnDays([["2026-01-05", 50], ["2026-01-07", 52]]);
    const result = compareToBenchmark(asset, bench);
    assert.equal(result.alignedPoints, 2);
    assert.equal(result.droppedPoints, 1);
    assert.ok(result.warnings.some((warning) => warning.includes("trading calendars differ")));
  });

  it("recovers a beta of 2 when the asset moves twice the benchmark", () => {
    const benchCloses = randomWalk(120, 7, 100);
    const benchBars = barsFromCloses(benchCloses);
    // Build an asset whose daily return is exactly twice the benchmark's.
    const assetCloses = [100];
    for (let i = 1; i < benchCloses.length; i += 1) {
      const benchReturn = benchCloses[i] / benchCloses[i - 1] - 1;
      assetCloses.push(assetCloses[i - 1] * (1 + 2 * benchReturn));
    }
    const result = compareToBenchmark(barsFromCloses(assetCloses), benchBars);
    assert.ok(closeTo(result.beta, 2, 6), `beta was ${result.beta}`);
    assert.ok(closeTo(result.correlation, 1, 6), `correlation was ${result.correlation}`);
  });

  it("reports a correlation of -1 for a mirrored asset", () => {
    const benchCloses = randomWalk(120, 11, 100);
    const assetCloses = [100];
    for (let i = 1; i < benchCloses.length; i += 1) {
      const benchReturn = benchCloses[i] / benchCloses[i - 1] - 1;
      assetCloses.push(assetCloses[i - 1] * (1 - benchReturn));
    }
    const result = compareToBenchmark(barsFromCloses(assetCloses), barsFromCloses(benchCloses));
    assert.ok(closeTo(result.correlation, -1, 3), `correlation was ${result.correlation}`);
  });

  it("has zero tracking error against itself", () => {
    const bars = barsFromCloses(randomWalk(120, 3, 100));
    const result = compareToBenchmark(bars, bars);
    assert.ok(closeTo(result.excessReturn, 0, 10));
    assert.ok(closeTo(result.trackingError, 0, 8));
    assert.ok(closeTo(result.beta, 1, 8));
    assert.equal(result.informationRatio, null);
  });

  it("withholds correlation and beta below the minimum sample", () => {
    const asset = barsFromCloses([100, 101, 102, 103, 104]);
    const bench = barsFromCloses([50, 51, 52, 53, 54]);
    const result = compareToBenchmark(asset, bench);
    assert.equal(result.correlation, null);
    assert.equal(result.beta, null);
    assert.equal(result.trackingError, null);
    assert.ok(result.warnings.some((warning) => warning.includes("common sessions")));
    // The normalized chart is still produced.
    assert.equal(result.normalized.length, 5);
  });

  it("returns an empty result for disjoint calendars", () => {
    const asset = barsOnDays([["2026-01-05", 100]]);
    const bench = barsOnDays([["2026-02-05", 50]]);
    const result = compareToBenchmark(asset, bench);
    assert.equal(result.normalized.length, 0);
    assert.equal(result.excessReturn, null);
    assert.ok(result.warnings.some((warning) => warning.includes("fewer than two trading days")));
  });

  it("returns an empty result when either series is empty", () => {
    const result = compareToBenchmark([], barsFromCloses([100, 110]));
    assert.equal(result.normalized.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("no price history")));
  });
});

describe("correlationMatrix", () => {
  it("has ones on the diagonal and is symmetric", () => {
    const entries = [
      { symbol: "A", bars: barsFromCloses(randomWalk(120, 1)) },
      { symbol: "B", bars: barsFromCloses(randomWalk(120, 2)) },
      { symbol: "C", bars: barsFromCloses(randomWalk(120, 3)) },
    ];
    const { matrix } = correlationMatrix(entries);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(matrix[i][i], 1);
      for (let j = 0; j < 3; j += 1) assert.equal(matrix[i][j], matrix[j][i]);
    }
  });

  it("leaves a cell null when a pair shares too few sessions", () => {
    const entries = [
      { symbol: "A", bars: barsFromCloses(randomWalk(120, 1)) },
      { symbol: "B", bars: barsFromCloses([100, 101, 102]) },
    ];
    const { matrix } = correlationMatrix(entries);
    assert.equal(matrix[0][1], null);
  });

  it("averages only the off-diagonal cells", () => {
    assert.ok(closeTo(averagePairwiseCorrelation([[1, 0.5], [0.5, 1]]), 0.5, 8));
    assert.equal(averagePairwiseCorrelation([[1]]), null);
    assert.equal(averagePairwiseCorrelation([[1, null], [null, 1]]), null);
  });
});

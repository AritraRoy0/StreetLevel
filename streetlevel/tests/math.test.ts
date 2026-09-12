import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clamp,
  correlation,
  covariance,
  finite,
  isNum,
  logReturn,
  maxOf,
  mean,
  median,
  minOf,
  round,
  safeDiv,
  simpleReturn,
  stdDev,
  stdDevPopulation,
  sum,
  toNum,
  variance,
} from "../lib/analytics/math.ts";
import { closeTo } from "./helpers.ts";

describe("numeric guards", () => {
  it("rejects NaN, Infinity and non-numbers", () => {
    assert.equal(isNum(Number.NaN), false);
    assert.equal(isNum(Infinity), false);
    assert.equal(isNum(-Infinity), false);
    assert.equal(isNum("5"), false);
    assert.equal(isNum(null), false);
    assert.equal(isNum(5), true);
    assert.equal(isNum(-0), true);
  });

  it("coerces numeric strings but not junk", () => {
    assert.equal(toNum("12.5"), 12.5);
    assert.equal(toNum("  7 "), 7);
    assert.equal(toNum(""), null);
    assert.equal(toNum("abc"), null);
    assert.equal(toNum(null), null);
    assert.equal(toNum(Number.NaN), null);
  });

  it("converts non-finite results to null", () => {
    assert.equal(finite(Number.NaN), null);
    assert.equal(finite(Infinity), null);
    assert.equal(finite(3), 3);
  });
});

describe("safeDiv", () => {
  it("returns null instead of Infinity for a zero denominator", () => {
    assert.equal(safeDiv(5, 0), null);
    assert.equal(safeDiv(0, 0), null);
    assert.equal(safeDiv(-5, 0), null);
  });

  it("divides normally otherwise", () => {
    assert.equal(safeDiv(10, 4), 2.5);
    assert.equal(safeDiv(-9, 3), -3);
  });

  it("propagates null operands", () => {
    assert.equal(safeDiv(null, 4), null);
    assert.equal(safeDiv(4, null), null);
  });
});

describe("round", () => {
  it("rounds half away from zero, symmetrically for negatives", () => {
    assert.equal(round(0.5, 0), 1);
    assert.equal(round(-0.5, 0), -1);
    assert.equal(round(1.5, 0), 2);
    assert.equal(round(-1.5, 0), -2);
    assert.equal(round(2.5, 0), 3);
  });

  it("handles binary representation error", () => {
    assert.equal(round(1.005, 2), 1.01);
    assert.equal(round(1.045, 2), 1.05);
    assert.equal(round(8.575, 2), 8.58);
  });

  it("normalizes negative zero so no cell renders -0.00", () => {
    assert.equal(Object.is(round(-0.0001, 2), -0), false);
    assert.equal(round(-0.0001, 2), 0);
  });

  it("returns null for non-finite input", () => {
    assert.equal(round(Number.NaN), null);
    assert.equal(round(Infinity), null);
    assert.equal(round(null), null);
  });
});

describe("aggregates", () => {
  it("returns null for empty inputs rather than 0", () => {
    assert.equal(mean([]), null);
    assert.equal(median([]), null);
    assert.equal(stdDev([]), null);
    assert.equal(stdDevPopulation([]), null);
    assert.equal(maxOf([]), null);
    assert.equal(minOf([]), null);
    assert.equal(sum([]), 0);
  });

  it("computes mean and median", () => {
    assert.equal(mean([1, 2, 3, 4]), 2.5);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([3, 1, 2]), 2);
  });

  it("skips non-finite entries", () => {
    assert.equal(mean([1, Number.NaN, 3]), 2);
    assert.equal(sum([1, Infinity, 2]), 3);
  });

  it("uses Bessel's correction for the sample deviation", () => {
    // Population variance of [2,4,4,4,5,5,7,9] is 4, sample variance is 32/7.
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    assert.equal(stdDevPopulation(values), 2);
    assert.ok(closeTo(variance(values), 32 / 7, 10));
    assert.ok(closeTo(stdDev(values), Math.sqrt(32 / 7), 10));
  });

  it("needs two observations for a sample deviation", () => {
    assert.equal(stdDev([5]), null);
    assert.equal(stdDevPopulation([5]), 0);
  });
});

describe("correlation and covariance", () => {
  it("is 1 for a perfectly positive relationship", () => {
    assert.ok(closeTo(correlation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1, 10));
  });

  it("is -1 for a perfectly negative relationship", () => {
    assert.ok(closeTo(correlation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]), -1, 10));
  });

  it("is null when either series is constant", () => {
    assert.equal(correlation([1, 2, 3], [5, 5, 5]), null);
  });

  it("is null for mismatched lengths", () => {
    assert.equal(correlation([1, 2, 3], [1, 2]), null);
    assert.equal(covariance([1, 2, 3], [1, 2]), null);
  });

  it("stays inside [-1, 1]", () => {
    const value = correlation([1, 1.0000001, 1.0000002], [2, 2.0000002, 2.0000004]);
    assert.ok(value === null || (value >= -1 && value <= 1));
  });
});

describe("returns", () => {
  it("computes simple returns as fractions", () => {
    assert.ok(closeTo(simpleReturn(100, 105), 0.05, 10));
    assert.ok(closeTo(simpleReturn(100, 95), -0.05, 10));
  });

  it("refuses a non-positive base price", () => {
    assert.equal(simpleReturn(0, 50), null);
    assert.equal(simpleReturn(-10, 50), null);
  });

  it("computes log returns only for positive prices", () => {
    assert.ok(closeTo(logReturn(100, 100 * Math.E), 1, 10));
    assert.equal(logReturn(100, 0), null);
    assert.equal(logReturn(0, 100), null);
  });
});

describe("clamp", () => {
  it("restricts to bounds and passes null through", () => {
    assert.equal(clamp(5, 0, 1), 1);
    assert.equal(clamp(-5, 0, 1), 0);
    assert.equal(clamp(0.5, 0, 1), 0.5);
    assert.equal(clamp(null, 0, 1), null);
  });
});

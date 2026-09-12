import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  atr,
  averageOf,
  bollinger,
  ema,
  lastCross,
  latest,
  macd,
  obv,
  rsi,
  sma,
  volumeAverage,
} from "../lib/analytics/indicators.ts";
import { barsFromCloses, closeTo, referenceEma, referenceRsi, WILDER_CLOSES } from "./helpers.ts";

describe("SMA", () => {
  it("matches a hand-computed average and starts at index period - 1", () => {
    const result = sma([1, 2, 3, 4, 5], 3);
    assert.deepEqual(result, [null, null, 2, 3, 4]);
  });

  it("is all null when the series is shorter than the period", () => {
    assert.deepEqual(sma([1, 2], 5), [null, null]);
  });

  it("returns an array the same length as its input", () => {
    assert.equal(sma([1, 2, 3, 4, 5, 6, 7], 4).length, 7);
  });

  it("rejects a non-positive or fractional period", () => {
    assert.deepEqual(sma([1, 2, 3], 0), [null, null, null]);
    assert.deepEqual(sma([1, 2, 3], 1.5), [null, null, null]);
  });

  it("handles an empty series", () => {
    assert.deepEqual(sma([], 5), []);
  });
});

describe("EMA", () => {
  it("seeds with the SMA of the first period values", () => {
    const values = [1, 2, 3, 4, 5, 6];
    const result = ema(values, 3);
    assert.equal(result[0], null);
    assert.equal(result[1], null);
    assert.equal(result[2], 2); // (1+2+3)/3
    // k = 2/4 = 0.5, so EMA_3 = 4*0.5 + 2*0.5 = 3
    assert.ok(closeTo(result[3], 3, 10));
    assert.ok(closeTo(result[4], 4, 10));
  });

  it("agrees with an independent transcription of the recurrence", () => {
    const values = WILDER_CLOSES;
    const mine = ema(values, 12);
    const reference = referenceEma(values, 12);
    for (let i = 0; i < values.length; i += 1) {
      if (reference[i] === null) assert.equal(mine[i], null);
      else assert.ok(closeTo(mine[i], reference[i]!, 9), `index ${i}`);
    }
  });

  it("is all null when history is shorter than the period", () => {
    assert.deepEqual(ema([1, 2, 3], 10), [null, null, null]);
  });
});

describe("RSI", () => {
  it("matches Wilder's published worked example", () => {
    const result = rsi(WILDER_CLOSES, 14);
    // The first defined reading sits at index 14 and is the widely published 70.53.
    assert.equal(result.slice(0, 14).every((value) => value === null), true);
    assert.ok(closeTo(result[14], 70.53, 1), `got ${result[14]}`);
    assert.ok(closeTo(result[15], 66.32, 1), `got ${result[15]}`);
  });

  it("agrees with an independent transcription at every index", () => {
    const mine = rsi(WILDER_CLOSES, 14);
    const reference = referenceRsi(WILDER_CLOSES, 14);
    assert.equal(mine.length, reference.length);
    for (let i = 0; i < mine.length; i += 1) {
      if (reference[i] === null) assert.equal(mine[i], null, `index ${i} should be null`);
      else assert.ok(closeTo(mine[i], reference[i]!, 8), `index ${i}: ${mine[i]} vs ${reference[i]}`);
    }
  });

  it("stays within 0 and 100 on a volatile series", () => {
    const values = Array.from({ length: 200 }, (_, i) => 100 + 40 * Math.sin(i / 3) + (i % 7));
    for (const value of rsi(values, 14)) {
      if (value === null) continue;
      assert.ok(value >= 0 && value <= 100, `out of range: ${value}`);
    }
  });

  it("reports 100 when every move is an advance", () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + i);
    assert.equal(latest(rsi(values, 14)), 100);
  });

  it("reports 0 when every move is a decline", () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 - i);
    assert.equal(latest(rsi(values, 14)), 0);
  });

  it("reports the neutral 50 for a perfectly flat series rather than 100", () => {
    const values = new Array(30).fill(100);
    assert.equal(latest(rsi(values, 14)), 50);
  });

  it("needs period + 1 observations", () => {
    assert.deepEqual(rsi([1, 2, 3], 14), [null, null, null]);
    assert.equal(rsi(new Array(14).fill(1), 14).every((value) => value === null), true);
    assert.notEqual(latest(rsi(Array.from({ length: 15 }, (_, i) => 100 + i), 14)), null);
  });
});

describe("MACD", () => {
  it("is the difference of the fast and slow EMAs", () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5);
    const result = macd(values, 12, 26, 9);
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    for (let i = 0; i < values.length; i += 1) {
      if (fast[i] === null || slow[i] === null) assert.equal(result.macd[i], null);
      else assert.ok(closeTo(result.macd[i], fast[i]! - slow[i]!, 9));
    }
  });

  it("keeps the histogram equal to line minus signal", () => {
    const values = Array.from({ length: 90 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = macd(values);
    for (let i = 0; i < values.length; i += 1) {
      if (result.macd[i] === null || result.signal[i] === null) {
        assert.equal(result.histogram[i], null);
      } else {
        assert.ok(closeTo(result.histogram[i], result.macd[i]! - result.signal[i]!, 9));
      }
    }
  });

  it("is positive on a steady uptrend", () => {
    const values = Array.from({ length: 120 }, (_, i) => 100 * 1.01 ** i);
    assert.ok((latest(macd(values).macd) ?? 0) > 0);
  });

  it("returns all null when fast is not shorter than slow", () => {
    const result = macd([1, 2, 3, 4], 26, 12);
    assert.equal(result.macd.every((value) => value === null), true);
  });

  it("is all null when history is shorter than the slow period", () => {
    const result = macd(Array.from({ length: 10 }, (_, i) => i + 1));
    assert.equal(result.macd.every((value) => value === null), true);
    assert.equal(result.signal.every((value) => value === null), true);
  });
});

describe("Bollinger Bands", () => {
  it("centres on the SMA with population deviation", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = bollinger(values, 8, 2);
    // Mean 5, population deviation 2, so the bands are 1 and 9.
    assert.ok(closeTo(result.middle[7], 5, 10));
    assert.ok(closeTo(result.upper[7], 9, 10));
    assert.ok(closeTo(result.lower[7], 1, 10));
  });

  it("puts %B at 1 on the upper band and 0 on the lower", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const result = bollinger(values, 8, 2);
    // Latest close is 9, which is exactly the upper band.
    assert.ok(closeTo(result.percentB[7], 1, 10));
  });

  it("returns null bands on a flat window where the bands collapse", () => {
    const values = new Array(20).fill(50);
    const result = bollinger(values, 20, 2);
    assert.equal(result.upper[19], 50);
    assert.equal(result.lower[19], 50);
    assert.equal(result.percentB[19], null);
  });

  it("is null before the window fills", () => {
    const result = bollinger([1, 2, 3], 20);
    assert.equal(result.middle.every((value) => value === null), true);
  });
});

describe("ATR", () => {
  it("accounts for overnight gaps, not just the intraday range", () => {
    const bars = barsFromCloses([100, 110, 105, 115, 112], { spread: 0 }).map((bar) => ({ ...bar }));
    // With spread 0 the high/low equal open/close, so true range is driven by gaps.
    const result = atr(bars, 2);
    assert.equal(result[0], null);
    assert.notEqual(result[2], null);
    assert.ok((result[2] ?? 0) > 0);
  });

  it("is all null when history is shorter than period + 1", () => {
    const bars = barsFromCloses([100, 101, 102]);
    assert.equal(atr(bars, 14).every((value) => value === null), true);
  });
});

describe("OBV", () => {
  it("adds volume on up closes and subtracts on down closes", () => {
    const bars = barsFromCloses([100, 101, 100, 100, 102], { volumes: [10, 20, 30, 40, 50] });
    assert.deepEqual(obv(bars), [0, 20, -10, -10, 40]);
  });

  it("is empty for an empty series", () => {
    assert.deepEqual(obv([]), []);
  });
});

describe("moving average crosses", () => {
  it("detects a golden cross when the fast average rises through the slow", () => {
    const fast = [1, 2, 3, 6];
    const slow = [4, 4, 4, 4];
    const timestamps = ["a", "b", "c", "d"];
    const cross = lastCross(fast, slow, timestamps, 50, 200);
    assert.equal(cross?.kind, "golden");
    assert.equal(cross?.timestamp, "d");
    assert.equal(cross?.barsAgo, 0);
  });

  it("detects a death cross", () => {
    const cross = lastCross([6, 5, 3], [4, 4, 4], ["a", "b", "c"], 50, 200);
    assert.equal(cross?.kind, "death");
  });

  it("returns null when the averages never touch", () => {
    assert.equal(lastCross([1, 2, 3], [9, 9, 9], ["a", "b", "c"], 50, 200), null);
  });

  it("ignores warm-up positions where either average is null", () => {
    const cross = lastCross([null, null, 5], [null, null, 4], ["a", "b", "c"], 50, 200);
    assert.equal(cross, null);
  });

  it("stops looking beyond the lookback window", () => {
    const fast = [1, 6, ...new Array(50).fill(6)];
    const slow = new Array(52).fill(4);
    const timestamps = fast.map((_, i) => String(i));
    assert.equal(lastCross(fast, slow, timestamps, 50, 200, 10), null);
  });
});

describe("helpers", () => {
  it("latest returns the last defined value", () => {
    assert.equal(latest([1, 2, null]), 2);
    assert.equal(latest([null, null]), null);
    assert.equal(latest([]), null);
  });

  it("averageOf ignores warm-up nulls", () => {
    assert.equal(averageOf([null, 2, 4]), 3);
    assert.equal(averageOf([null, null]), null);
  });

  it("volume average shares the SMA definition", () => {
    const bars = barsFromCloses([1, 2, 3, 4], { volumes: [10, 20, 30, 40] });
    assert.deepEqual(volumeAverage(bars, 2), [null, 15, 25, 35]);
  });
});

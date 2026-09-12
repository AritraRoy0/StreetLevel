import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSummary } from "../lib/analytics/summary.ts";
import { barsFromCloses, barsOnDays, closeTo, randomWalk } from "./helpers.ts";

/** Walks every number in a nested object and asserts it is finite. */
function assertNoNaN(value: unknown, path = "root"): void {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `${path} is ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoNaN(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoNaN(item, `${path}.${key}`);
  }
}

describe("buildSummary with a healthy series", () => {
  const bars = barsFromCloses(randomWalk(300, 5, 100));
  const summary = buildSummary("TEST", bars, { range: "MAX" });

  it("reports the window it actually used", () => {
    assert.equal(summary.bars.length, 300);
    assert.equal(summary.windowStart, bars[0].timestamp);
    assert.equal(summary.windowEnd, bars[bars.length - 1].timestamp);
    assert.equal(summary.truncated, false);
  });

  it("keeps every indicator series index-aligned with the bars", () => {
    for (const [name, series] of Object.entries(summary.indicators)) {
      assert.equal(series.length, summary.bars.length, `${name} length`);
    }
  });

  it("produces no NaN or Infinity anywhere", () => {
    assertNoNaN(summary);
  });

  it("agrees with itself across cards and series", () => {
    const lastDrawdown = summary.indicators.drawdown[summary.indicators.drawdown.length - 1];
    assert.equal(lastDrawdown, summary.drawdown.currentDrawdown);
    assert.equal(summary.lastPrice, summary.bars[summary.bars.length - 1].close);
  });

  it("classifies the RSI zone against Wilder's bands", () => {
    const { value, zone } = summary.rsi;
    if (value === null) assert.equal(zone, null);
    else if (value >= 70) assert.equal(zone, "overbought");
    else if (value <= 30) assert.equal(zone, "oversold");
    else assert.equal(zone, "neutral");
  });

  it("computes price against every moving average consistently", () => {
    for (const average of summary.movingAverages) {
      if (average.value === null) {
        assert.equal(average.priceVsMa, null);
        assert.equal(average.above, null);
        continue;
      }
      assert.equal(average.above, (summary.lastPrice ?? 0) > average.value);
      assert.ok(closeTo(average.priceVsMa, (summary.lastPrice! - average.value) / average.value, 8));
    }
  });
});

describe("insufficient history", () => {
  it("withholds long averages and explains why", () => {
    const summary = buildSummary("TEST", barsFromCloses(randomWalk(30, 9, 100)), { range: "MAX" });
    const sma200 = summary.movingAverages.find((average) => average.label === "SMA 200")!;
    assert.equal(sma200.value, null);
    assert.equal(sma200.required, 200);
    assert.equal(sma200.available, 30);
    assert.ok(summary.warnings.some((warning) => warning.includes("SMA 200 needs 200 bars")));
  });

  it("withholds RSI below fifteen bars", () => {
    const summary = buildSummary("TEST", barsFromCloses([100, 101, 102, 103]), { range: "MAX" });
    assert.equal(summary.rsi.value, null);
    assert.equal(summary.rsi.insufficientHistory, true);
    assert.ok(summary.warnings.some((warning) => warning.includes("RSI needs 15 bars")));
  });

  it("withholds CAGR for a short window", () => {
    const summary = buildSummary("TEST", barsFromCloses(randomWalk(40, 4, 100)), { range: "MAX" });
    assert.equal(summary.cagr.value, null);
    assert.equal(summary.cagr.insufficientHistory, true);
    assert.ok(summary.warnings.some((warning) => warning.includes("annualized growth rate")));
  });

  it("marks a thin volatility estimate as indicative", () => {
    const summary = buildSummary("TEST", barsFromCloses([100, 101, 99, 102, 98]), { range: "MAX" });
    assert.equal(summary.volatility.sufficient, false);
    assert.ok(summary.warnings.some((warning) => warning.includes("indicative")));
  });

  it("produces no NaN with only two bars", () => {
    const summary = buildSummary("TEST", barsFromCloses([100, 110]), { range: "MAX" });
    assertNoNaN(summary);
    assert.ok(closeTo(summary.periodReturn, 0.1, 8));
    assert.equal(summary.volatility.annualized, null);
  });
});

describe("empty and degenerate input", () => {
  it("returns a complete, empty shape for no history", () => {
    const summary = buildSummary("TEST", [], { range: "1Y" });
    assert.equal(summary.bars.length, 0);
    assert.equal(summary.lastPrice, null);
    assert.equal(summary.periodReturn, null);
    assert.equal(summary.rsi.value, null);
    assert.deepEqual(summary.indicators.sma20, []);
    assert.ok(summary.warnings.some((warning) => warning.includes("No price history")));
    assertNoNaN(summary);
  });

  it("handles a single bar", () => {
    const summary = buildSummary("TEST", barsFromCloses([100]), { range: "MAX" });
    assert.equal(summary.lastPrice, 100);
    assert.equal(summary.periodReturn, null);
    assert.equal(summary.lastChangePercent, null);
    assertNoNaN(summary);
  });

  it("handles a perfectly flat series", () => {
    const summary = buildSummary("TEST", barsFromCloses(new Array(60).fill(100), { spread: 0 }), { range: "MAX" });
    assert.equal(summary.periodReturn, 0);
    assert.equal(summary.volatility.annualized, 0);
    assert.equal(summary.drawdown.maxDrawdown, 0);
    assert.equal(summary.rsi.value, 50);
    assert.equal(summary.sharpe, null);
    assertNoNaN(summary);
  });
});

describe("ranges and intervals", () => {
  const history = barsOnDays(
    Array.from({ length: 500 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 9) * 20 + i * 0.1] as [string, number];
    }),
  );

  it("narrows the window as the range shortens", () => {
    const max = buildSummary("TEST", history, { range: "MAX" }).bars.length;
    const year = buildSummary("TEST", history, { range: "1Y" }).bars.length;
    const quarter = buildSummary("TEST", history, { range: "3M" }).bars.length;
    const month = buildSummary("TEST", history, { range: "1M" }).bars.length;
    assert.ok(max > year && year > quarter && quarter > month);
  });

  it("marks a range longer than the history as truncated", () => {
    const summary = buildSummary("TEST", history, { range: "5Y" });
    assert.equal(summary.truncated, true);
    assert.ok(summary.warnings.some((warning) => warning.includes("History begins after")));
  });

  it("resamples to weekly and monthly bars", () => {
    const daily = buildSummary("TEST", history, { range: "MAX", interval: "1d" }).bars.length;
    const weekly = buildSummary("TEST", history, { range: "MAX", interval: "1w" }).bars.length;
    const monthly = buildSummary("TEST", history, { range: "MAX", interval: "1mo" }).bars.length;
    assert.ok(daily > weekly && weekly > monthly);
    // Seven calendar days per ISO week, give or take the partial buckets at each end.
    assert.ok(Math.abs(weekly - daily / 7) <= 2, `${weekly} weekly buckets from ${daily} daily bars`);
  });

  it("annualizes weekly volatility with the weekly period count", () => {
    const weekly = buildSummary("TEST", history, { range: "MAX", interval: "1w" });
    assert.equal(weekly.interval, "1w");
    assert.ok(
      closeTo(weekly.volatility.annualized! / weekly.volatility.periodic!, Math.sqrt(52), 6),
    );
  });

  it("keeps volume totals consistent when resampling", () => {
    const daily = buildSummary("TEST", history, { range: "MAX", interval: "1d" });
    const weekly = buildSummary("TEST", history, { range: "MAX", interval: "1w" });
    // Weekly buckets sum their constituent days, so no volume is created or lost.
    assert.equal(weekly.volume.total, daily.volume.total);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absoluteChange,
  cagr,
  calmar,
  dailyReturns,
  distribution,
  drawdown,
  monthlyReturns,
  periodicReturns,
  rangeExtremes,
  sharpe,
  sortino,
  totalReturn,
  volatility,
  volumeSummary,
  weeklyReturns,
} from "../lib/analytics/returns.ts";
import { barsFromCloses, barsOnDays, closeTo } from "./helpers.ts";
import type { Bar } from "../lib/analytics/types.ts";

describe("total and absolute return", () => {
  it("measures first close to last close", () => {
    const bars = barsFromCloses([100, 110, 120]);
    assert.ok(closeTo(totalReturn(bars), 0.2, 10));
    assert.ok(closeTo(absoluteChange(bars), 20, 10));
  });

  it("is null for fewer than two bars", () => {
    assert.equal(totalReturn(barsFromCloses([100])), null);
    assert.equal(totalReturn([]), null);
    assert.equal(absoluteChange(barsFromCloses([100])), null);
  });

  it("handles a decline", () => {
    const bars = barsFromCloses([200, 150]);
    assert.ok(closeTo(totalReturn(bars), -0.25, 10));
    assert.ok(closeTo(absoluteChange(bars), -50, 10));
  });

  it("uses adjusted closes for the percentage and raw closes for the currency change", () => {
    // A 2-for-1 split: the raw close halves while the adjusted series is continuous.
    const bars: Bar[] = [
      { timestamp: "2026-01-05T00:00:00.000Z", open: 100, high: 100, low: 100, close: 100, adjClose: 50, volume: 1 },
      { timestamp: "2026-01-06T00:00:00.000Z", open: 55, high: 55, low: 55, close: 55, adjClose: 55, volume: 1 },
    ];
    assert.ok(closeTo(totalReturn(bars), 0.1, 10));
    assert.ok(closeTo(absoluteChange(bars), -45, 10));
  });
});

describe("periodic returns", () => {
  it("produces one fewer value than there are bars", () => {
    const bars = barsFromCloses([100, 110, 121]);
    const returns = periodicReturns(bars);
    assert.equal(returns.length, 2);
    assert.ok(closeTo(returns[0], 0.1, 10));
    assert.ok(closeTo(returns[1], 0.1, 10));
  });

  it("is empty for a single bar", () => {
    assert.deepEqual(periodicReturns(barsFromCloses([100])), []);
    assert.deepEqual(periodicReturns([]), []);
  });

  it("dates each return to the later bar", () => {
    const bars = barsFromCloses([100, 110]);
    const dated = dailyReturns(bars);
    assert.equal(dated.length, 1);
    assert.equal(dated[0].timestamp, bars[1].timestamp);
  });
});

describe("weekly and monthly returns", () => {
  it("measures each week from the previous week's last session", () => {
    // Two full ISO weeks: Mon 5 Jan to Fri 9 Jan, then Mon 12 Jan to Fri 16 Jan.
    const bars = barsOnDays([
      ["2026-01-05", 100], ["2026-01-06", 101], ["2026-01-07", 102], ["2026-01-08", 103], ["2026-01-09", 110],
      ["2026-01-12", 111], ["2026-01-13", 112], ["2026-01-14", 113], ["2026-01-15", 114], ["2026-01-16", 121],
    ]);
    const weekly = weeklyReturns(bars);
    assert.equal(weekly.length, 1);
    assert.equal(weekly[0].key, "2026-W03");
    assert.ok(closeTo(weekly[0].value, 0.1, 10));
  });

  it("measures each month from the previous month's last session", () => {
    const bars = barsOnDays([
      ["2026-01-29", 90], ["2026-01-30", 100],
      ["2026-02-02", 105], ["2026-02-27", 110],
      ["2026-03-02", 115], ["2026-03-31", 121],
    ]);
    const monthly = monthlyReturns(bars);
    assert.equal(monthly.length, 2);
    assert.equal(monthly[0].key, "2026-02");
    assert.ok(closeTo(monthly[0].value, 0.1, 10));
    assert.equal(monthly[1].key, "2026-03");
    assert.ok(closeTo(monthly[1].value, 0.1, 10));
  });

  it("omits the first bucket, which has no predecessor", () => {
    const bars = barsOnDays([["2026-01-05", 100], ["2026-01-06", 110]]);
    assert.deepEqual(weeklyReturns(bars), []);
  });

  it("returns nothing for a single bar", () => {
    assert.deepEqual(monthlyReturns(barsFromCloses([100])), []);
  });
});

describe("CAGR", () => {
  it("annualizes a two-year doubling of 21% into 10%", () => {
    const bars: Bar[] = [
      { timestamp: "2024-01-01T00:00:00.000Z", open: 100, high: 100, low: 100, close: 100, adjClose: 100, volume: 1 },
      { timestamp: "2025-12-31T12:00:00.000Z", open: 121, high: 121, low: 121, close: 121, adjClose: 121, volume: 1 },
    ];
    const result = cagr(bars);
    // 730.5 days is exactly two mean years, so the rate is sqrt(1.21) - 1.
    assert.ok(closeTo(result.value, 0.1, 6), `got ${result.value}`);
    assert.equal(result.insufficientHistory, false);
  });

  it("returns one year's simple return unchanged", () => {
    const bars: Bar[] = [
      { timestamp: "2025-01-01T00:00:00.000Z", open: 100, high: 100, low: 100, close: 100, adjClose: 100, volume: 1 },
      { timestamp: "2026-01-01T06:00:00.000Z", open: 115, high: 115, low: 115, close: 115, adjClose: 115, volume: 1 },
    ];
    assert.ok(closeTo(cagr(bars).value, 0.15, 3));
  });

  it("is withheld below the minimum window so short periods are not extrapolated", () => {
    const bars = barsFromCloses([100, 130]);
    const result = cagr(bars);
    assert.equal(result.value, null);
    assert.equal(result.insufficientHistory, true);
  });

  it("is null for fewer than two bars", () => {
    assert.equal(cagr(barsFromCloses([100])).value, null);
    assert.equal(cagr([]).value, null);
  });
});

describe("volatility", () => {
  it("annualizes the sample deviation by the square root of 252", () => {
    // Alternating +10% / -9.0909% returns to the same price, with a known deviation.
    const closes = [100, 110, 100, 110, 100, 110];
    const bars = barsFromCloses(closes);
    const result = volatility(bars, "1d");
    const returns = periodicReturns(bars);
    const average = returns.reduce((total, value) => total + value, 0) / returns.length;
    const sampleVariance =
      returns.reduce((total, value) => total + (value - average) ** 2, 0) / (returns.length - 1);
    assert.ok(closeTo(result.periodic, Math.sqrt(sampleVariance), 10));
    assert.ok(closeTo(result.annualized, Math.sqrt(sampleVariance) * Math.sqrt(252), 8));
  });

  it("scales by 52 for weekly bars and 12 for monthly bars", () => {
    const bars = barsFromCloses([100, 110, 100, 110, 100, 110]);
    const weekly = volatility(bars, "1w");
    const monthly = volatility(bars, "1mo");
    assert.ok(closeTo(weekly.annualized! / weekly.periodic!, Math.sqrt(52), 8));
    assert.ok(closeTo(monthly.annualized! / monthly.periodic!, Math.sqrt(12), 8));
  });

  it("is zero for a perfectly flat series, not null", () => {
    const result = volatility(barsFromCloses(new Array(30).fill(100)));
    assert.equal(result.annualized, 0);
  });

  it("flags an estimate built on too few observations", () => {
    const short = volatility(barsFromCloses([100, 101, 102]));
    assert.equal(short.observations, 2);
    assert.equal(short.sufficient, false);
    assert.notEqual(short.annualized, null);

    const long = volatility(barsFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i)));
    assert.equal(long.sufficient, true);
  });

  it("is null when there are fewer than two returns", () => {
    const result = volatility(barsFromCloses([100, 110]));
    assert.equal(result.annualized, null);
    assert.equal(result.observations, 1);
  });
});

describe("drawdown", () => {
  it("finds the worst peak-to-trough decline", () => {
    const bars = barsFromCloses([100, 120, 90, 110, 80, 130]);
    const result = drawdown(bars);
    // Worst is the 120 peak down to the 80 trough.
    assert.ok(closeTo(result.maxDrawdown, -1 / 3, 10));
    assert.equal(result.peakTimestamp, bars[1].timestamp);
    assert.equal(result.troughTimestamp, bars[4].timestamp);
    assert.equal(result.recoveryTimestamp, bars[5].timestamp);
  });

  it("is zero at every new high", () => {
    const bars = barsFromCloses([100, 110, 120]);
    const result = drawdown(bars);
    assert.equal(result.maxDrawdown, 0);
    assert.deepEqual(result.series.map((point) => point.value), [0, 0, 0]);
    assert.equal(result.peakTimestamp, null);
  });

  it("reports no recovery when the price never regains its peak", () => {
    const bars = barsFromCloses([100, 50]);
    const result = drawdown(bars);
    assert.ok(closeTo(result.maxDrawdown, -0.5, 10));
    assert.equal(result.recoveryTimestamp, null);
    assert.equal(result.recoveryDays, null);
  });

  it("tracks the current drawdown separately from the maximum", () => {
    const bars = barsFromCloses([100, 60, 90]);
    const result = drawdown(bars);
    assert.ok(closeTo(result.maxDrawdown, -0.4, 10));
    assert.ok(closeTo(result.currentDrawdown, -0.1, 10));
  });

  it("is empty for an empty series", () => {
    const result = drawdown([]);
    assert.equal(result.maxDrawdown, null);
    assert.deepEqual(result.series, []);
  });
});

describe("period extremes", () => {
  it("uses intraday highs and lows, not closes", () => {
    const bars = barsFromCloses([100, 120, 90], { spread: 0.1 });
    const result = rangeExtremes(bars);
    assert.ok((result.high.value ?? 0) > 120);
    assert.ok((result.low.value ?? Infinity) < 90);
  });

  it("places the latest close inside the range", () => {
    const bars = barsFromCloses([100, 200, 150], { spread: 0 });
    const result = rangeExtremes(bars);
    assert.ok(closeTo(result.high.value, 200, 6));
    assert.ok(closeTo(result.low.value, 100, 6));
    assert.ok(closeTo(result.position, 0.5, 6));
  });

  it("is null for an empty series", () => {
    const result = rangeExtremes([]);
    assert.equal(result.high.value, null);
    assert.equal(result.position, null);
  });

  it("returns a null position when high equals low", () => {
    const bars = barsFromCloses([100, 100], { spread: 0 });
    assert.equal(rangeExtremes(bars).position, null);
  });
});

describe("volume", () => {
  it("averages the window and excludes the latest bar from its own baseline", () => {
    const bars = barsFromCloses([1, 2, 3, 4], { volumes: [100, 100, 100, 400] });
    const result = volumeSummary(bars, bars, 3);
    assert.equal(result.average, 175);
    assert.equal(result.latest, 400);
    // Baseline is the three prior bars at 100, so the latest is 3x that.
    assert.ok(closeTo(result.latestVsAverage, 3, 10));
    assert.equal(result.total, 700);
  });

  it("compares the window against the equally long window before it", () => {
    const history = barsFromCloses([1, 2, 3, 4, 5, 6], { volumes: [100, 100, 100, 200, 200, 200] });
    const window = history.slice(3);
    const result = volumeSummary(window, history, 20);
    assert.ok(closeTo(result.periodOverPeriod, 1, 10));
  });

  it("has no period-over-period figure when nothing precedes the window", () => {
    const bars = barsFromCloses([1, 2, 3], { volumes: [10, 20, 30] });
    assert.equal(volumeSummary(bars, bars).periodOverPeriod, null);
  });

  it("is all null for an empty window", () => {
    const result = volumeSummary([], []);
    assert.equal(result.average, null);
    assert.equal(result.latest, null);
  });
});

describe("risk-adjusted ratios", () => {
  it("is null when volatility is zero", () => {
    const flat = barsFromCloses(new Array(30).fill(100));
    assert.equal(sharpe(flat), null);
    assert.equal(sortino(flat), null);
  });

  it("is positive for a rising series and negative for a falling one", () => {
    const rising = barsFromCloses(Array.from({ length: 60 }, (_, i) => 100 * 1.002 ** i + (i % 3)));
    const falling = barsFromCloses(Array.from({ length: 60 }, (_, i) => 100 * 0.998 ** i + (i % 3)));
    assert.ok((sharpe(rising) ?? 0) > 0);
    assert.ok((sharpe(falling) ?? 0) < 0);
  });

  it("gives Sortino no denominator when nothing ever falls", () => {
    const monotone = barsFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i));
    assert.equal(sortino(monotone), null);
  });

  it("is null for too few observations", () => {
    assert.equal(sharpe(barsFromCloses([100, 110])), null);
    assert.equal(calmar(barsFromCloses([100, 110])), null);
  });
});

describe("distribution", () => {
  it("finds best, worst and hit rate", () => {
    const bars = barsFromCloses([100, 110, 99, 99, 120]);
    const stats = distribution(dailyReturns(bars));
    assert.equal(stats.positive, 2);
    assert.equal(stats.negative, 1);
    assert.equal(stats.flat, 1);
    assert.ok(closeTo(stats.hitRate, 0.5, 10));
    assert.ok((stats.best?.value ?? 0) > 0);
    assert.ok((stats.worst?.value ?? 0) < 0);
  });

  it("is empty-safe", () => {
    const stats = distribution([]);
    assert.equal(stats.best, null);
    assert.equal(stats.hitRate, null);
    assert.equal(stats.average, null);
  });
});

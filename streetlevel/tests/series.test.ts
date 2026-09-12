import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignSeries,
  buildCompositeIndex,
  dayKey,
  daysBetween,
  isoWeekKey,
  isWeekend,
  monthKey,
  normalizeBars,
  resample,
  resolveRange,
  sliceByDate,
  toBar,
  weekdaysBetween,
} from "../lib/analytics/series.ts";
import { barsFromCloses, barsOnDays, closeTo } from "./helpers.ts";

describe("bar validation", () => {
  it("accepts a well-formed row and defaults the adjusted close", () => {
    const bar = toBar({ date: "2026-01-05", open: 10, high: 12, low: 9, close: 11, volume: 100 });
    assert.equal(bar?.timestamp, "2026-01-05T00:00:00.000Z");
    assert.equal(bar?.adjClose, 11);
  });

  it("prefers an explicit adjusted close", () => {
    const bar = toBar({ date: "2026-01-05", open: 10, high: 12, low: 9, close: 11, adjustedClose: 10.5, volume: 1 });
    assert.equal(bar?.adjClose, 10.5);
  });

  it("rejects missing, non-finite and non-positive prices", () => {
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: 12, low: 9, volume: 1 }), null);
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: Number.NaN, low: 9, close: 11, volume: 1 }), null);
    assert.equal(toBar({ date: "2026-01-05", open: 0, high: 12, low: 9, close: 11, volume: 1 }), null);
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: 12, low: -1, close: 11, volume: 1 }), null);
  });

  it("rejects negative volume", () => {
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: 12, low: 9, close: 11, volume: -5 }), null);
  });

  it("rejects a bar whose high is below its low", () => {
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: 8, low: 9, close: 9, volume: 1 }), null);
  });

  it("rejects a close outside the day's range, which signals mixed adjusted fields", () => {
    assert.equal(toBar({ date: "2026-01-05", open: 10, high: 12, low: 9, close: 20, volume: 1 }), null);
    assert.equal(toBar({ date: "2026-01-05", open: 30, high: 12, low: 9, close: 11, volume: 1 }), null);
  });

  it("rejects an unparseable or missing date", () => {
    assert.equal(toBar({ date: "not-a-date", open: 10, high: 12, low: 9, close: 11, volume: 1 }), null);
    assert.equal(toBar({ open: 10, high: 12, low: 9, close: 11, volume: 1 }), null);
    assert.equal(toBar(null), null);
    assert.equal(toBar("string"), null);
  });

  it("accepts numeric strings from a quoting provider", () => {
    const bar = toBar({ date: "2026-01-05", open: "10", high: "12", low: "9", close: "11", volume: "100" });
    assert.equal(bar?.close, 11);
  });
});

describe("normalizeBars", () => {
  it("sorts, de-duplicates and counts problems", () => {
    const result = normalizeBars(
      [
        { date: "2026-01-06", open: 10, high: 11, low: 9, close: 10.5, volume: 1 },
        { date: "2026-01-05", open: 10, high: 11, low: 9, close: 10, volume: 1 },
        { date: "2026-01-06", open: 10, high: 11, low: 9, close: 10.9, volume: 1 },
        { date: "bad", open: 1, high: 1, low: 1, close: 1, volume: 1 },
      ],
      new Date("2026-01-07T00:00:00.000Z"),
    );
    assert.equal(result.bars.length, 2);
    assert.equal(result.bars[0].timestamp, "2026-01-05T00:00:00.000Z");
    // The later duplicate wins, matching how providers issue corrections.
    assert.equal(result.bars[1].close, 10.9);
    assert.equal(result.quality.duplicates, 1);
    assert.equal(result.quality.rejected, 1);
    assert.equal(result.quality.reordered, 1);
  });

  it("counts weekday sessions missing from the covered window", () => {
    const result = normalizeBars(
      [
        { date: "2026-01-05", open: 10, high: 11, low: 9, close: 10, volume: 1 },
        { date: "2026-01-08", open: 10, high: 11, low: 9, close: 10, volume: 1 },
      ],
      new Date("2026-01-09T00:00:00.000Z"),
    );
    // 6 and 7 January are weekdays with no bar.
    assert.equal(result.quality.missingSessions, 2);
  });

  it("ignores weekends when counting gaps", () => {
    const result = normalizeBars(
      [
        { date: "2026-01-09", open: 10, high: 11, low: 9, close: 10, volume: 1 },
        { date: "2026-01-12", open: 10, high: 11, low: 9, close: 10, volume: 1 },
      ],
      new Date("2026-01-13T00:00:00.000Z"),
    );
    assert.equal(result.quality.missingSessions, 0);
  });

  it("flags a stale feed in trading days, not calendar days", () => {
    const fresh = normalizeBars(
      [{ date: "2026-01-09", open: 10, high: 11, low: 9, close: 10, volume: 1 }],
      new Date("2026-01-11T00:00:00.000Z"),
    );
    // Friday close read on a Sunday is zero trading days old.
    assert.equal(fresh.quality.staleWeekdays, 0);
    assert.equal(fresh.quality.stale, false);

    const stale = normalizeBars(
      [{ date: "2026-01-05", open: 10, high: 11, low: 9, close: 10, volume: 1 }],
      new Date("2026-01-15T00:00:00.000Z"),
    );
    assert.equal(stale.quality.stale, true);
  });

  it("handles an empty and a non-array payload", () => {
    assert.deepEqual(normalizeBars([]).bars, []);
    assert.deepEqual(normalizeBars(null).bars, []);
    assert.deepEqual(normalizeBars({ nope: true }).bars, []);
    assert.ok(normalizeBars([]).quality.warnings.length > 0);
  });
});

describe("calendar helpers", () => {
  it("keys days, weeks and months in UTC", () => {
    assert.equal(dayKey("2026-03-15T23:30:00.000Z"), "2026-03-15");
    assert.equal(monthKey("2026-03-15T00:00:00.000Z"), "2026-03");
    assert.equal(isoWeekKey("2026-01-05T00:00:00.000Z"), "2026-W02");
  });

  it("assigns an ISO week by its Thursday across a year boundary", () => {
    // 31 December 2025 is a Wednesday, in the same ISO week as 1 January 2026.
    assert.equal(isoWeekKey("2025-12-31T00:00:00.000Z"), isoWeekKey("2026-01-01T00:00:00.000Z"));
  });

  it("detects weekends", () => {
    assert.equal(isWeekend("2026-01-10T00:00:00.000Z"), true); // Saturday
    assert.equal(isWeekend("2026-01-11T00:00:00.000Z"), true); // Sunday
    assert.equal(isWeekend("2026-01-12T00:00:00.000Z"), false); // Monday
  });

  it("counts weekdays and calendar days between dates", () => {
    assert.equal(weekdaysBetween("2026-01-05", "2026-01-12"), 5);
    assert.equal(weekdaysBetween("2026-01-12", "2026-01-05"), 0);
    assert.ok(closeTo(daysBetween("2026-01-05", "2026-01-12"), 7, 6));
  });
});

describe("resolveRange", () => {
  const history = barsOnDays(
    Array.from({ length: 400 }, (_, i) => {
      const date = new Date(Date.UTC(2025, 0, 1));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + i] as [string, number];
    }),
  );

  it("anchors on the newest bar, not on wall-clock time", () => {
    const resolved = resolveRange(history, "1M");
    assert.equal(resolved?.end, history[history.length - 1].timestamp);
  });

  it("returns roughly a month, a quarter and a year of bars", () => {
    assert.ok((resolveRange(history, "1M")?.bars.length ?? 0) >= 28);
    assert.ok((resolveRange(history, "1M")?.bars.length ?? 0) <= 32);
    assert.ok((resolveRange(history, "3M")?.bars.length ?? 0) >= 89);
    assert.ok((resolveRange(history, "1Y")?.bars.length ?? 0) >= 365);
  });

  it("starts YTD at 1 January of the newest bar's year", () => {
    const resolved = resolveRange(history, "YTD");
    assert.equal(dayKey(resolved!.start), "2026-01-01");
  });

  it("returns the whole series for MAX", () => {
    const resolved = resolveRange(history, "MAX");
    assert.equal(resolved?.bars.length, history.length);
    assert.equal(resolved?.truncated, false);
  });

  it("widens a one-bar window to two so a change can still be computed", () => {
    const resolved = resolveRange(history, "1D");
    assert.equal(resolved?.bars.length, 2);
  });

  it("marks a range longer than the available history as truncated", () => {
    const short = barsFromCloses([100, 101, 102, 103]);
    const resolved = resolveRange(short, "5Y");
    assert.equal(resolved?.truncated, true);
    assert.ok((resolved?.coverage ?? 1) < 0.01);
    assert.equal(resolved?.bars.length, 4);
  });

  it("does not flag a one-year window over exactly one year of sessions", () => {
    // The first session of a year-long window is never the calendar
    // anniversary, so a naive comparison would call this complete chart short.
    const oneYear = barsOnDays(
      Array.from({ length: 366 }, (_, i) => {
        const date = new Date(Date.UTC(2025, 8, 2));
        date.setUTCDate(date.getUTCDate() + i);
        return [date.toISOString().slice(0, 10), 100 + i * 0.1] as [string, number];
      }).filter(([day]) => {
        const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
        return weekday !== 0 && weekday !== 6;
      }),
    );
    const resolved = resolveRange(oneYear, "1Y");
    assert.equal(resolved?.truncated, false, `coverage was ${resolved?.coverage}`);
    assert.ok((resolved?.coverage ?? 0) > 0.97);
  });

  it("still flags a window that covers well under the requested span", () => {
    const sixMonths = barsOnDays(
      Array.from({ length: 130 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 2, 2));
        date.setUTCDate(date.getUTCDate() + i);
        return [date.toISOString().slice(0, 10), 100 + i] as [string, number];
      }),
    );
    const resolved = resolveRange(sixMonths, "1Y");
    assert.equal(resolved?.truncated, true);
    assert.ok((resolved?.coverage ?? 1) < 0.5);
  });

  it("returns null for an empty series", () => {
    assert.equal(resolveRange([], "1Y"), null);
  });

  it("clamps a month subtraction to the shorter month", () => {
    const monthEnd = barsOnDays([
      ["2026-01-30", 100], ["2026-02-27", 101], ["2026-03-30", 102], ["2026-03-31", 103],
    ]);
    const resolved = resolveRange(monthEnd, "1M");
    // 31 March minus one month clamps to 28 February, which 2026 has as its
    // last day. The 27 February bar falls before that and is excluded.
    assert.equal(dayKey(resolved!.requestedStart), "2026-02-28");
    assert.equal(resolved?.bars.length, 2);
  });
});

describe("sliceByDate", () => {
  it("is inclusive at both ends", () => {
    const bars = barsOnDays([["2026-01-05", 1], ["2026-01-06", 2], ["2026-01-07", 3]]);
    const slice = sliceByDate(bars, "2026-01-05T00:00:00.000Z", "2026-01-06T00:00:00.000Z");
    assert.equal(slice.length, 2);
  });

  it("returns nothing for invalid bounds", () => {
    const bars = barsOnDays([["2026-01-05", 1]]);
    assert.deepEqual(sliceByDate(bars, "nope", "2026-01-06"), []);
  });
});

describe("resample", () => {
  it("aggregates daily bars into weekly OHLCV", () => {
    const bars = barsOnDays([
      ["2026-01-05", 100], ["2026-01-06", 105], ["2026-01-07", 95], ["2026-01-08", 103], ["2026-01-09", 110],
      ["2026-01-12", 111], ["2026-01-13", 120],
    ]);
    const weekly = resample(bars, "1w");
    assert.equal(weekly.length, 2);
    assert.equal(weekly[0].open, bars[0].open);
    assert.equal(weekly[0].close, 110);
    assert.equal(weekly[0].high, Math.max(...bars.slice(0, 5).map((bar) => bar.high)));
    assert.equal(weekly[0].low, Math.min(...bars.slice(0, 5).map((bar) => bar.low)));
    assert.equal(weekly[0].volume, 5_000_000);
    // The bucket is stamped with its last session, not its first.
    assert.equal(dayKey(weekly[0].timestamp), "2026-01-09");
  });

  it("aggregates into months", () => {
    const bars = barsOnDays([
      ["2026-01-05", 100], ["2026-01-30", 110],
      ["2026-02-02", 111], ["2026-02-27", 120],
    ]);
    const monthly = resample(bars, "1mo");
    assert.equal(monthly.length, 2);
    assert.equal(monthly[1].close, 120);
  });

  it("leaves daily and intraday intervals untouched", () => {
    const bars = barsFromCloses([1, 2, 3]);
    assert.equal(resample(bars, "1d").length, 3);
    assert.equal(resample(bars, "1h").length, 3);
  });

  it("keeps a partial final bucket", () => {
    const bars = barsOnDays([["2026-01-05", 100], ["2026-01-06", 101], ["2026-01-12", 102]]);
    assert.equal(resample(bars, "1w").length, 2);
  });
});

describe("alignSeries", () => {
  it("joins on the calendar day and drops unmatched sessions", () => {
    const left = barsOnDays([["2026-01-05", 10], ["2026-01-06", 11], ["2026-01-07", 12]]);
    const right = barsOnDays([["2026-01-05", 20], ["2026-01-07", 22], ["2026-01-08", 23]]);
    const aligned = alignSeries(left, right);
    assert.deepEqual(aligned.timestamps.map(dayKey), ["2026-01-05", "2026-01-07"]);
    assert.equal(aligned.left.length, 2);
    assert.equal(aligned.right.length, 2);
    assert.equal(aligned.dropped, 2);
  });

  it("never pairs mismatched dates", () => {
    const left = barsOnDays([["2026-01-05", 10], ["2026-01-06", 11]]);
    const right = barsOnDays([["2026-01-06", 20], ["2026-01-07", 21]]);
    const aligned = alignSeries(left, right);
    for (let i = 0; i < aligned.timestamps.length; i += 1) {
      assert.equal(dayKey(aligned.left[i].timestamp), dayKey(aligned.right[i].timestamp));
    }
  });

  it("handles a disjoint pair", () => {
    const left = barsOnDays([["2026-01-05", 10]]);
    const right = barsOnDays([["2026-02-05", 20]]);
    assert.equal(alignSeries(left, right).timestamps.length, 0);
  });

  it("handles empty input", () => {
    assert.equal(alignSeries([], []).timestamps.length, 0);
  });
});

describe("composite index", () => {
  it("starts at 100 and averages its constituents", () => {
    const a = barsOnDays([["2026-01-05", 100], ["2026-01-06", 110]]);
    const b = barsOnDays([["2026-01-05", 50], ["2026-01-06", 45]]);
    const composite = buildCompositeIndex([a, b]);
    assert.equal(composite.length, 2);
    assert.ok(closeTo(composite[0].adjClose, 100, 6));
    // +10% and -10% average to 100 exactly.
    assert.ok(closeTo(composite[1].adjClose, 100, 6));
  });

  it("uses only days every constituent trades", () => {
    const a = barsOnDays([["2026-01-05", 100], ["2026-01-06", 110], ["2026-01-07", 120]]);
    const b = barsOnDays([["2026-01-05", 50], ["2026-01-07", 60]]);
    assert.equal(buildCompositeIndex([a, b]).length, 2);
  });

  it("is empty when the constituents never overlap", () => {
    const a = barsOnDays([["2026-01-05", 100]]);
    const b = barsOnDays([["2026-02-05", 50]]);
    assert.deepEqual(buildCompositeIndex([a, b]), []);
  });

  it("is empty for no input", () => {
    assert.deepEqual(buildCompositeIndex([]), []);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY,
  formatCompactCurrency,
  formatCount,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatMonthYear,
  formatPercent,
  formatPoints,
  formatPrice,
  formatPriceChange,
  formatRatio,
  formatRelativeTime,
  formatVolume,
  signOf,
} from "../lib/analytics/format.ts";

describe("null handling", () => {
  it("renders every unavailable value as one em dash", () => {
    const formatters = [
      formatPrice, formatPriceChange, formatPercent, formatPoints, formatRatio,
      formatVolume, formatCompactCurrency, formatCount, formatDate, formatDayMonth,
      formatMonthYear, formatDateTime, formatRelativeTime,
    ];
    for (const format of formatters) {
      assert.equal((format as (value: unknown) => string)(null), EMPTY);
      assert.equal((format as (value: unknown) => string)(undefined), EMPTY);
    }
  });

  it("never prints NaN or Infinity", () => {
    assert.equal(formatPrice(Number.NaN), EMPTY);
    assert.equal(formatPercent(Infinity), EMPTY);
    assert.equal(formatVolume(-Infinity), EMPTY);
    assert.equal(formatRatio(Number.NaN), EMPTY);
  });

  it("rejects an unparseable date string", () => {
    assert.equal(formatDate("not-a-date"), EMPTY);
    assert.equal(formatDateTime("2026-13-45"), EMPTY);
  });
});

describe("prices", () => {
  it("uses two decimals above a dollar and four below", () => {
    assert.equal(formatPrice(1234.5), "$1,234.50");
    assert.equal(formatPrice(0.1234), "$0.1234");
    assert.equal(formatPrice(0), "$0.00");
  });

  it("signs a change explicitly", () => {
    assert.equal(formatPriceChange(1.24), "+$1.24");
    assert.equal(formatPriceChange(-0.98), "-$0.98");
    assert.equal(formatPriceChange(0), "$0.00");
  });
});

describe("percentages", () => {
  it("multiplies a fraction by 100 exactly once", () => {
    assert.equal(formatPercent(0.0512), "5.12%");
    assert.equal(formatPercent(-0.0512), "-5.12%");
    assert.equal(formatPercent(1), "100.00%");
  });

  it("adds a plus sign only when asked", () => {
    assert.equal(formatPercent(0.05, { signed: true }), "+5.00%");
    assert.equal(formatPercent(-0.05, { signed: true }), "-5.00%");
    assert.equal(formatPercent(0, { signed: true }), "0.00%");
  });

  it("honours a digit override", () => {
    assert.equal(formatPercent(0.123456, { digits: 1 }), "12.3%");
    assert.equal(formatPercent(0.123456, { digits: 0 }), "12%");
  });

  it("never renders negative zero", () => {
    assert.equal(formatPercent(-0.000001), "0.00%");
  });
});

describe("volume", () => {
  it("uses compact suffixes", () => {
    assert.equal(formatVolume(65_400_000), "65.4M");
    assert.equal(formatVolume(1_240_000_000), "1.24B");
    assert.equal(formatVolume(2_500), "2.50K");
    assert.equal(formatVolume(1.5e12), "1.50T");
  });

  it("prints small counts whole", () => {
    assert.equal(formatVolume(430), "430");
    assert.equal(formatVolume(0), "0");
  });

  it("drops decimals once the mantissa passes 100", () => {
    assert.equal(formatVolume(231_164_900), "231M");
  });
});

describe("dates", () => {
  it("formats in UTC regardless of the host timezone", () => {
    assert.equal(formatDate("2026-09-01T00:00:00.000Z"), "Sep 1, 2026");
    assert.equal(formatDayMonth("2026-09-01T00:00:00.000Z"), "Sep 1");
    assert.equal(formatMonthYear("2026-09-01T00:00:00.000Z"), "Sep '26");
    assert.equal(formatDateTime("2026-09-01T14:32:00.000Z"), "Sep 1, 2026, 14:32 UTC");
  });

  it("does not slip a day at a UTC midnight boundary", () => {
    // A naive local-time formatter renders this as 31 August in any negative offset.
    assert.equal(formatDate("2026-09-01T00:00:00.000Z"), "Sep 1, 2026");
  });
});

describe("relative time", () => {
  const now = new Date("2026-09-11T12:00:00.000Z");

  it("uses coarse buckets", () => {
    assert.equal(formatRelativeTime("2026-09-11T11:48:00.000Z", now), "12m ago");
    assert.equal(formatRelativeTime("2026-09-11T09:00:00.000Z", now), "3h ago");
    assert.equal(formatRelativeTime("2026-09-09T12:00:00.000Z", now), "2d ago");
    assert.equal(formatRelativeTime("2026-09-11T11:59:40.000Z", now), "just now");
  });

  it("falls back to an absolute date beyond a month", () => {
    assert.equal(formatRelativeTime("2026-01-05T12:00:00.000Z", now), "Jan 5, 2026");
  });

  it("shows an absolute date for a future timestamp", () => {
    assert.equal(formatRelativeTime("2026-10-01T12:00:00.000Z", now), "Oct 1, 2026");
  });
});

describe("sign classification", () => {
  it("distinguishes positive, negative, flat and unavailable", () => {
    assert.equal(signOf(1), "positive");
    assert.equal(signOf(-1), "negative");
    assert.equal(signOf(0), "flat");
    assert.equal(signOf(null), "none");
    assert.equal(signOf(Number.NaN), "none");
  });
});

describe("ratios and counts", () => {
  it("formats to a fixed width", () => {
    assert.equal(formatRatio(1.2), "1.20");
    assert.equal(formatRatio(-0.456), "-0.46");
    assert.equal(formatPoints(68.25), "68.3");
    assert.equal(formatCount(1234567), "1,234,567");
  });

  it("formats a market capitalisation compactly", () => {
    assert.equal(formatCompactCurrency(3.16e12), "$3.16T");
    assert.equal(formatCompactCurrency(8.154e11), "$815.4B");
  });
});

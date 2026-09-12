import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnalyticsError,
  ERROR_STATUS,
  INTERVAL_SUPPORT,
  MAX_BATCH_SYMBOLS,
  requireAvailableInterval,
  toErrorResponse,
  validateDate,
  validateDateRange,
  validateInterval,
  validateLimit,
  validateRange,
  validateSymbol,
  validateSymbolList,
} from "../lib/analytics-validation.ts";
import { RateLimiter, TtlCache } from "../lib/analytics-cache.ts";

function expectError(code: string, run: () => unknown): void {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof AnalyticsError, `threw ${error}`);
    assert.equal(error.code, code);
    assert.ok(error.message.length > 10, "error message should be actionable");
    return;
  }
  assert.fail(`expected ${code} but nothing was thrown`);
}

describe("symbol validation", () => {
  it("accepts ordinary tickers and normalizes case", () => {
    assert.equal(validateSymbol("aapl"), "AAPL");
    assert.equal(validateSymbol(" msft "), "MSFT");
  });

  it("accepts class shares and exchange suffixes", () => {
    assert.equal(validateSymbol("BRK.B"), "BRK.B");
    assert.equal(validateSymbol("SHOP.TO"), "SHOP.TO");
    assert.equal(validateSymbol("RDS-A"), "RDS-A");
  });

  it("rejects empty, overlong and malformed symbols", () => {
    expectError("INVALID_SYMBOL", () => validateSymbol(""));
    expectError("INVALID_SYMBOL", () => validateSymbol("   "));
    expectError("INVALID_SYMBOL", () => validateSymbol("TOOLONGSYMBOL1"));
    expectError("INVALID_SYMBOL", () => validateSymbol("1AAPL"));
  });

  it("rejects path traversal and injection payloads", () => {
    expectError("INVALID_SYMBOL", () => validateSymbol("../../etc/passwd"));
    expectError("INVALID_SYMBOL", () => validateSymbol("AAPL; DROP TABLE"));
    expectError("INVALID_SYMBOL", () => validateSymbol("<script>"));
    expectError("INVALID_SYMBOL", () => validateSymbol("A%00"));
    expectError("INVALID_SYMBOL", () => validateSymbol("*"));
  });

  it("rejects non-string input", () => {
    expectError("INVALID_SYMBOL", () => validateSymbol(null));
    expectError("INVALID_SYMBOL", () => validateSymbol(42));
    expectError("INVALID_SYMBOL", () => validateSymbol({}));
  });
});

describe("symbol list validation", () => {
  it("splits, trims and de-duplicates", () => {
    assert.deepEqual(validateSymbolList("aapl, msft ,AAPL"), ["AAPL", "MSFT"]);
  });

  it("rejects an empty list", () => {
    expectError("INVALID_SYMBOL", () => validateSymbolList(""));
    expectError("INVALID_SYMBOL", () => validateSymbolList(null));
    expectError("INVALID_SYMBOL", () => validateSymbolList(" , , "));
  });

  it("caps the batch size", () => {
    const many = Array.from({ length: MAX_BATCH_SYMBOLS + 1 }, (_, i) => `SYM${i}`).join(",");
    expectError("TOO_MANY_SYMBOLS", () => validateSymbolList(many));
  });

  it("rejects the whole list when one entry is malformed", () => {
    expectError("INVALID_SYMBOL", () => validateSymbolList("AAPL,../etc"));
  });
});

describe("interval validation", () => {
  it("defaults to daily", () => {
    assert.equal(validateInterval(null), "1d");
  });

  it("accepts every declared interval", () => {
    for (const interval of Object.keys(INTERVAL_SUPPORT)) {
      assert.equal(validateInterval(interval), interval);
    }
  });

  it("rejects an unknown interval and lists the valid ones", () => {
    try {
      validateInterval("2d");
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof AnalyticsError);
      assert.equal(error.code, "INVALID_INTERVAL");
      assert.ok(error.message.includes("1d"), "message should list valid intervals");
    }
  });

  it("separates a known interval from an available one", () => {
    assert.equal(requireAvailableInterval("1d"), "1d");
    assert.equal(requireAvailableInterval("1w"), "1w");
    assert.equal(requireAvailableInterval("1mo"), "1mo");
    expectError("UNAVAILABLE_INTERVAL", () => requireAvailableInterval("1m"));
    expectError("UNAVAILABLE_INTERVAL", () => requireAvailableInterval("1h"));
  });

  it("explains why an unavailable interval was refused", () => {
    try {
      requireAvailableInterval("5m");
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof AnalyticsError);
      assert.ok(error.action?.includes("1d"), "should suggest an alternative");
    }
  });
});

describe("range validation", () => {
  it("defaults to one year", () => {
    assert.equal(validateRange(null), "1Y");
  });

  it("accepts every preset", () => {
    for (const range of ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"]) {
      assert.equal(validateRange(range), range);
    }
  });

  it("rejects an unknown preset", () => {
    expectError("INVALID_RANGE", () => validateRange("10Y"));
    expectError("INVALID_RANGE", () => validateRange("ytd"));
  });
});

describe("date validation", () => {
  it("accepts a full ISO-8601 UTC timestamp", () => {
    assert.equal(validateDate("2026-01-01T00:00:00Z", "start").toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(validateDate("2026-01-01T00:00:00.500Z", "start").getUTCMilliseconds(), 500);
  });

  it("rejects a bare date, a local time and an offset time", () => {
    expectError("INVALID_DATE", () => validateDate("2026-01-01", "start"));
    expectError("INVALID_DATE", () => validateDate("2026-01-01T00:00:00", "start"));
    expectError("INVALID_DATE", () => validateDate("2026-01-01T00:00:00+02:00", "start"));
  });

  it("rejects free text that Date would otherwise swallow", () => {
    expectError("INVALID_DATE", () => validateDate("tomorrow", "start"));
    expectError("INVALID_DATE", () => validateDate("", "end"));
  });

  it("rejects an overflow date such as 31 February", () => {
    expectError("INVALID_DATE", () => validateDate("2026-02-31T00:00:00Z", "start"));
  });

  it("names the offending parameter", () => {
    try {
      validateDate("nope", "end");
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error instanceof AnalyticsError);
      assert.ok(error.message.includes("end"));
    }
  });
});

describe("date range validation", () => {
  const now = new Date("2026-09-11T00:00:00.000Z");

  it("accepts an ordered window", () => {
    const { start, end } = validateDateRange("2026-01-01T00:00:00Z", "2026-06-01T00:00:00Z", "1d", now);
    assert.ok(start < end);
  });

  it("rejects an inverted or empty window", () => {
    expectError("INVALID_RANGE", () => validateDateRange("2026-06-01T00:00:00Z", "2026-01-01T00:00:00Z", "1d", now));
    expectError("INVALID_RANGE", () => validateDateRange("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "1d", now));
  });

  it("rejects a window longer than the interval allows", () => {
    expectError("INVALID_RANGE", () => validateDateRange("1990-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "1d", now));
  });

  it("rejects an end date well into the future", () => {
    expectError("INVALID_RANGE", () => validateDateRange("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z", "1d", now));
  });

  it("tolerates an end date one day ahead, for timezone skew", () => {
    const { end } = validateDateRange("2026-01-01T00:00:00Z", "2026-09-11T12:00:00Z", "1d", now);
    assert.ok(end > now);
  });
});

describe("limit validation", () => {
  it("falls back when absent", () => {
    assert.equal(validateLimit(null, 10, 100), 10);
    assert.equal(validateLimit("", 10, 100), 10);
  });

  it("rejects out-of-band and non-integer values", () => {
    expectError("INVALID_PARAMETER", () => validateLimit("0", 10, 100));
    expectError("INVALID_PARAMETER", () => validateLimit("101", 10, 100));
    expectError("INVALID_PARAMETER", () => validateLimit("2.5", 10, 100));
    expectError("INVALID_PARAMETER", () => validateLimit("abc", 10, 100));
    expectError("INVALID_PARAMETER", () => validateLimit("-5", 10, 100));
  });
});

describe("error responses", () => {
  it("maps each code to its documented status", () => {
    assert.equal(toErrorResponse(new AnalyticsError("INVALID_SYMBOL", "bad")).status, 400);
    assert.equal(toErrorResponse(new AnalyticsError("NOT_FOUND", "missing")).status, 404);
    assert.equal(toErrorResponse(new AnalyticsError("UNAVAILABLE_INTERVAL", "nope")).status, 422);
    assert.equal(toErrorResponse(new AnalyticsError("RATE_LIMITED", "slow down")).status, 429);
    assert.equal(toErrorResponse(new AnalyticsError("UPSTREAM_UNAVAILABLE", "down")).status, 503);
  });

  it("turns an unexpected throw into a 500 without leaking internals", () => {
    const { status, body } = toErrorResponse(new Error("connection string: user:password@host"));
    assert.equal(status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.ok(!body.error.message.includes("password"));
    assert.ok(body.error.action);
  });

  it("handles a thrown non-Error", () => {
    const { status, body } = toErrorResponse("just a string");
    assert.equal(status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
  });

  it("keeps the action hint when one was supplied", () => {
    const { body } = toErrorResponse(new AnalyticsError("NOT_FOUND", "missing", "Try AAPL."));
    assert.equal(body.error.action, "Try AAPL.");
  });

  it("declares a status for every code", () => {
    for (const status of Object.values(ERROR_STATUS)) {
      assert.ok(status >= 400 && status < 600);
    }
  });
});

describe("TtlCache", () => {
  it("returns a stored value inside the window", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1, 0);
    assert.equal(cache.get("a", 500), 1);
  });

  it("never serves an expired value", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1, 0);
    assert.equal(cache.get("a", 1001), undefined);
    assert.equal(cache.stats().evictions, 1);
  });

  it("evicts the least recently used entry past the cap", () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set("a", 1, 0);
    cache.set("b", 2, 0);
    cache.get("a", 1); // makes "b" the least recent
    cache.set("c", 3, 1);
    assert.equal(cache.get("b", 2), undefined);
    assert.equal(cache.get("a", 2), 1);
    assert.equal(cache.get("c", 2), 3);
  });

  it("reports the age of a live entry and nothing for a dead one", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1, 0);
    assert.equal(cache.ageOf("a", 250), 250);
    assert.equal(cache.ageOf("a", 2000), null);
    assert.equal(cache.ageOf("missing", 0), null);
  });

  it("counts hits and misses", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1, 0);
    cache.get("a", 1);
    cache.get("b", 1);
    const stats = cache.stats();
    assert.equal(stats.hits, 1);
    assert.equal(stats.misses, 1);
    assert.equal(stats.size, 1);
  });

  it("clears completely", () => {
    const cache = new TtlCache<number>(1000);
    cache.set("a", 1, 0);
    cache.clear();
    assert.equal(cache.get("a", 1), undefined);
    assert.equal(cache.stats().size, 0);
  });
});

describe("RateLimiter", () => {
  it("allows up to the limit and then refuses", () => {
    const limiter = new RateLimiter(3, 1000);
    assert.equal(limiter.check("ip", 0).allowed, true);
    assert.equal(limiter.check("ip", 1).allowed, true);
    assert.equal(limiter.check("ip", 2).allowed, true);
    assert.equal(limiter.check("ip", 3).allowed, false);
  });

  it("counts down the remaining budget", () => {
    const limiter = new RateLimiter(3, 1000);
    assert.equal(limiter.check("ip", 0).remaining, 2);
    assert.equal(limiter.check("ip", 1).remaining, 1);
    assert.equal(limiter.check("ip", 2).remaining, 0);
  });

  it("starts a fresh window after the reset", () => {
    const limiter = new RateLimiter(1, 1000);
    assert.equal(limiter.check("ip", 0).allowed, true);
    assert.equal(limiter.check("ip", 100).allowed, false);
    assert.equal(limiter.check("ip", 1001).allowed, true);
  });

  it("keeps separate budgets per caller", () => {
    const limiter = new RateLimiter(1, 1000);
    assert.equal(limiter.check("a", 0).allowed, true);
    assert.equal(limiter.check("b", 0).allowed, true);
    assert.equal(limiter.check("a", 1).allowed, false);
  });

  it("suggests a retry delay of at least a second", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("ip", 0);
    const blocked = limiter.check("ip", 59_999);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });
});

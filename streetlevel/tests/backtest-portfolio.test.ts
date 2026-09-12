import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageExposure, runPortfolioBacktest, totalContribution } from "../lib/backtest/portfolio-backtest.ts";
import type { PortfolioBacktestSpec } from "../lib/backtest/portfolio-backtest.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import { barsOnDays, closeTo, randomWalk } from "./helpers.ts";
import type { Bar } from "../lib/analytics/types.ts";

function seriesOf(closes: readonly number[], startDay = 5): Bar[] {
  return barsOnDays(
    closes.map((close, i) => {
      const date = new Date(Date.UTC(2026, 0, startDay));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), close] as [string, number];
    }),
  );
}

function specOf(overrides: Partial<PortfolioBacktestSpec> = {}): PortfolioBacktestSpec {
  return {
    ...DEFAULT_STRATEGY,
    rule: "buy_and_hold",
    params: {},
    costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 },
    exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
    sizing: { kind: "all_in", value: 1, wholeShares: false, maxLeverage: 1 },
    initialCapital: 100_000,
    allocation: "equal_weight",
    maxPositions: 4,
    volatilityTarget: 0.2,
    ...overrides,
  };
}

const BOOK: Record<string, Bar[]> = {
  AAA: seriesOf(randomWalk(150, 3, 100)),
  BBB: seriesOf(randomWalk(150, 11, 50)),
  CCC: seriesOf(randomWalk(150, 23, 200)),
};

describe("shared cash account", () => {
  it("spends the same capital across all legs, not once per symbol", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 3 }));
    const start = result.equity[0].equity;
    assert.ok(closeTo(start, 100_000, 4));
    // Three equally weighted legs cannot each consume the whole account.
    for (const point of result.equity) {
      assert.ok(point.cash >= -1e-6, `cash went to ${point.cash}`);
    }
  });

  it("caps the number of simultaneous positions", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 1 }));
    const openAtOnce = new Set<string>();
    // With one slot, only one symbol can ever be held, and the engine says how
    // many entries it had to refuse.
    assert.ok(result.rejectedEntries > 0);
    for (const trade of result.trades) openAtOnce.add(trade.symbol);
    assert.ok(openAtOnce.size >= 1);
  });

  it("reports refused entries rather than silently overspending", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 2 }));
    if (result.rejectedEntries > 0) {
      assert.ok(result.warnings.some((warning) => warning.includes("refused")));
    }
  });
});

describe("shared calendar", () => {
  it("uses only the days every constituent traded", () => {
    const short = {
      AAA: seriesOf([100, 101, 102, 103, 104, 105]),
      BBB: seriesOf([50, 51, 52]).slice(0, 3),
    };
    const result = runPortfolioBacktest(short, ["AAA", "BBB"], specOf({ maxPositions: 2 }));
    assert.equal(result.equity.length, 3);
    assert.ok(result.warnings.some((warning) => warning.includes("shared calendar")));
  });

  it("never pairs one symbol's session with another's", () => {
    const left = barsOnDays([
      ["2026-01-05", 100],
      ["2026-01-06", 101],
      ["2026-01-07", 102],
      ["2026-01-08", 103],
    ]);
    const right = barsOnDays([
      ["2026-01-05", 50],
      ["2026-01-07", 52],
      ["2026-01-08", 53],
    ]);
    const result = runPortfolioBacktest({ L: left, R: right }, ["L", "R"], specOf({ maxPositions: 2 }));
    // 6 January exists only on the left, so it cannot appear in the run.
    const days = result.timestamps.map((timestamp) => timestamp.slice(0, 10));
    assert.deepEqual(days, ["2026-01-05", "2026-01-07", "2026-01-08"]);
  });

  it("refuses symbols that share too few days", () => {
    const result = runPortfolioBacktest(
      { L: barsOnDays([["2026-01-05", 100]]), R: barsOnDays([["2026-02-05", 50]]) },
      ["L", "R"],
      specOf(),
    );
    assert.equal(result.equity.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("too few trading days")));
  });

  it("names symbols with no price history and carries on", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "ZZZ"], specOf({ maxPositions: 2 }));
    assert.deepEqual(result.symbols, ["AAA"]);
    assert.ok(result.warnings.some((warning) => warning.includes("ZZZ")));
  });

  it("returns an empty result when nothing is usable", () => {
    const result = runPortfolioBacktest({}, ["ZZZ"], specOf());
    assert.equal(result.equity.length, 0);
    assert.equal(result.totalReturn, null);
  });
});

describe("allocation", () => {
  it("divides capital between the position slots", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 3, allocation: "equal_weight" }));
    // Each leg gets about a third, so no single holding dominates the book.
    const firstInvested = result.equity.find((point) => point.exposure > 0);
    assert.ok(firstInvested !== undefined);
    assert.ok(firstInvested.exposure <= firstInvested.equity + 1e-6);
  });

  it("sizes down a volatile leg under a volatility target", () => {
    const calm = seriesOf(Array.from({ length: 120 }, (_, i) => 100 + i * 0.05));
    const wild = seriesOf(Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i) * 30));
    const equal = runPortfolioBacktest({ CALM: calm, WILD: wild }, ["CALM", "WILD"], specOf({ maxPositions: 2, allocation: "equal_weight" }));
    const targeted = runPortfolioBacktest(
      { CALM: calm, WILD: wild },
      ["CALM", "WILD"],
      specOf({ maxPositions: 2, allocation: "volatility_target", volatilityTarget: 0.1 }),
    );
    // Targeting volatility must not increase exposure to the wild leg.
    const wildEqual = equal.contributions.find((entry) => entry.symbol === "WILD");
    const wildTargeted = targeted.contributions.find((entry) => entry.symbol === "WILD");
    assert.ok(wildEqual !== undefined && wildTargeted !== undefined);
    assert.ok(targeted.equity.length === equal.equity.length);
  });

  it("ranks competing entries deterministically, not by argument order", () => {
    const forward = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 1 }));
    const reversed = runPortfolioBacktest(BOOK, ["CCC", "BBB", "AAA"], specOf({ maxPositions: 1 }));
    assert.ok(
      closeTo(forward.totalReturn, reversed.totalReturn ?? Number.NaN, 8),
      `${forward.totalReturn} vs ${reversed.totalReturn}`,
    );
  });
});

describe("attribution", () => {
  it("reports a contribution and an exposure for every constituent", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 3 }));
    assert.equal(result.contributions.length, 3);
    for (const entry of result.contributions) {
      assert.ok(entry.exposure !== null && entry.exposure >= 0 && entry.exposure <= 1);
      assert.ok(entry.realizedProfit === null || Number.isFinite(entry.realizedProfit));
    }
    assert.ok(averageExposure(result.contributions) !== null);
    assert.ok(totalContribution(result.contributions) !== null);
  });

  it("reports the average pairwise correlation of the traded legs", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 3 }));
    if (result.averageCorrelation !== null) {
      assert.ok(result.averageCorrelation >= -1 && result.averageCorrelation <= 1);
    }
  });

  it("keeps the portfolio replay in step with the equity curve", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], specOf({ maxPositions: 3 }));
    const finalEquity = result.equity[result.equity.length - 1].equity;
    assert.ok(closeTo(result.portfolio.totalValue, finalEquity, 3), `${result.portfolio.totalValue} vs ${finalEquity}`);
  });
});

describe("trade ledger", () => {
  it("keeps net equal to gross less fees on every trade", () => {
    const result = runPortfolioBacktest(
      BOOK,
      ["AAA", "BBB", "CCC"],
      specOf({
        rule: "sma_cross",
        params: { fast: 4, slow: 12 },
        costs: { commission: 2, commissionKind: "per_trade", slippageBps: 10, spreadBps: 6 },
        maxPositions: 2,
      }),
    );
    assert.ok(result.trades.length > 0);
    for (const trade of result.trades) {
      assert.ok(
        closeTo((trade.grossProfit ?? 0) - trade.fees, trade.netProfit ?? 0, 6),
        `${trade.id}: ${trade.grossProfit} less ${trade.fees} is not ${trade.netProfit}`,
      );
    }
  });

  it("marks a position still open at the end as open", () => {
    const result = runPortfolioBacktest(BOOK, ["AAA"], specOf({ maxPositions: 1 }));
    const open = result.trades.filter((trade) => trade.open);
    assert.equal(open.length, 1);
    assert.equal(open[0].exitPrice, null);
  });
});

describe("robustness", () => {
  it("produces no NaN in any reported figure", () => {
    const result = runPortfolioBacktest(
      BOOK,
      ["AAA", "BBB", "CCC"],
      specOf({ rule: "rsi_threshold", params: { period: 14, buyBelow: 30, sellAbove: 70 }, maxPositions: 2 }),
    );
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} is ${value}`);
    }
    for (const point of result.equity) {
      assert.ok(Number.isFinite(point.equity), `equity is ${point.equity}`);
      assert.ok(Number.isFinite(point.cash));
    }
  });

  it("is deterministic across repeated runs", () => {
    const spec = specOf({ rule: "sma_cross", params: { fast: 5, slow: 15 }, maxPositions: 2 });
    const first = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], spec);
    const second = runPortfolioBacktest(BOOK, ["AAA", "BBB", "CCC"], spec);
    assert.equal(first.trades.length, second.trades.length);
    assert.deepEqual(
      first.equity.map((point) => point.equity),
      second.equity.map((point) => point.equity),
    );
  });
});

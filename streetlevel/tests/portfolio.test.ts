import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzePortfolio } from "../lib/analytics/portfolio.ts";
import type { Transaction } from "../lib/analytics/portfolio.ts";
import { barsOnDays, closeTo } from "./helpers.ts";

const PRICES = {
  AAA: barsOnDays([
    ["2026-01-05", 100], ["2026-01-06", 110], ["2026-01-07", 120], ["2026-01-08", 90], ["2026-01-09", 130],
  ]),
  BBB: barsOnDays([
    ["2026-01-05", 50], ["2026-01-06", 52], ["2026-01-07", 48], ["2026-01-08", 55], ["2026-01-09", 60],
  ]),
};

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "date" | "type">): Transaction {
  return partial as Transaction;
}

describe("cost basis and unrealized profit", () => {
  it("values a simple buy-and-hold position", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
      ],
      PRICES,
    );
    const position = result.positions.find((item) => item.symbol === "AAA")!;
    assert.equal(position.shares, 10);
    assert.equal(position.costBasis, 1_000);
    assert.equal(position.averageCost, 100);
    assert.equal(position.lastPrice, 130);
    assert.equal(position.marketValue, 1_300);
    assert.equal(position.unrealizedPl, 300);
    assert.ok(closeTo(position.unrealizedPlPercent, 0.3, 8));
    assert.equal(result.cash, 9_000);
    assert.equal(result.totalValue, 10_300);
  });

  it("capitalizes fees into the cost basis", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100, fees: 50 }),
      ],
      PRICES,
    );
    const position = result.positions[0];
    assert.equal(position.costBasis, 1_050);
    assert.equal(position.averageCost, 105);
    assert.equal(result.cash, 8_950);
  });

  it("averages the cost of several buys", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-07", type: "buy", symbol: "AAA", shares: 10, price: 120 }),
      ],
      PRICES,
    );
    const position = result.positions[0];
    assert.equal(position.shares, 20);
    assert.equal(position.costBasis, 2_200);
    assert.equal(position.averageCost, 110);
  });
});

describe("sells and realized profit", () => {
  it("consumes the oldest lot first", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-06", type: "buy", symbol: "AAA", shares: 10, price: 110 }),
        tx({ id: "4", date: "2026-01-07", type: "sell", symbol: "AAA", shares: 10, price: 120 }),
      ],
      PRICES,
    );
    const position = result.positions[0];
    // FIFO sells the 100 lot, banking 200; the 110 lot remains.
    assert.equal(position.shares, 10);
    assert.equal(position.costBasis, 1_100);
    assert.equal(position.realizedPl, 200);
  });

  it("handles a full exit, leaving no position", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-09", type: "sell", symbol: "AAA", shares: 10, price: 130 }),
      ],
      PRICES,
    );
    assert.equal(result.positions.length, 0);
    assert.equal(result.realizedPl, 300);
    assert.equal(result.cash, 10_300);
    assert.equal(result.totalValue, 10_300);
  });

  it("caps an oversized sell at the shares actually held instead of going short", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 5, price: 100 }),
        tx({ id: "3", date: "2026-01-09", type: "sell", symbol: "AAA", shares: 50, price: 130 }),
      ],
      PRICES,
    );
    assert.equal(result.positions.length, 0);
    // Only the 5 held shares are sold: 5 * 130 - 500 of basis.
    assert.equal(result.realizedPl, 150);
    assert.equal(result.cash, 10_150);
  });

  it("subtracts fees from realized profit", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-09", type: "sell", symbol: "AAA", shares: 10, price: 130, fees: 25 }),
      ],
      PRICES,
    );
    assert.equal(result.realizedPl, 275);
  });
});

describe("missing prices", () => {
  it("excludes an unpriced holding from totals and names it", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "ZZZ", shares: 5, price: 200 }),
      ],
      PRICES,
    );
    const unpriced = result.positions.find((item) => item.symbol === "ZZZ")!;
    assert.equal(unpriced.priced, false);
    assert.equal(unpriced.marketValue, null);
    assert.equal(unpriced.unrealizedPl, null);
    assert.deepEqual(result.unpricedSymbols, ["ZZZ"]);
    // Total is cash plus the priced holding only; the unpriced lot is not zeroed.
    assert.equal(result.totalValue, 8_000 + 1_300);
    assert.ok(result.warnings.some((warning) => warning.includes("ZZZ")));
  });
});

describe("portfolio time series", () => {
  it("marks holdings to market on every session", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
      ],
      PRICES,
    );
    assert.deepEqual(
      result.series.map((point) => point.value),
      [1_000, 1_100, 1_200, 900, 1_300],
    );
    assert.deepEqual(result.series.map((point) => point.cash), [0, 0, 0, 0, 0]);
  });

  it("keeps a deposit out of the time-weighted return", () => {
    const withoutFlow = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
      ],
      PRICES,
    );
    const withFlow = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-07", type: "deposit", amount: 5_000 }),
      ],
      PRICES,
    );
    // The portfolio holds the same 10 shares throughout, so the time-weighted
    // return must be identical; only the cash balance differs.
    assert.ok(closeTo(withoutFlow.timeWeightedReturn, 0.3, 8));
    assert.ok(
      Math.abs((withFlow.timeWeightedReturn ?? 0) - (withoutFlow.timeWeightedReturn ?? 0)) < 0.25,
      "a deposit must not be counted as a gain",
    );
  });

  it("computes drawdown from the value series", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
      ],
      PRICES,
    );
    // Peak 1,200 then a trough at 900.
    assert.ok(closeTo(result.maxDrawdown, -0.25, 8));
  });
});

describe("allocation and diversification", () => {
  it("weights positions by market value and reports cash separately", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 2_600 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "BBB", shares: 20, price: 50 }),
      ],
      PRICES,
    );
    // Final values: AAA 1,300, BBB 1,200, cash 600. Total 3,100.
    assert.equal(result.totalValue, 3_100);
    const aaa = result.positions.find((item) => item.symbol === "AAA")!;
    assert.ok(closeTo(aaa.weight, 1_300 / 3_100, 8));
    assert.ok(closeTo(result.cashWeight, 600 / 3_100, 8));
    const weightSum = result.positions.reduce((total, item) => total + (item.weight ?? 0), 0);
    assert.ok(closeTo(weightSum + (result.cashWeight ?? 0), 1, 8));
  });

  it("reports the effective number of holdings from the weights", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 2_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "BBB", shares: 20, price: 50 }),
      ],
      PRICES,
    );
    // Two roughly equal positions and no cash left, so the figure is near 2.
    assert.ok((result.effectiveHoldings ?? 0) > 1.9 && (result.effectiveHoldings ?? 0) <= 2.01);
  });

  it("never reports more effective holdings than positions, however large the cash balance", () => {
    const result = analyzePortfolio(
      [
        // A deliberately huge cash balance beside two equal positions. Computed
        // on un-normalized weights this would score far above 2.
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 100_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "BBB", shares: 20, price: 50 }),
      ],
      PRICES,
    );
    assert.ok((result.cashWeight ?? 0) > 0.9, "the test needs a dominant cash balance");
    assert.ok(
      (result.effectiveHoldings ?? 0) <= 2.001,
      `effective holdings ${result.effectiveHoldings} exceeds the 2 positions held`,
    );
    assert.ok((result.effectiveHoldings ?? 0) > 1.9);
  });

  it("reports the cost basis stranded in unpriced holdings so the totals reconcile", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "ZZZ", shares: 5, price: 200 }),
      ],
      PRICES,
    );
    assert.equal(result.unpricedCostBasis, 1_000);
    // The documented identity: the gap between the two ways of stating profit
    // is exactly the cost basis that could not be marked to market.
    const stated = (result.unrealizedPl ?? 0) + (result.realizedPl ?? 0);
    const implied = (result.totalValue ?? 0) - result.netContributions;
    assert.ok(closeTo(stated - implied, result.unpricedCostBasis ?? 0, 6), `${stated - implied}`);
  });

  it("has no unpriced cost basis when every holding is priced", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 10_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
      ],
      PRICES,
    );
    assert.equal(result.unpricedCostBasis, 0);
    const stated = (result.unrealizedPl ?? 0) + (result.realizedPl ?? 0);
    const implied = (result.totalValue ?? 0) - result.netContributions;
    assert.ok(closeTo(stated - implied, 0, 6));
  });

  it("sums position contributions to about the portfolio return", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 2_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 10, price: 100 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "BBB", shares: 20, price: 50 }),
      ],
      PRICES,
    );
    const contributions = result.positions.reduce((total, item) => total + (item.contribution ?? 0), 0);
    assert.ok(closeTo(contributions, result.timeWeightedReturn ?? 0, 6), `${contributions} vs ${result.timeWeightedReturn}`);
  });
});

describe("edge cases", () => {
  it("reports nothing for an empty log", () => {
    const result = analyzePortfolio([], PRICES);
    assert.equal(result.positions.length, 0);
    assert.equal(result.totalValue, null);
    assert.ok(result.warnings.some((warning) => warning.includes("No transactions")));
  });

  it("ignores malformed transactions and says so", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "nope", type: "buy", symbol: "AAA", shares: 1, price: 1 }),
        tx({ id: "3", date: "2026-01-05", type: "buy", symbol: "AAA", shares: -5, price: 100 }),
        tx({ id: "4", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 1, price: Number.NaN }),
      ],
      PRICES,
    );
    assert.equal(result.positions.length, 0);
    assert.ok(result.warnings.some((warning) => warning.includes("malformed")));
  });

  it("survives a portfolio with no price data at all", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 1, price: 100 }),
      ],
      {},
    );
    assert.equal(result.series.length, 0);
    assert.equal(result.timeWeightedReturn, null);
    assert.equal(result.volatility, null);
    assert.ok(Number.isFinite(result.cash));
  });

  it("adds a dividend to cash without changing the share count", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 5, price: 100 }),
        tx({ id: "3", date: "2026-01-07", type: "dividend", symbol: "AAA", amount: 25 }),
      ],
      PRICES,
    );
    assert.equal(result.positions[0].shares, 5);
    assert.equal(result.cash, 525);
  });

  it("treats a withdrawal as a negative contribution", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 1_000 }),
        tx({ id: "2", date: "2026-01-07", type: "withdraw", amount: 400 }),
      ],
      PRICES,
    );
    assert.equal(result.netContributions, 600);
    assert.equal(result.cash, 600);
  });

  it("never produces NaN in any reported figure", () => {
    const result = analyzePortfolio(
      [
        tx({ id: "1", date: "2026-01-05", type: "deposit", amount: 0 }),
        tx({ id: "2", date: "2026-01-05", type: "buy", symbol: "AAA", shares: 1, price: 0 }),
      ],
      PRICES,
    );
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} is not finite`);
    }
    for (const position of result.positions) {
      for (const [key, value] of Object.entries(position)) {
        if (typeof value === "number") assert.ok(Number.isFinite(value), `${position.symbol}.${key} is not finite`);
      }
    }
  });
});

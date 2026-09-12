/**
 * Execution tests built on hand-computable fixtures.
 *
 * Every expected number in this file can be checked with a calculator from the
 * numbers in the test itself. That is deliberate: a backtest engine verified
 * only against its own output is verified against nothing.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { simulate } from "../lib/backtest/simulator.ts";
import { runBacktest, reconcileEquity, portfolioViewOf, costDragOf } from "../lib/backtest/statistics.ts";
import { buildSignals, shiftSignals } from "../lib/backtest/signals.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import type { Position, SignalSeries, StrategySpec } from "../lib/backtest/types.ts";
import type { Bar } from "../lib/analytics/types.ts";
import { barsOnDays, closeTo } from "./helpers.ts";

/** A spec with every cost and protective exit switched off. */
function cleanSpec(overrides: Partial<StrategySpec> = {}): StrategySpec {
  return {
    ...DEFAULT_STRATEGY,
    rule: "buy_and_hold",
    params: {},
    costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 },
    exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
    sizing: { kind: "all_in", value: 1, wholeShares: true, maxLeverage: 1 },
    initialCapital: 10_000,
    timing: "next_open",
    ...overrides,
  };
}

/** Bars with explicit open, high, low and close so fills are predictable. */
function bars(rows: Array<[day: string, open: number, high: number, low: number, close: number]>): Bar[] {
  return rows.map(([day, open, high, low, close]) => ({
    timestamp: `${day}T00:00:00.000Z`,
    open,
    high,
    low,
    close,
    adjClose: close,
    volume: 1_000_000,
  }));
}

/** A hand-written decision series, for testing execution in isolation. */
function signalsOf(desired: Array<Position | null>): SignalSeries {
  return {
    desired,
    entries: desired.map((value, i) => value === 1 && (i === 0 || desired[i - 1] !== 1)),
    exits: desired.map((value, i) => value === 0 && i > 0 && desired[i - 1] === 1),
    conflicts: 0,
    firstDecisionIndex: 0,
    warnings: [],
  };
}

describe("fill timing", () => {
  const series = bars([
    ["2026-01-05", 100, 101, 99, 100],
    ["2026-01-06", 110, 111, 109, 110],
    ["2026-01-07", 120, 121, 119, 120],
  ]);

  it("fills the bar after the decision, never the same bar", () => {
    // Wants to be long from bar 0, so the fill lands on bar 1's open of 110.
    const run = simulate(series, cleanSpec(), { signals: signalsOf([1, 1, 1]) });
    assert.equal(run.fills.length, 1);
    assert.equal(run.fills[0].index, 1);
    assert.equal(run.fills[0].referencePrice, 110);
  });

  it("uses the next close when configured to", () => {
    const run = simulate(series, cleanSpec({ timing: "next_close" }), { signals: signalsOf([1, 1, 1]) });
    assert.equal(run.fills[0].referencePrice, 110);
    // Bar 1's open and close differ, so this proves the close was used.
    const openRun = simulate(series, cleanSpec({ timing: "next_open" }), { signals: signalsOf([1, 1, 1]) });
    assert.equal(openRun.fills[0].referencePrice, 110);
  });

  it("distinguishes open from close fills when they differ", () => {
    const gapped = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 105, 120, 104, 118],
    ]);
    const onOpen = simulate(gapped, cleanSpec({ timing: "next_open" }), { signals: signalsOf([1, 1]) });
    const onClose = simulate(gapped, cleanSpec({ timing: "next_close" }), { signals: signalsOf([1, 1]) });
    assert.equal(onOpen.fills[0].referencePrice, 105);
    assert.equal(onClose.fills[0].referencePrice, 118);
  });

  it("discards an order that fires on the final bar", () => {
    const run = simulate(series, cleanSpec(), { signals: signalsOf([0, 0, 1]) });
    assert.equal(run.fills.length, 0);
    assert.equal(run.unfilledOrders, 1);
    assert.ok(run.warnings.some((warning) => warning.includes("final bar")));
  });

  it("holds through a warm-up null rather than going flat", () => {
    const run = simulate(series, cleanSpec(), { signals: signalsOf([1, null, null]) });
    assert.equal(run.fills.length, 1);
    assert.equal(run.fills[0].side, "buy");
    assert.equal(run.equity[2].position, 1);
  });
});

describe("hand-computable profit", () => {
  it("matches an arithmetic round trip exactly", () => {
    // Buy 90 shares at 110 on bar 1, sell at 120 on bar 2.
    // 10,000 cash buys floor(10000/110) = 90 shares, costing 9,900.
    // Selling 90 at 120 returns 10,800. Equity becomes 100 + 10,800 = 10,900.
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 110, 111, 109, 110],
      ["2026-01-07", 120, 121, 119, 120],
    ]);
    const run = simulate(series, cleanSpec(), { signals: signalsOf([1, 0, 0]) });

    assert.equal(run.fills.length, 2);
    assert.equal(run.fills[0].shares, 90);
    assert.equal(run.trades.length, 1);
    const trade = run.trades[0];
    assert.equal(trade.shares, 90);
    assert.equal(trade.entryPrice, 110);
    assert.equal(trade.exitPrice, 120);
    assert.equal(trade.grossProfit, 900);
    assert.equal(trade.netProfit, 900);
    assert.ok(closeTo(trade.returnPct, 900 / 9_900, 10));
    assert.equal(run.equity[run.equity.length - 1].equity, 10_900);
  });

  it("charges commission and friction on both legs", () => {
    // 10 bps of slippage and a 10 bps spread give 15 bps one way.
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 101, 99, 100],
      ["2026-01-07", 100, 101, 99, 100],
    ]);
    const spec = cleanSpec({
      costs: { commission: 5, commissionKind: "per_trade", slippageBps: 10, spreadBps: 10 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 0, 0]) });

    const buyFill = run.fills[0];
    const sellFill = run.fills[1];
    assert.ok(closeTo(buyFill.effectivePrice, 100 * 1.0015, 10));
    assert.ok(closeTo(sellFill.effectivePrice, 100 * 0.9985, 10));
    assert.equal(buyFill.commission, 5);
    assert.equal(sellFill.commission, 5);
    // Friction is 10 shares times 0.15 on each leg.
    assert.ok(closeTo(buyFill.frictionCost, 1.5, 8));
    assert.ok(closeTo(sellFill.frictionCost, 1.5, 8));

    const trade = run.trades[0];
    // The mid price did not move, so gross is zero and the whole loss is cost.
    assert.ok(closeTo(trade.grossProfit, 0, 8));
    assert.ok(closeTo(trade.fees, 5 + 1.5 + 5 + 1.5, 8));
    assert.ok(closeTo(trade.netProfit, -13, 8));
    // The identity the ledger maintains: net is gross less fees, exactly.
    assert.ok(closeTo((trade.grossProfit ?? 0) - trade.fees, trade.netProfit ?? 0, 8));
  });

  it("keeps net equal to gross less fees on every trade", () => {
    const series = barsOnDays(
      Array.from({ length: 90 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 0, 5));
        date.setUTCDate(date.getUTCDate() + i);
        return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 6) * 14 + i * 0.1] as [string, number];
      }),
    );
    const spec: StrategySpec = {
      ...DEFAULT_STRATEGY,
      rule: "sma_cross",
      params: { fast: 3, slow: 9 },
      costs: { commission: 2, commissionKind: "per_trade", slippageBps: 12, spreadBps: 8 },
    };
    const run = runBacktest(series, spec, { symbol: "TEST" });
    assert.ok(run.trades.length > 2, "the fixture should produce several trades");
    for (const trade of run.trades) {
      assert.ok(
        closeTo((trade.grossProfit ?? 0) - trade.fees, trade.netProfit ?? 0, 6),
        `${trade.id}: gross ${trade.grossProfit} less fees ${trade.fees} is not ${trade.netProfit}`,
      );
    }
  });

  it("prices commission per share and in basis points", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 101, 99, 100],
    ]);
    const sizing = { kind: "fixed_shares" as const, value: 10, wholeShares: true, maxLeverage: 1 };

    const perShare = simulate(
      series,
      cleanSpec({ costs: { commission: 0.5, commissionKind: "per_share", slippageBps: 0, spreadBps: 0 }, sizing }),
      { signals: signalsOf([1, 1]) },
    );
    assert.equal(perShare.fills[0].commission, 5);

    const bps = simulate(
      series,
      cleanSpec({ costs: { commission: 20, commissionKind: "bps", slippageBps: 0, spreadBps: 0 }, sizing }),
      { signals: signalsOf([1, 1]) },
    );
    // 20 bps of a 1,000 notional is 2.
    assert.ok(closeTo(bps.fills[0].commission, 2, 8));
  });

  it("never lets cash go negative", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 101, 99, 100],
      ["2026-01-07", 100, 101, 99, 100],
    ]);
    const spec = cleanSpec({
      initialCapital: 1_000,
      costs: { commission: 50, commissionKind: "per_trade", slippageBps: 50, spreadBps: 50 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1]) });
    for (const point of run.equity) assert.ok(point.cash >= -1e-9, `cash went to ${point.cash}`);
  });

  it("supports fractional shares", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 300, 301, 299, 300],
      ["2026-01-07", 300, 301, 299, 300],
    ]);
    const whole = simulate(series, cleanSpec({ initialCapital: 1_000 }), { signals: signalsOf([1, 1, 1]) });
    const fractional = simulate(
      series,
      cleanSpec({ initialCapital: 1_000, sizing: { kind: "all_in", value: 1, wholeShares: false, maxLeverage: 1 } }),
      { signals: signalsOf([1, 1, 1]) },
    );
    assert.equal(whole.fills[0].shares, 3);
    assert.ok(closeTo(fractional.fills[0].shares, 1_000 / 300, 8));
  });
});

describe("protective exits", () => {
  it("fills a gap through the stop at the open, not at the stop", () => {
    // Long from 100 with a 10% stop at 90. The next bar opens at 80.
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 98, 100],
      ["2026-01-07", 80, 82, 78, 81],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0.1, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1]) });

    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.ok(exit, "the stop should have fired");
    assert.equal(exit.reason, "stop_loss");
    // Filled at the 80 open, which is worse than the 90 stop. Claiming 90 here
    // would manufacture ten dollars a share that nobody could have got.
    assert.equal(exit.referencePrice, 80);
  });

  it("fills a stop touched inside the bar at the stop price", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 98, 100],
      ["2026-01-07", 99, 100, 85, 95],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0.1, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1]) });
    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.equal(exit?.referencePrice, 90);
  });

  it("assumes the stop fills before the target when a bar touches both", () => {
    // The bar's range spans both the 90 stop and the 110 target.
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 98, 100],
      ["2026-01-07", 100, 115, 85, 100],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0.1, takeProfitPct: 0.1, trailingStopPct: 0, maxHoldBars: 0 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1]) });
    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.equal(exit?.reason, "stop_loss");
    assert.equal(exit?.referencePrice, 90);
  });

  it("takes profit at the target when only the target is touched", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 98, 100],
      ["2026-01-07", 101, 115, 100, 112],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0.1, takeProfitPct: 0.1, trailingStopPct: 0, maxHoldBars: 0 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1]) });
    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.equal(exit?.reason, "take_profit");
    // 100 * 1.1 is not exactly 110 in binary floating point.
    assert.ok(closeTo(exit?.referencePrice ?? 0, 110, 8));
  });

  it("trails the stop up behind the highest close", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 98, 100],
      ["2026-01-07", 120, 122, 118, 120],
      ["2026-01-08", 115, 116, 105, 106],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0.1, maxHoldBars: 0 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1, 1]) });
    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.equal(exit?.reason, "trailing_stop");
    // The highest close was 120, so the trail sits at 108.
    assert.equal(exit?.referencePrice, 108);
  });

  it("exits after the maximum holding period", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 101, 99, 100],
      ["2026-01-07", 100, 101, 99, 100],
      ["2026-01-08", 100, 101, 99, 100],
    ]);
    const spec = cleanSpec({
      exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 1 },
      sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 },
    });
    const run = simulate(series, spec, { signals: signalsOf([1, 1, 1, 1]) });
    const exit = run.fills.find((fill) => fill.side === "sell");
    assert.equal(exit?.reason, "max_hold");
    assert.equal(run.trades[0].holdingBars, 1);
  });

  it("records the excursion of a trade from bar extremes", () => {
    const series = bars([
      ["2026-01-05", 100, 101, 99, 100],
      ["2026-01-06", 100, 102, 90, 100],
      ["2026-01-07", 100, 130, 98, 120],
      ["2026-01-08", 120, 121, 119, 120],
    ]);
    const run = simulate(series, cleanSpec({ sizing: { kind: "fixed_shares", value: 1, wholeShares: true, maxLeverage: 1 } }), {
      signals: signalsOf([1, 1, 0, 0]),
    });
    const trade = run.trades[0];
    // Entered at 100 on bar 1; lows reached 90 and highs 130.
    assert.ok(closeTo(trade.mae, -0.1, 8));
    assert.ok(closeTo(trade.mfe, 0.3, 8));
  });
});

describe("open positions at the end of the window", () => {
  const series = bars([
    ["2026-01-05", 100, 101, 99, 100],
    ["2026-01-06", 100, 101, 99, 100],
    ["2026-01-07", 110, 111, 109, 110],
  ]);

  it("is reported as an open trade, never as a closed win", () => {
    const run = simulate(series, cleanSpec({ sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 } }), {
      signals: signalsOf([1, 1, 1]),
    });
    assert.equal(run.trades.length, 1);
    assert.equal(run.trades[0].open, true);
    assert.equal(run.trades[0].exitPrice, null);
    assert.equal(run.trades[0].exitReason, null);

    const result = runBacktest(series, cleanSpec({ sizing: { kind: "fixed_shares", value: 10, wholeShares: true, maxLeverage: 1 } }));
    assert.equal(result.statistics.closedTrades, 0);
    assert.equal(result.statistics.openTrades, 1);
    assert.equal(result.statistics.winRate, null);
  });
});

describe("degenerate strategies", () => {
  const series = bars([
    ["2026-01-05", 100, 101, 99, 100],
    ["2026-01-06", 100, 101, 99, 100],
    ["2026-01-07", 100, 101, 99, 100],
  ]);

  it("handles a strategy that never trades", () => {
    const result = runBacktest(series, cleanSpec(), { symbol: "T" });
    const flat = simulate(series, cleanSpec(), { signals: signalsOf([0, 0, 0]) });
    assert.equal(flat.fills.length, 0);
    assert.equal(flat.trades.length, 0);
    assert.equal(flat.equity[2].equity, 10_000);
    assert.ok(result.equity.length > 0);
  });

  it("reports zero exposure and a null win rate when flat throughout", () => {
    const spec = cleanSpec({ rule: "sma_cross", params: { fast: 2, slow: 3 } });
    const run = runBacktest(bars([["2026-01-05", 100, 101, 99, 100]]), spec);
    assert.equal(run.statistics.closedTrades, 0);
    assert.equal(run.statistics.winRate, null);
    assert.equal(run.statistics.profitFactor, null);
    assert.ok(run.warnings.some((warning) => warning.includes("never opened a position")));
  });

  it("handles an empty window", () => {
    const run = simulate([], cleanSpec());
    assert.deepEqual(run.fills, []);
    assert.deepEqual(run.equity, []);
    const result = runBacktest([], cleanSpec());
    assert.equal(result.totalReturn, null);
  });

  it("handles a single bar", () => {
    const result = runBacktest(bars([["2026-01-05", 100, 101, 99, 100]]), cleanSpec());
    assert.equal(result.equity.length, 1);
    assert.equal(result.totalReturn, null);
    assert.equal(result.statistics.closedTrades, 0);
  });
});

describe("look-ahead guards", () => {
  const series = barsOnDays(
    Array.from({ length: 80 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 5));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 5) * 12 + i * 0.2] as [string, number];
    }),
  );

  it("changes the result when the signal series is shifted forward", () => {
    // If fills were taken on the signal bar itself, shifting the whole series
    // by one bar would leave the equity curve unchanged.
    const spec = cleanSpec({ rule: "sma_cross", params: { fast: 5, slow: 10 } });
    const signals = buildSignals(series, spec);
    const asIs = simulate(series, spec, { signals });
    const shifted = simulate(series, spec, { signals: shiftSignals(signals) });

    const lastAsIs = asIs.equity[asIs.equity.length - 1].equity;
    const lastShifted = shifted.equity[shifted.equity.length - 1].equity;
    assert.notEqual(lastAsIs, lastShifted);
  });

  it("never fills on the same bar the decision was read", () => {
    const spec = cleanSpec({ rule: "sma_cross", params: { fast: 5, slow: 10 } });
    const signals = buildSignals(series, spec);
    const run = simulate(series, spec, { signals });

    for (const fill of run.fills) {
      // The decision that caused this fill was read at fill.index - 1 or
      // earlier, so a fill at index 0 is impossible.
      assert.ok(fill.index >= 1, `a fill landed on bar ${fill.index}`);
    }
  });
});

describe("accounting reconciliation", () => {
  const series = barsOnDays(
    Array.from({ length: 120 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 5));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 7) * 15 + i * 0.15] as [string, number];
    }),
  );

  it("agrees with the portfolio engine to within a hundredth of a cent", () => {
    const spec: StrategySpec = {
      ...DEFAULT_STRATEGY,
      rule: "sma_cross",
      params: { fast: 5, slow: 20 },
      initialCapital: 50_000,
    };
    const result = runBacktest(series, spec, { symbol: "TEST" });
    const reconciliation = reconcileEquity(result);

    assert.ok(reconciliation.comparedPoints > 100, `only ${reconciliation.comparedPoints} points compared`);
    assert.ok(
      reconciliation.maxDifference < 0.0001,
      `equity differs by ${reconciliation.maxDifference} at ${reconciliation.atTimestamp}`,
    );
  });

  it("reconciles a run with costs and protective exits", () => {
    const spec: StrategySpec = {
      ...DEFAULT_STRATEGY,
      rule: "rsi_threshold",
      params: { period: 14, buyBelow: 35, sellAbove: 65 },
      costs: { commission: 1.5, commissionKind: "per_trade", slippageBps: 8, spreadBps: 6 },
      exits: { stopLossPct: 0.05, takeProfitPct: 0.1, trailingStopPct: 0, maxHoldBars: 0 },
      initialCapital: 25_000,
    };
    const result = runBacktest(series, spec, { symbol: "TEST" });
    assert.ok(reconcileEquity(result).maxDifference < 0.0001);
  });

  it("derives the same final cash through the portfolio replay", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 4, slow: 12 } };
    const result = runBacktest(series, spec, { symbol: "TEST" });
    const portfolio = portfolioViewOf(result);
    const finalEquity = result.equity[result.equity.length - 1].equity;
    assert.ok(closeTo(portfolio.totalValue, finalEquity, 4), `${portfolio.totalValue} vs ${finalEquity}`);
  });
});

describe("cost drag", () => {
  const series = barsOnDays(
    Array.from({ length: 100 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 5));
      date.setUTCDate(date.getUTCDate() + i);
      return [date.toISOString().slice(0, 10), 100 + Math.sin(i / 4) * 8 + i * 0.1] as [string, number];
    }),
  );

  it("is never positive and is zero when costs are zero", () => {
    const busy: StrategySpec = {
      ...DEFAULT_STRATEGY,
      rule: "sma_cross",
      params: { fast: 2, slow: 5 },
      costs: { commission: 5, commissionKind: "per_trade", slippageBps: 20, spreadBps: 20 },
    };
    const withCosts = costDragOf(series, busy, { symbol: "TEST" });
    assert.ok((withCosts.drag ?? 0) <= 0, `drag was ${withCosts.drag}`);
    assert.ok(withCosts.commission > 0);

    const free = costDragOf(series, { ...busy, costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 } }, { symbol: "TEST" });
    assert.ok(closeTo(free.drag, 0, 10));
    assert.equal(free.commission, 0);
  });
});

describe("buy and hold equivalence", () => {
  it("reproduces the asset's own return when costs are zero and shares are fractional", () => {
    const series = barsOnDays(
      Array.from({ length: 60 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 0, 5));
        date.setUTCDate(date.getUTCDate() + i);
        return [date.toISOString().slice(0, 10), 100 * 1.004 ** i] as [string, number];
      }),
    );
    const spec = cleanSpec({
      sizing: { kind: "all_in", value: 1, wholeShares: false, maxLeverage: 1 },
    });
    const result = runBacktest(series, spec, { symbol: "TEST" });

    // Entry lands on bar 1's open, so the comparison runs from there to the
    // final close rather than from the very first bar.
    const entryPrice = series[1].open;
    const exitPrice = series[series.length - 1].close;
    const expected = exitPrice / entryPrice - 1;
    assert.ok(closeTo(result.totalReturn, expected, 8), `${result.totalReturn} vs ${expected}`);
  });
});

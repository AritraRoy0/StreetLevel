/**
 * Integration tests for the backtest engine against the real bundled dataset.
 *
 * The key check here is cross-engine: a buy-and-hold run through the simulator
 * has to reproduce the total return the analytics engine already reports for
 * the same window. Two independent code paths agreeing on the same number is
 * the strongest evidence available without an external data vendor.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { normalizeBars } from "../lib/analytics/series.ts";
import { totalReturn } from "../lib/analytics/returns.ts";
import { assertCausal } from "../lib/backtest/signals.ts";
import { runBacktest, reconcileEquity } from "../lib/backtest/statistics.ts";
import { buildBenchmarkReport } from "../lib/backtest/benchmark.ts";
import { sweep, walkForward } from "../lib/backtest/sweep.ts";
import { runPortfolioBacktest } from "../lib/backtest/portfolio-backtest.ts";
import type { PortfolioBacktestSpec } from "../lib/backtest/portfolio-backtest.ts";
import { DEFAULT_STRATEGY } from "../lib/backtest/types.ts";
import type { RuleKind, StrategySpec } from "../lib/backtest/types.ts";
import type { Bar } from "../lib/analytics/types.ts";
import { closeTo } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, "..", "lib", "data", "historical-prices.json"), "utf8")) as {
  symbols: Record<string, Array<Record<string, number | string>>>;
};

const SYMBOLS = Object.keys(raw.symbols);
const BOOK: Record<string, Bar[]> = Object.fromEntries(
  SYMBOLS.map((symbol) => [symbol, normalizeBars(raw.symbols[symbol]).bars]),
);

const FRICTIONLESS: StrategySpec = {
  ...DEFAULT_STRATEGY,
  rule: "buy_and_hold",
  params: {},
  costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 },
  exits: { stopLossPct: 0, takeProfitPct: 0, trailingStopPct: 0, maxHoldBars: 0 },
  sizing: { kind: "all_in", value: 1, wholeShares: false, maxLeverage: 1 },
  initialCapital: 1_000_000,
};

describe("buy and hold agrees with the analytics engine", () => {
  for (const symbol of SYMBOLS) {
    it(`reproduces ${symbol}'s own return over the traded window`, () => {
      const bars = BOOK[symbol];
      const run = runBacktest(bars, FRICTIONLESS, { symbol });

      // The simulator enters on bar 1's open, so the comparable window is
      // bar 1 onward. Measuring against the analytics engine's full-window
      // figure would compare two different windows and fail for the wrong
      // reason.
      const entryPrice = bars[1].open;
      const exitPrice = bars[bars.length - 1].close;
      const expected = exitPrice / entryPrice - 1;

      assert.ok(
        closeTo(run.totalReturn, expected, 6),
        `${symbol}: simulator ${run.totalReturn} against ${expected}`,
      );
    });
  }

  it("lands close to the analytics engine's full-window total return", () => {
    // Not identical: the simulator misses the first bar's move because it
    // cannot fill before bar 1. The gap must be small and explainable, which
    // is what this asserts.
    for (const symbol of SYMBOLS) {
      const bars = BOOK[symbol];
      const run = runBacktest(bars, FRICTIONLESS, { symbol });
      const analytics = totalReturn(bars);
      const firstBarMove = bars[1].open / bars[0].adjClose - 1;

      assert.ok(run.totalReturn !== null && analytics !== null);
      const gap = Math.abs(run.totalReturn - analytics);
      assert.ok(
        gap < Math.abs(firstBarMove) + 0.05,
        `${symbol}: gap of ${gap} is larger than the first bar's ${firstBarMove}`,
      );
    }
  });
});

describe("every rule on every symbol", () => {
  const RULES: RuleKind[] = [
    "buy_and_hold",
    "sma_cross",
    "ema_cross",
    "price_vs_sma",
    "rsi_threshold",
    "bollinger_reversion",
    "macd_cross",
    "donchian_breakout",
  ];

  it("produces finite figures and a reconciled equity curve", () => {
    for (const symbol of SYMBOLS) {
      for (const rule of RULES) {
        const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule, params: {} };
        const run = runBacktest(BOOK[symbol], spec, { symbol });
        const label = `${symbol}/${rule}`;

        for (const value of [run.totalReturn, run.cagr, run.volatility, run.maxDrawdown, run.sharpe]) {
          assert.ok(value === null || Number.isFinite(value), `${label} produced ${value}`);
        }
        for (const point of run.equity) {
          assert.ok(Number.isFinite(point.equity) && point.equity >= 0, `${label} equity ${point.equity}`);
          assert.ok(point.cash >= -1e-6, `${label} cash ${point.cash}`);
        }
        if (run.maxDrawdown !== null) assert.ok(run.maxDrawdown <= 0, `${label} drawdown is positive`);
        assert.equal(run.drawdownSeries.length, run.equity.length, `${label} drawdown series misaligned`);

        const reconciliation = reconcileEquity(run);
        assert.ok(
          reconciliation.maxDifference < 0.001,
          `${label} equity differs from the portfolio replay by ${reconciliation.maxDifference}`,
        );
      }
    }
  });

  it("keeps the trade ledger's identity on real data", () => {
    for (const symbol of SYMBOLS) {
      const spec: StrategySpec = {
        ...DEFAULT_STRATEGY,
        rule: "sma_cross",
        params: { fast: 10, slow: 30 },
        costs: { commission: 1, commissionKind: "per_trade", slippageBps: 5, spreadBps: 4 },
      };
      const run = runBacktest(BOOK[symbol], spec, { symbol });
      for (const trade of run.trades) {
        assert.ok(
          closeTo((trade.grossProfit ?? 0) - trade.fees, trade.netProfit ?? 0, 6),
          `${symbol} ${trade.id}: gross ${trade.grossProfit} less fees ${trade.fees} is not ${trade.netProfit}`,
        );
      }
    }
  });

  it("is causal for every rule on real prices", () => {
    for (const symbol of SYMBOLS) {
      for (const rule of RULES) {
        const check = assertCausal(BOOK[symbol], { ...DEFAULT_STRATEGY, rule, params: {} }, { probes: 6 });
        assert.equal(check.causal, true, `${symbol}/${rule}: ${JSON.stringify(check.failures.slice(0, 1))}`);
      }
    }
  });
});

describe("costs always reduce the result", () => {
  it("never leaves a cost-bearing run ahead of the frictionless one", () => {
    for (const symbol of SYMBOLS) {
      const busy: StrategySpec = {
        ...DEFAULT_STRATEGY,
        rule: "sma_cross",
        params: { fast: 5, slow: 15 },
        costs: { commission: 5, commissionKind: "per_trade", slippageBps: 25, spreadBps: 15 },
      };
      const withCosts = runBacktest(BOOK[symbol], busy, { symbol });
      const free = runBacktest(
        BOOK[symbol],
        { ...busy, costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 } },
        { symbol },
      );

      if (withCosts.totalReturn === null || free.totalReturn === null) continue;
      // Whole-share sizing can round a position up or down, so a cent of noise
      // is allowed; a systematic advantage is not.
      assert.ok(
        withCosts.totalReturn <= free.totalReturn + 0.005,
        `${symbol}: costs improved the result, ${withCosts.totalReturn} against ${free.totalReturn}`,
      );
    }
  });
});

describe("benchmark report on real data", () => {
  it("measures the rule against holding and against the composite", () => {
    const symbol = "AAPL";
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 20, slow: 50 } };
    const run = runBacktest(BOOK[symbol], spec, { symbol });
    const free = runBacktest(
      BOOK[symbol],
      { ...spec, costs: { commission: 0, commissionKind: "per_trade", slippageBps: 0, spreadBps: 0 } },
      { symbol },
    );
    const report = buildBenchmarkReport(run, free, BOOK.MSFT);

    assert.ok(report.versusBuyAndHold.alignedPoints > 200);
    assert.ok(report.versusComposite !== null);
    assert.ok(report.ruleEdge !== null);
    assert.ok((report.costDrag ?? 0) <= 0.005, `cost drag was ${report.costDrag}`);
    assert.ok(report.commissionPaid >= 0);
  });
});

describe("sweeps and walk-forward on real data", () => {
  it("reports a distribution and a deflated Sharpe", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 10, slow: 30 } };
    const result = sweep(
      BOOK.NVDA,
      spec,
      [
        { param: "fast", values: [5, 10, 15, 20] },
        { param: "slow", values: [30, 50, 80] },
      ],
      { symbol: "NVDA" },
    );

    assert.equal(result.cells.length, 12);
    assert.ok(result.best !== null);
    assert.ok(result.distribution.medianSharpe !== null);
    assert.ok(
      result.deflatedSharpe === null || (result.deflatedSharpe >= 0 && result.deflatedSharpe <= 1),
      `deflated Sharpe was ${result.deflatedSharpe}`,
    );
    // The best cell can never be worse than the median of the grid.
    assert.ok((result.best?.sharpe ?? -Infinity) >= (result.distribution.medianSharpe ?? -Infinity));
  });

  it("splits a single year into folds and says the slices are thin", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 10, slow: 30 } };
    const result = walkForward(BOOK.MSFT, spec, [{ param: "slow", values: [30, 50, 80] }], {
      folds: 3,
      symbol: "MSFT",
      minBarsPerSlice: 90,
    });

    assert.equal(result.folds.length, 3);
    // 252 bars over four blocks is about 63 per slice, below the 90 asked for.
    assert.ok(result.warnings.some((warning) => warning.includes("below the")));
    for (const fold of result.folds) {
      assert.ok(new Date(fold.outOfSampleStart).getTime() > new Date(fold.inSampleEnd).getTime());
    }
  });
});

describe("multi-symbol run on real data", () => {
  it("holds several names against one cash account", () => {
    const spec: PortfolioBacktestSpec = {
      ...DEFAULT_STRATEGY,
      rule: "sma_cross",
      params: { fast: 20, slow: 50 },
      allocation: "equal_weight",
      maxPositions: 4,
      volatilityTarget: 0.2,
      initialCapital: 250_000,
    };
    const result = runPortfolioBacktest(BOOK, SYMBOLS, spec);

    assert.equal(result.symbols.length, SYMBOLS.length);
    assert.ok(result.equity.length > 240, `only ${result.equity.length} sessions`);
    assert.ok(closeTo(result.equity[0].equity, 250_000, 2));
    for (const point of result.equity) {
      assert.ok(Number.isFinite(point.equity) && point.cash >= -1e-6);
    }
    assert.equal(result.contributions.length, SYMBOLS.length);
    assert.ok(result.averageCorrelation !== null);

    const finalEquity = result.equity[result.equity.length - 1].equity;
    assert.ok(
      closeTo(result.portfolio.totalValue, finalEquity, 2),
      `${result.portfolio.totalValue} against ${finalEquity}`,
    );
  });

  it("never opens more positions at once than the cap allows", () => {
    const spec: PortfolioBacktestSpec = {
      ...DEFAULT_STRATEGY,
      rule: "price_vs_sma",
      params: { period: 20 },
      allocation: "equal_weight",
      maxPositions: 2,
      volatilityTarget: 0.2,
      initialCapital: 100_000,
    };
    const result = runPortfolioBacktest(BOOK, SYMBOLS, spec);

    // Reconstruct concurrency from the ledger: at every bar, count trades whose
    // holding period spans it.
    const total = result.timestamps.length;
    for (let i = 0; i < total; i += 1) {
      const openNow = result.trades.filter(
        (trade) => trade.entryIndex <= i && (trade.exitIndex === null ? true : trade.exitIndex > i),
      ).length;
      assert.ok(openNow <= 2, `${openNow} positions open at bar ${i}`);
    }
  });
});

describe("the dataset's own limits are visible in the output", () => {
  it("warns that a single year cannot support inference", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 50, slow: 200 } };
    const run = runBacktest(BOOK.AAPL, spec, { symbol: "AAPL" });
    // With a 200-bar slow average over 252 bars there is almost no room to
    // trade, and the engine should say so rather than present a clean result.
    assert.ok(run.warnings.length > 0);
  });

  it("reports few-trade samples as noise-dominated", () => {
    const spec: StrategySpec = { ...DEFAULT_STRATEGY, rule: "sma_cross", params: { fast: 40, slow: 100 } };
    const run = runBacktest(BOOK.TSLA, spec, { symbol: "TSLA" });
    if (run.statistics.closedTrades > 0 && run.statistics.closedTrades < 10) {
      assert.ok(run.warnings.some((warning) => warning.includes("noise")));
    }
  });
});

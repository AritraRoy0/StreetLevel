/**
 * Integration tests against the real bundled dataset.
 *
 * Unit tests prove the formulas are right on constructed inputs. These prove
 * the engine produces sane, cross-consistent numbers on the actual 252-session
 * Yahoo Finance download the app ships with, and they re-derive the headline
 * figures with independent inline arithmetic rather than by calling the same
 * helpers a second time.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { buildCompositeIndex, normalizeBars, resolveRange } from "../lib/analytics/series.ts";
import { buildSummary } from "../lib/analytics/summary.ts";
import { compareToBenchmark } from "../lib/analytics/compare.ts";
import { rsi, sma } from "../lib/analytics/indicators.ts";
import { closeTo, referenceRsi } from "./helpers.ts";
import type { Bar } from "../lib/analytics/types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(here, "..", "lib", "data", "historical-prices.json"), "utf8")) as {
  source: string;
  from: string;
  to: string;
  symbols: Record<string, Array<{ date: string; open: number; high: number; low: number; close: number; adjustedClose: number; volume: number }>>;
};

const SYMBOLS = Object.keys(raw.symbols);
const BOOK: Record<string, Bar[]> = Object.fromEntries(
  SYMBOLS.map((symbol) => [symbol, normalizeBars(raw.symbols[symbol]).bars]),
);

describe("dataset integrity", () => {
  it("covers ten symbols with a full year of daily sessions", () => {
    assert.equal(SYMBOLS.length, 10);
    for (const symbol of SYMBOLS) {
      assert.ok(BOOK[symbol].length > 240, `${symbol} has only ${BOOK[symbol].length} bars`);
    }
  });

  it("passes validation with nothing rejected or duplicated", () => {
    for (const symbol of SYMBOLS) {
      const { quality } = normalizeBars(raw.symbols[symbol]);
      assert.equal(quality.rejected, 0, `${symbol} had rejected rows`);
      assert.equal(quality.duplicates, 0, `${symbol} had duplicate timestamps`);
      assert.equal(quality.reordered, 0, `${symbol} arrived out of order`);
    }
  });

  it("contains only weekday sessions in ascending order", () => {
    for (const symbol of SYMBOLS) {
      const bars = BOOK[symbol];
      for (let i = 0; i < bars.length; i += 1) {
        const day = new Date(bars[i].timestamp).getUTCDay();
        assert.ok(day >= 1 && day <= 5, `${symbol} has a weekend bar at ${bars[i].timestamp}`);
        if (i > 0) {
          assert.ok(
            new Date(bars[i].timestamp).getTime() > new Date(bars[i - 1].timestamp).getTime(),
            `${symbol} is not strictly ascending at index ${i}`,
          );
        }
      }
    }
  });

  it("keeps every bar internally consistent", () => {
    for (const symbol of SYMBOLS) {
      for (const bar of BOOK[symbol]) {
        assert.ok(bar.low <= bar.high, `${symbol} ${bar.timestamp}: low above high`);
        assert.ok(bar.open >= bar.low && bar.open <= bar.high, `${symbol} ${bar.timestamp}: open outside range`);
        assert.ok(bar.close >= bar.low && bar.close <= bar.high, `${symbol} ${bar.timestamp}: close outside range`);
        assert.ok(bar.volume >= 0);
      }
    }
  });
});

describe("headline figures re-derived independently", () => {
  for (const symbol of ["AAPL", "NVDA", "TSLA"]) {
    it(`matches an inline recomputation for ${symbol}`, () => {
      const bars = BOOK[symbol];
      const summary = buildSummary(symbol, bars, { range: "MAX" });

      // Total return, computed directly from the two endpoint adjusted closes.
      const expectedReturn = bars[bars.length - 1].adjClose / bars[0].adjClose - 1;
      assert.ok(closeTo(summary.periodReturn, expectedReturn, 10), `${symbol} return`);

      // Absolute change, computed from the unadjusted closes.
      const expectedChange = bars[bars.length - 1].close - bars[0].close;
      assert.ok(closeTo(summary.periodChange, expectedChange, 8), `${symbol} change`);

      // Annualized volatility, recomputed from scratch.
      const returns: number[] = [];
      for (let i = 1; i < bars.length; i += 1) returns.push(bars[i].adjClose / bars[i - 1].adjClose - 1);
      const average = returns.reduce((total, value) => total + value, 0) / returns.length;
      const sampleVariance = returns.reduce((total, value) => total + (value - average) ** 2, 0) / (returns.length - 1);
      const expectedVolatility = Math.sqrt(sampleVariance) * Math.sqrt(252);
      assert.ok(closeTo(summary.volatility.annualized, expectedVolatility, 8), `${symbol} volatility`);

      // Max drawdown, recomputed with a running peak.
      let peak = -Infinity;
      let worst = 0;
      for (const bar of bars) {
        if (bar.adjClose > peak) peak = bar.adjClose;
        worst = Math.min(worst, bar.adjClose / peak - 1);
      }
      assert.ok(closeTo(summary.drawdown.maxDrawdown, worst, 10), `${symbol} drawdown`);

      // Period high and low, recomputed from the intraday extremes.
      assert.ok(closeTo(summary.extremes.high.value, Math.max(...bars.map((bar) => bar.high)), 8));
      assert.ok(closeTo(summary.extremes.low.value, Math.min(...bars.map((bar) => bar.low)), 8));

      // Average volume.
      const expectedVolume = bars.reduce((total, bar) => total + bar.volume, 0) / bars.length;
      assert.ok(closeTo(summary.volume.average, expectedVolume, 4));
    });
  }

  it("matches an independent RSI transcription on real closes", () => {
    for (const symbol of SYMBOLS) {
      const values = BOOK[symbol].map((bar) => bar.adjClose);
      const mine = rsi(values, 14);
      const reference = referenceRsi(values, 14);
      for (let i = 0; i < values.length; i += 1) {
        if (reference[i] === null) assert.equal(mine[i], null);
        else assert.ok(closeTo(mine[i], reference[i]!, 8), `${symbol} RSI at ${i}`);
      }
    }
  });

  it("matches a naive windowed mean for SMA 50 on real closes", () => {
    const values = BOOK.MSFT.map((bar) => bar.adjClose);
    const mine = sma(values, 50);
    for (let i = 49; i < values.length; i += 1) {
      const window = values.slice(i - 49, i + 1);
      const expected = window.reduce((total, value) => total + value, 0) / 50;
      assert.ok(closeTo(mine[i], expected, 8), `index ${i}`);
    }
  });
});

describe("range boundaries on the real calendar", () => {
  const bars = BOOK.AAPL;

  it("returns a plausible number of sessions for each preset", () => {
    const counts: Record<string, number> = {};
    for (const range of ["1M", "3M", "6M", "1Y", "MAX"] as const) {
      counts[range] = resolveRange(bars, range)!.bars.length;
    }
    // Roughly 21 trading days a month, 63 a quarter, 126 a half, 252 a year.
    assert.ok(counts["1M"] >= 18 && counts["1M"] <= 24, `1M was ${counts["1M"]}`);
    assert.ok(counts["3M"] >= 58 && counts["3M"] <= 68, `3M was ${counts["3M"]}`);
    assert.ok(counts["6M"] >= 118 && counts["6M"] <= 132, `6M was ${counts["6M"]}`);
    assert.ok(counts["1Y"] >= 240 && counts["1Y"] <= 255, `1Y was ${counts["1Y"]}`);
    assert.equal(counts.MAX, bars.length);
  });

  it("nests each range inside the next", () => {
    const month = resolveRange(bars, "1M")!.bars;
    const quarter = resolveRange(bars, "3M")!.bars;
    const year = resolveRange(bars, "1Y")!.bars;
    assert.ok(quarter.length > month.length);
    assert.ok(year.length > quarter.length);
    // All ranges end on the same session.
    assert.equal(month[month.length - 1].timestamp, year[year.length - 1].timestamp);
  });

  it("starts YTD on or after 1 January of the final year", () => {
    const ytd = resolveRange(bars, "YTD")!;
    const finalYear = new Date(bars[bars.length - 1].timestamp).getUTCFullYear();
    assert.equal(new Date(ytd.start).getUTCFullYear(), finalYear);
  });

  it("keeps the 1D window to the last two sessions of daily data", () => {
    const day = resolveRange(bars, "1D")!;
    assert.equal(day.bars.length, 2);
    assert.equal(day.bars[1].timestamp, bars[bars.length - 1].timestamp);
  });
});

describe("cross-symbol comparison on the real calendar", () => {
  it("aligns two symbols with no dropped sessions, since they share a calendar", () => {
    const result = compareToBenchmark(BOOK.AAPL, BOOK.MSFT, { baseSymbol: "AAPL", benchmarkSymbol: "MSFT" });
    assert.equal(result.alignedPoints, BOOK.AAPL.length);
    assert.equal(result.droppedPoints, 0);
  });

  it("produces a correlation inside the valid interval for every pair", () => {
    for (const a of SYMBOLS) {
      for (const b of SYMBOLS) {
        const result = compareToBenchmark(BOOK[a], BOOK[b]);
        assert.ok(result.correlation !== null, `${a}/${b} had no correlation`);
        assert.ok(result.correlation! >= -1 && result.correlation! <= 1, `${a}/${b}: ${result.correlation}`);
      }
    }
  });

  it("gives a correlation of 1 and a beta of 1 against itself", () => {
    const result = compareToBenchmark(BOOK.NVDA, BOOK.NVDA);
    assert.ok(closeTo(result.correlation, 1, 8));
    assert.ok(closeTo(result.beta, 1, 8));
    assert.ok(closeTo(result.excessReturn, 0, 10));
  });

  it("builds a composite that starts at 100 and covers every session", () => {
    const composite = buildCompositeIndex(SYMBOLS.map((symbol) => BOOK[symbol]));
    assert.equal(composite.length, BOOK.AAPL.length);
    assert.ok(closeTo(composite[0].adjClose, 100, 6));
    for (const bar of composite) {
      assert.ok(Number.isFinite(bar.close) && bar.close > 0);
      assert.ok(bar.low <= bar.high);
    }
  });

  it("keeps the composite's return between its best and worst constituent", () => {
    const composite = buildCompositeIndex(SYMBOLS.map((symbol) => BOOK[symbol]));
    const compositeReturn = composite[composite.length - 1].adjClose / composite[0].adjClose - 1;
    const constituentReturns = SYMBOLS.map((symbol) => {
      const bars = BOOK[symbol];
      return bars[bars.length - 1].adjClose / bars[0].adjClose - 1;
    });
    assert.ok(compositeReturn <= Math.max(...constituentReturns) + 1e-9);
    assert.ok(compositeReturn >= Math.min(...constituentReturns) - 1e-9);
  });
});

describe("every symbol produces a clean summary at every range", () => {
  it("has no NaN, no Infinity and no out-of-band indicator values", () => {
    for (const symbol of SYMBOLS) {
      for (const range of ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"] as const) {
        for (const interval of ["1d", "1w", "1mo"] as const) {
          const summary = buildSummary(symbol, BOOK[symbol], { range, interval });
          const label = `${symbol} ${range} ${interval}`;

          for (const value of [summary.periodReturn, summary.volatility.annualized, summary.drawdown.maxDrawdown, summary.lastPrice]) {
            assert.ok(value === null || Number.isFinite(value), `${label} produced ${value}`);
          }
          if (summary.rsi.value !== null) {
            assert.ok(summary.rsi.value >= 0 && summary.rsi.value <= 100, `${label} RSI ${summary.rsi.value}`);
          }
          if (summary.drawdown.maxDrawdown !== null) {
            assert.ok(summary.drawdown.maxDrawdown <= 0, `${label} drawdown is positive`);
          }
          if (summary.volatility.annualized !== null) {
            assert.ok(summary.volatility.annualized >= 0, `${label} volatility is negative`);
          }
          if (summary.extremes.position !== null) {
            assert.ok(summary.extremes.position >= 0 && summary.extremes.position <= 1, `${label} position out of range`);
          }
          for (const [name, series] of Object.entries(summary.indicators)) {
            assert.equal(series.length, summary.bars.length, `${label} ${name} misaligned`);
            for (const value of series) {
              assert.ok(value === null || Number.isFinite(value), `${label} ${name} has ${value}`);
            }
          }
        }
      }
    }
  });
});

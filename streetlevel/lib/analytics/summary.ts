/**
 * Assembles one analytics snapshot for a symbol over a selected window.
 *
 * This is the single object the analytics page renders from. Building it in
 * one pure function means every card, table and chart on the page reads the
 * same numbers: there is no second place where a "period return" gets computed
 * slightly differently.
 */

import { finite, safeDiv, simpleReturn } from "./math.ts";
import {
  atr,
  bollinger,
  ema,
  lastCross,
  latest,
  macd,
  obv,
  rsi,
  sma,
  volumeAverage,
} from "./indicators.ts";
import {
  absoluteChange,
  cagr,
  calmar,
  closes,
  dailyReturns,
  distribution,
  drawdown,
  monthlyReturns,
  rangeExtremes,
  sharpe,
  sortino,
  totalReturn,
  volatility,
  volumeSummary,
  weeklyReturns,
} from "./returns.ts";
import { daysBetween, resolveRange, resample } from "./series.ts";
import type {
  Bar,
  CrossEvent,
  DrawdownResult,
  Interval,
  Maybe,
  MovingAverageSummary,
  PeriodReturn,
  RangeKey,
  VolatilityResult,
} from "./types.ts";
import type { RangeExtremes, ReturnDistribution, VolumeSummary } from "./returns.ts";

/** Moving averages the page offers as overlays and in the trend table. */
export const MOVING_AVERAGES: Array<{ kind: "SMA" | "EMA"; period: number; label: string; color: string }> = [
  { kind: "SMA", period: 20, label: "SMA 20", color: "var(--chart-ma-1)" },
  { kind: "SMA", period: 50, label: "SMA 50", color: "var(--chart-ma-2)" },
  { kind: "SMA", period: 200, label: "SMA 200", color: "var(--chart-ma-3)" },
  { kind: "EMA", period: 12, label: "EMA 12", color: "var(--chart-ma-4)" },
  { kind: "EMA", period: 26, label: "EMA 26", color: "var(--chart-ma-5)" },
];

export interface IndicatorSeries {
  sma20: Maybe[];
  sma50: Maybe[];
  sma200: Maybe[];
  ema12: Maybe[];
  ema26: Maybe[];
  rsi14: Maybe[];
  macd: Maybe[];
  macdSignal: Maybe[];
  macdHistogram: Maybe[];
  bollingerUpper: Maybe[];
  bollingerMiddle: Maybe[];
  bollingerLower: Maybe[];
  percentB: Maybe[];
  atr14: Maybe[];
  obv: Maybe[];
  volumeSma20: Maybe[];
  drawdown: Maybe[];
}

export interface RsiSummary {
  value: Maybe;
  /** Wilder's conventional bands. */
  zone: "overbought" | "oversold" | "neutral" | null;
  /** True when fewer than `period + 1` bars were available. */
  insufficientHistory: boolean;
  available: number;
  required: number;
}

export interface AnalyticsSummary {
  symbol: string;
  interval: Interval;
  range: RangeKey;
  /** Bars actually charted after range resolution and resampling. */
  bars: Bar[];
  /** True when the dataset starts later than the requested range. */
  truncated: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  windowDays: Maybe;

  /** Latest close and its one-session change, from the unadjusted price. */
  lastPrice: Maybe;
  previousClose: Maybe;
  lastChange: Maybe;
  lastChangePercent: Maybe;
  lastBarTimestamp: string | null;

  periodReturn: Maybe;
  periodChange: Maybe;
  cagr: { value: Maybe; days: Maybe; insufficientHistory: boolean };
  volatility: VolatilityResult;
  drawdown: DrawdownResult;
  extremes: RangeExtremes;
  volume: VolumeSummary;
  sharpe: Maybe;
  sortino: Maybe;
  calmar: Maybe;

  daily: PeriodReturn[];
  weekly: PeriodReturn[];
  monthly: PeriodReturn[];
  dailyStats: ReturnDistribution;
  weeklyStats: ReturnDistribution;
  monthlyStats: ReturnDistribution;

  movingAverages: MovingAverageSummary[];
  cross: CrossEvent | null;
  rsi: RsiSummary;
  macdSummary: { value: Maybe; signal: Maybe; histogram: Maybe; trend: "bullish" | "bearish" | null };
  bollingerSummary: { upper: Maybe; middle: Maybe; lower: Maybe; percentB: Maybe; position: "upper" | "lower" | "middle" | null };
  atr: { value: Maybe; percentOfPrice: Maybe };

  indicators: IndicatorSeries;
  warnings: string[];
}

function movingAverageSummary(
  values: readonly number[],
  price: number | null,
  spec: { kind: "SMA" | "EMA"; period: number; label: string },
): MovingAverageSummary {
  const series = spec.kind === "SMA" ? sma(values, spec.period) : ema(values, spec.period);
  const value = latest(series);
  return {
    label: spec.label,
    kind: spec.kind,
    period: spec.period,
    value,
    priceVsMa: value === null || price === null ? null : simpleReturn(value, price),
    above: value === null || price === null ? null : price > value,
    available: values.length,
    required: spec.period,
  };
}

/**
 * Builds the full snapshot.
 *
 * `history` is the complete validated series for the symbol; the range is
 * resolved from it so metrics such as volume period-over-period can look at
 * the window immediately before the selected one. Passing a pre-sliced series
 * still works, it just makes those look-back metrics unavailable.
 */
export function buildSummary(
  symbol: string,
  history: readonly Bar[],
  options: { range?: RangeKey; interval?: Interval; riskFreeRate?: number } = {},
): AnalyticsSummary {
  const { range = "1Y", interval = "1d", riskFreeRate = 0 } = options;
  const warnings: string[] = [];

  const emptyIndicators: IndicatorSeries = {
    sma20: [], sma50: [], sma200: [], ema12: [], ema26: [], rsi14: [],
    macd: [], macdSignal: [], macdHistogram: [],
    bollingerUpper: [], bollingerMiddle: [], bollingerLower: [], percentB: [],
    atr14: [], obv: [], volumeSma20: [], drawdown: [],
  };

  const base: AnalyticsSummary = {
    symbol,
    interval,
    range,
    bars: [],
    truncated: false,
    windowStart: null,
    windowEnd: null,
    windowDays: null,
    lastPrice: null,
    previousClose: null,
    lastChange: null,
    lastChangePercent: null,
    lastBarTimestamp: null,
    periodReturn: null,
    periodChange: null,
    cagr: { value: null, days: null, insufficientHistory: true },
    volatility: { annualized: null, periodic: null, observations: 0, sufficient: false },
    drawdown: {
      series: [], maxDrawdown: null, peakTimestamp: null, troughTimestamp: null,
      recoveryTimestamp: null, drawdownDays: null, recoveryDays: null, currentDrawdown: null,
    },
    extremes: { high: { value: null, timestamp: null }, low: { value: null, timestamp: null }, position: null, spread: null },
    volume: { average: null, median: null, latest: null, latestVsAverage: null, periodOverPeriod: null, total: null },
    sharpe: null,
    sortino: null,
    calmar: null,
    daily: [],
    weekly: [],
    monthly: [],
    dailyStats: distribution([]),
    weeklyStats: distribution([]),
    monthlyStats: distribution([]),
    movingAverages: [],
    cross: null,
    rsi: { value: null, zone: null, insufficientHistory: true, available: 0, required: 15 },
    macdSummary: { value: null, signal: null, histogram: null, trend: null },
    bollingerSummary: { upper: null, middle: null, lower: null, percentB: null, position: null },
    atr: { value: null, percentOfPrice: null },
    indicators: emptyIndicators,
    warnings,
  };

  if (history.length === 0) {
    warnings.push("No price history available for this symbol.");
    return base;
  }

  const resampledHistory = resample(history, interval);
  const resolved = resolveRange(resampledHistory, range);
  if (!resolved) {
    warnings.push("The selected range contains no data.");
    return base;
  }

  const bars = resolved.bars;
  if (resolved.truncated) {
    warnings.push("History begins after the start of the selected range; the window has been shortened.");
  }
  if (bars.length < 2) {
    warnings.push("Fewer than two bars in the window; change metrics are unavailable.");
  }

  const values = closes(bars);
  const lastBar = bars[bars.length - 1];
  const previousBar = bars.length > 1 ? bars[bars.length - 2] : null;
  const lastPrice = lastBar.close;
  const previousClose = previousBar ? previousBar.close : null;

  const smaSeries20 = sma(values, 20);
  const smaSeries50 = sma(values, 50);
  const smaSeries200 = sma(values, 200);
  const emaSeries12 = ema(values, 12);
  const emaSeries26 = ema(values, 26);
  const rsiSeries = rsi(values, 14);
  const macdResult = macd(values);
  const bands = bollinger(values, 20, 2);
  const atrSeries = atr(bars, 14);
  const risk = drawdown(bars);

  const rsiValue = latest(rsiSeries);
  const rsiInsufficient = bars.length < 15;
  if (rsiInsufficient) warnings.push("RSI needs 15 bars; the window is shorter.");

  const macdValue = latest(macdResult.macd);
  const macdSignalValue = latest(macdResult.signal);
  const macdHistogramValue = latest(macdResult.histogram);

  const bandUpper = latest(bands.upper);
  const bandMiddle = latest(bands.middle);
  const bandLower = latest(bands.lower);
  const percentB = latest(bands.percentB);

  const atrValue = latest(atrSeries);
  const volatilityResult = volatility(bars, interval);
  if (!volatilityResult.sufficient && volatilityResult.observations > 0) {
    warnings.push(`Volatility is based on ${volatilityResult.observations} returns and should be read as indicative.`);
  }

  const growth = cagr(bars);
  if (growth.insufficientHistory && growth.days !== null) {
    warnings.push("The window is under eleven months, so an annualized growth rate is not reported.");
  }

  const movingAverages = MOVING_AVERAGES.map((spec) => movingAverageSummary(values, lastPrice, spec));
  for (const summary of movingAverages) {
    if (summary.value === null) {
      warnings.push(`${summary.label} needs ${summary.required} bars; the window has ${summary.available}.`);
    }
  }

  const dailySeries = dailyReturns(bars);
  const weeklySeries = weeklyReturns(bars);
  const monthlySeries = monthlyReturns(bars);

  return {
    symbol,
    interval,
    range,
    bars,
    truncated: resolved.truncated,
    windowStart: resolved.start,
    windowEnd: resolved.end,
    windowDays: daysBetween(resolved.start, resolved.end),
    lastPrice,
    previousClose,
    lastChange: previousClose === null ? null : finite(lastPrice - previousClose),
    lastChangePercent: simpleReturn(previousClose, lastPrice),
    lastBarTimestamp: lastBar.timestamp,
    periodReturn: totalReturn(bars),
    periodChange: absoluteChange(bars),
    cagr: growth,
    volatility: volatilityResult,
    drawdown: risk,
    extremes: rangeExtremes(bars),
    volume: volumeSummary(bars, resampledHistory, 20),
    sharpe: sharpe(bars, riskFreeRate, interval),
    sortino: sortino(bars, riskFreeRate, interval),
    calmar: calmar(bars),
    daily: dailySeries,
    weekly: weeklySeries,
    monthly: monthlySeries,
    dailyStats: distribution(dailySeries),
    weeklyStats: distribution(weeklySeries),
    monthlyStats: distribution(monthlySeries),
    movingAverages,
    cross: lastCross(smaSeries50, smaSeries200, bars.map((bar) => bar.timestamp), 50, 200),
    rsi: {
      value: rsiValue,
      zone: rsiValue === null ? null : rsiValue >= 70 ? "overbought" : rsiValue <= 30 ? "oversold" : "neutral",
      insufficientHistory: rsiInsufficient,
      available: bars.length,
      required: 15,
    },
    macdSummary: {
      value: macdValue,
      signal: macdSignalValue,
      histogram: macdHistogramValue,
      trend: macdHistogramValue === null ? null : macdHistogramValue >= 0 ? "bullish" : "bearish",
    },
    bollingerSummary: {
      upper: bandUpper,
      middle: bandMiddle,
      lower: bandLower,
      percentB,
      position:
        percentB === null ? null : percentB > 1 ? "upper" : percentB < 0 ? "lower" : "middle",
    },
    atr: { value: atrValue, percentOfPrice: safeDiv(atrValue, lastPrice) },
    indicators: {
      sma20: smaSeries20,
      sma50: smaSeries50,
      sma200: smaSeries200,
      ema12: emaSeries12,
      ema26: emaSeries26,
      rsi14: rsiSeries,
      macd: macdResult.macd,
      macdSignal: macdResult.signal,
      macdHistogram: macdResult.histogram,
      bollingerUpper: bands.upper,
      bollingerMiddle: bands.middle,
      bollingerLower: bands.lower,
      percentB: bands.percentB,
      atr14: atrSeries,
      obv: obv(bars),
      volumeSma20: volumeAverage(bars, 20),
      drawdown: risk.series.map((point) => point.value),
    },
    warnings,
  };
}

/**
 * The signal layer: turning a strategy specification into a desired-position
 * series.
 *
 * Every rule here is composed from the indicators already in
 * `lib/analytics/indicators.ts`. No new mathematics is introduced, which means
 * a crossover drawn on the analytics chart and a crossover traded in a
 * backtest cannot disagree.
 *
 * Causality is the property that matters. `desired[i]` is a function of
 * `bars[0..i]` only. That is not merely asserted: `assertCausal` recomputes the
 * series over truncated prefixes and checks the answers match, which catches
 * any rule that reaches forward.
 */

import { bollinger, ema, macd, rsi, sma } from "../analytics/indicators.ts";
import { isoWeekKey, monthKey } from "../analytics/series.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import type { ConflictPolicy, Position, RuleKind, SignalSeries, StrategySpec } from "./types.ts";

/** Parameter defaults and bounds per rule, used by the UI and the sweeps. */
export const RULE_DEFINITIONS: Record<
  RuleKind,
  {
    label: string;
    description: string;
    params: Array<{ key: string; label: string; default: number; min: number; max: number; step: number }>;
  }
> = {
  buy_and_hold: {
    label: "Buy and hold",
    description: "Enter on the first bar and never leave. The baseline every other rule has to beat.",
    params: [],
  },
  sma_cross: {
    label: "SMA crossover",
    description: "Long while the fast simple average sits above the slow one.",
    params: [
      { key: "fast", label: "Fast", default: 20, min: 2, max: 100, step: 1 },
      { key: "slow", label: "Slow", default: 50, min: 3, max: 200, step: 1 },
    ],
  },
  ema_cross: {
    label: "EMA crossover",
    description: "Long while the fast exponential average sits above the slow one.",
    params: [
      { key: "fast", label: "Fast", default: 12, min: 2, max: 100, step: 1 },
      { key: "slow", label: "Slow", default: 26, min: 3, max: 200, step: 1 },
    ],
  },
  price_vs_sma: {
    label: "Price above average",
    description: "Long while the close is above its own moving average.",
    params: [{ key: "period", label: "Period", default: 50, min: 2, max: 200, step: 1 }],
  },
  rsi_threshold: {
    label: "RSI reversion",
    description: "Buy when RSI falls through the lower band, sell when it rises through the upper one.",
    params: [
      { key: "period", label: "Period", default: 14, min: 2, max: 50, step: 1 },
      { key: "buyBelow", label: "Buy below", default: 30, min: 5, max: 50, step: 1 },
      { key: "sellAbove", label: "Sell above", default: 70, min: 50, max: 95, step: 1 },
    ],
  },
  bollinger_reversion: {
    label: "Bollinger reversion",
    description: "Buy a close below the lower band, exit on a return to the middle band.",
    params: [
      { key: "period", label: "Period", default: 20, min: 5, max: 100, step: 1 },
      { key: "multiplier", label: "Deviations", default: 2, min: 0.5, max: 4, step: 0.1 },
    ],
  },
  macd_cross: {
    label: "MACD histogram",
    description: "Long while the MACD histogram is positive.",
    params: [
      { key: "fast", label: "Fast", default: 12, min: 2, max: 60, step: 1 },
      { key: "slow", label: "Slow", default: 26, min: 3, max: 120, step: 1 },
      { key: "signal", label: "Signal", default: 9, min: 2, max: 50, step: 1 },
    ],
  },
  donchian_breakout: {
    label: "Donchian breakout",
    description: "Buy a close at a new high of the lookback, exit at a new low of the exit lookback.",
    params: [
      { key: "entry", label: "Entry lookback", default: 40, min: 5, max: 200, step: 1 },
      { key: "exit", label: "Exit lookback", default: 20, min: 3, max: 200, step: 1 },
    ],
  },
};

/** Reads a parameter, falling back to the rule's documented default. */
export function paramOf(spec: StrategySpec, key: string): number {
  const value = spec.params[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const definition = RULE_DEFINITIONS[spec.rule].params.find((param) => param.key === key);
  return definition ? definition.default : Number.NaN;
}

/** Highest high over a trailing window, `null` until the window fills. */
function rollingHigh(bars: readonly Bar[], period: number): Maybe[] {
  const out: Maybe[] = new Array(bars.length).fill(null);
  if (period < 1) return out;
  for (let i = period - 1; i < bars.length; i += 1) {
    let best = -Infinity;
    for (let j = i - period + 1; j <= i; j += 1) best = Math.max(best, bars[j].high);
    out[i] = best;
  }
  return out;
}

function rollingLow(bars: readonly Bar[], period: number): Maybe[] {
  const out: Maybe[] = new Array(bars.length).fill(null);
  if (period < 1) return out;
  for (let i = period - 1; i < bars.length; i += 1) {
    let worst = Infinity;
    for (let j = i - period + 1; j <= i; j += 1) worst = Math.min(worst, bars[j].low);
    out[i] = worst;
  }
  return out;
}

/**
 * A rule is expressed either as a *state* the strategy should be in, or as
 * *events* that flip it. State rules are simpler and cannot drift out of sync
 * with their own history; event rules need the previous position carried
 * forward, which is what `resolveEvents` does.
 */
interface RawRule {
  /** State rules: the position wanted on each bar, or null during warm-up. */
  state?: Array<Position | null>;
  /** Event rules: bars on which to enter and to exit. */
  entry?: boolean[];
  exit?: boolean[];
  /** First bar the rule can decide on. */
  firstDecisionIndex: number;
  warnings: string[];
}

function requiredBarsFor(spec: StrategySpec): number {
  switch (spec.rule) {
    case "buy_and_hold":
      return 1;
    case "sma_cross":
    case "ema_cross":
      return Math.max(paramOf(spec, "fast"), paramOf(spec, "slow"));
    case "price_vs_sma":
      return paramOf(spec, "period");
    case "rsi_threshold":
      return paramOf(spec, "period") + 1;
    case "bollinger_reversion":
      return paramOf(spec, "period");
    case "macd_cross":
      return paramOf(spec, "slow") + paramOf(spec, "signal") - 1;
    case "donchian_breakout":
      return Math.max(paramOf(spec, "entry"), paramOf(spec, "exit"));
    default:
      return 1;
  }
}

function buildRawRule(bars: readonly Bar[], spec: StrategySpec): RawRule {
  const closes = bars.map((bar) => bar.adjClose);
  const n = bars.length;
  const warnings: string[] = [];
  const required = requiredBarsFor(spec);

  if (n < required) {
    warnings.push(
      `${RULE_DEFINITIONS[spec.rule].label} needs ${required} bars and the window has ${n}; the strategy never trades.`,
    );
  }

  const firstDefined = (series: Maybe[]) => {
    const index = series.findIndex((value) => value !== null);
    return index === -1 ? n : index;
  };

  switch (spec.rule) {
    case "buy_and_hold": {
      return { state: bars.map(() => 1 as Position), firstDecisionIndex: 0, warnings };
    }

    case "sma_cross":
    case "ema_cross": {
      const fastPeriod = Math.round(paramOf(spec, "fast"));
      const slowPeriod = Math.round(paramOf(spec, "slow"));
      if (fastPeriod >= slowPeriod) {
        warnings.push("The fast period must be shorter than the slow period; the strategy never trades.");
        return { state: bars.map(() => null), firstDecisionIndex: n, warnings };
      }
      const build = spec.rule === "sma_cross" ? sma : ema;
      const fast = build(closes, fastPeriod);
      const slow = build(closes, slowPeriod);
      const state = bars.map((_, i) => {
        const f = fast[i];
        const s = slow[i];
        if (f === null || s === null) return null;
        return (f > s ? 1 : 0) as Position;
      });
      return { state, firstDecisionIndex: firstDefined(slow), warnings };
    }

    case "price_vs_sma": {
      const period = Math.round(paramOf(spec, "period"));
      const average = sma(closes, period);
      const state = bars.map((_, i) => {
        const value = average[i];
        if (value === null) return null;
        return (closes[i] > value ? 1 : 0) as Position;
      });
      return { state, firstDecisionIndex: firstDefined(average), warnings };
    }

    case "macd_cross": {
      const fastPeriod = Math.round(paramOf(spec, "fast"));
      const slowPeriod = Math.round(paramOf(spec, "slow"));
      const signalPeriod = Math.round(paramOf(spec, "signal"));
      if (fastPeriod >= slowPeriod) {
        warnings.push("The fast period must be shorter than the slow period; the strategy never trades.");
        return { state: bars.map(() => null), firstDecisionIndex: n, warnings };
      }
      const result = macd(closes, fastPeriod, slowPeriod, signalPeriod);
      const state = bars.map((_, i) => {
        const value = result.histogram[i];
        if (value === null) return null;
        return (value > 0 ? 1 : 0) as Position;
      });
      return { state, firstDecisionIndex: firstDefined(result.histogram), warnings };
    }

    case "rsi_threshold": {
      const period = Math.round(paramOf(spec, "period"));
      const buyBelow = paramOf(spec, "buyBelow");
      const sellAbove = paramOf(spec, "sellAbove");
      if (buyBelow >= sellAbove) {
        warnings.push("The buy threshold must sit below the sell threshold; the strategy never trades.");
        return { state: bars.map(() => null), firstDecisionIndex: n, warnings };
      }
      const series = rsi(closes, period);
      const entry = new Array(n).fill(false);
      const exit = new Array(n).fill(false);
      const first = firstDefined(series);
      for (let i = 0; i < n; i += 1) {
        const value = series[i];
        if (value === null) continue;
        const previous = i > 0 ? series[i - 1] : null;
        if (previous === null) {
          /**
           * The first defined reading has nothing to cross from. Treating it as
           * a non-event would leave the rule permanently flat on exactly the
           * data where it should act: a series that has already fallen hard by
           * the time RSI warms up begins below the band, never crosses into it,
           * and so never triggers. The first reading is therefore taken as a
           * decision on its level.
           */
          if (value < buyBelow) entry[i] = true;
          else if (value > sellAbove) exit[i] = true;
          continue;
        }
        // Afterwards, crossings only: a reading that merely sits below the band
        // does not re-fire on every subsequent bar.
        if (previous >= buyBelow && value < buyBelow) entry[i] = true;
        if (previous <= sellAbove && value > sellAbove) exit[i] = true;
      }
      return { entry, exit, firstDecisionIndex: first, warnings };
    }

    case "bollinger_reversion": {
      const period = Math.round(paramOf(spec, "period"));
      const multiplier = paramOf(spec, "multiplier");
      const bands = bollinger(closes, period, multiplier);
      const entry = new Array(n).fill(false);
      const exit = new Array(n).fill(false);
      for (let i = 0; i < n; i += 1) {
        const lower = bands.lower[i];
        const middle = bands.middle[i];
        if (lower === null || middle === null) continue;
        if (closes[i] < lower) entry[i] = true;
        if (closes[i] > middle) exit[i] = true;
      }
      return { entry, exit, firstDecisionIndex: firstDefined(bands.middle), warnings };
    }

    case "donchian_breakout": {
      const entryPeriod = Math.round(paramOf(spec, "entry"));
      const exitPeriod = Math.round(paramOf(spec, "exit"));
      // The extreme is taken over the window *ending on the previous bar*, so a
      // bar is never compared against a high it set itself.
      const highs = rollingHigh(bars, entryPeriod);
      const lows = rollingLow(bars, exitPeriod);
      const entry = new Array(n).fill(false);
      const exit = new Array(n).fill(false);
      for (let i = 1; i < n; i += 1) {
        const priorHigh = highs[i - 1];
        const priorLow = lows[i - 1];
        if (priorHigh !== null && bars[i].close > priorHigh) entry[i] = true;
        if (priorLow !== null && bars[i].close < priorLow) exit[i] = true;
      }
      return {
        entry,
        exit,
        firstDecisionIndex: Math.min(firstDefined(highs), firstDefined(lows)) + 1,
        warnings,
      };
    }

    default:
      return { state: bars.map(() => null), firstDecisionIndex: n, warnings };
  }
}

/**
 * Carries an event rule forward into a desired-position series.
 *
 * When entry and exit fire on the same bar the rule is genuinely ambiguous and
 * the answer has to be a policy rather than an accident of evaluation order:
 * `exit_wins` is the conservative default, `entry_wins` the aggressive one, and
 * `hold` keeps whatever position was already held.
 */
function resolveEvents(
  entry: boolean[],
  exit: boolean[],
  firstDecisionIndex: number,
  conflict: ConflictPolicy,
): { desired: Array<Position | null>; conflicts: number } {
  const desired: Array<Position | null> = new Array(entry.length).fill(null);
  let conflicts = 0;
  let held: Position = 0;

  for (let i = 0; i < entry.length; i += 1) {
    if (i < firstDecisionIndex) {
      desired[i] = null;
      continue;
    }
    const wantsIn = entry[i];
    const wantsOut = exit[i];
    if (wantsIn && wantsOut) {
      conflicts += 1;
      if (conflict === "exit_wins") held = 0;
      else if (conflict === "entry_wins") held = 1;
    } else if (wantsIn) {
      held = 1;
    } else if (wantsOut) {
      held = 0;
    }
    desired[i] = held;
  }

  return { desired, conflicts };
}

/**
 * Thins the decision series to a rebalance cadence.
 *
 * On a weekly or monthly cadence the position may only change on the last bar
 * of each calendar bucket; on every other bar the previous decision is carried
 * forward. This is what makes a slow strategy testable without its result
 * being an artefact of reacting to every single session.
 */
function applyCadence(
  desired: Array<Position | null>,
  bars: readonly Bar[],
  cadence: StrategySpec["rebalance"],
): Array<Position | null> {
  if (cadence === "signal") return desired;
  const keyFor = cadence === "weekly" ? isoWeekKey : monthKey;
  const out: Array<Position | null> = new Array(desired.length).fill(null);
  let carried: Position | null = null;

  for (let i = 0; i < bars.length; i += 1) {
    const isLastOfBucket = i === bars.length - 1 || keyFor(bars[i + 1].timestamp) !== keyFor(bars[i].timestamp);
    if (isLastOfBucket && desired[i] !== null) carried = desired[i];
    out[i] = carried;
  }
  return out;
}

/** Builds the decision series for a strategy over a bar window. */
export function buildSignals(bars: readonly Bar[], spec: StrategySpec): SignalSeries {
  if (bars.length === 0) {
    return {
      desired: [],
      entries: [],
      exits: [],
      conflicts: 0,
      firstDecisionIndex: 0,
      warnings: ["No bars in the window."],
    };
  }

  const raw = buildRawRule(bars, spec);
  const warnings = [...raw.warnings];

  let desired: Array<Position | null>;
  let conflicts = 0;
  let entries: boolean[];
  let exits: boolean[];

  if (raw.state) {
    desired = raw.state;
    // A state rule's entries and exits are the transitions of its own state.
    entries = desired.map((value, i) => value === 1 && (i === 0 || desired[i - 1] !== 1));
    exits = desired.map((value, i) => value === 0 && i > 0 && desired[i - 1] === 1);
  } else {
    entries = raw.entry ?? bars.map(() => false);
    exits = raw.exit ?? bars.map(() => false);
    const resolved = resolveEvents(entries, exits, raw.firstDecisionIndex, spec.conflict);
    desired = resolved.desired;
    conflicts = resolved.conflicts;
    if (conflicts > 0) {
      warnings.push(
        `Entry and exit conditions fired together on ${conflicts} ${conflicts === 1 ? "bar" : "bars"}; the "${spec.conflict.replace("_", " ")}" policy decided the outcome.`,
      );
    }
  }

  desired = applyCadence(desired, bars, spec.rebalance);

  const decisions = desired.filter((value) => value !== null).length;
  if (decisions === 0) {
    warnings.push("The rule never produced a decision over this window.");
  }

  return {
    desired,
    entries,
    exits,
    conflicts,
    firstDecisionIndex: Math.min(raw.firstDecisionIndex, bars.length),
    warnings,
  };
}

export interface CausalityFailure {
  prefixLength: number;
  index: number;
  full: unknown;
  prefix: unknown;
}

export interface CausalityReport {
  causal: boolean;
  failures: CausalityFailure[];
  /** Number of truncated prefixes compared. */
  probesRun: number;
}

/**
 * Generic causality check for any index-aligned series derived from bars.
 *
 * The series is recomputed over truncated prefixes of the data, and each answer
 * must match the corresponding prefix of the full run. A builder that reads a
 * future bar, directly or through an indicator, produces a different value once
 * that bar is removed, and the mismatch is reported with the index where it
 * first appeared.
 *
 * This is generic rather than hard-wired to `buildSignals` so that the guard
 * itself can be tested: a test can hand it a deliberately non-causal builder
 * and confirm it is caught. A guard that has never been shown to fail is not
 * evidence of anything.
 *
 * `ignoreLastOf` excuses the final positions of each prefix, which a calendar
 * cadence legitimately changes: truncating the data changes which bar ends the
 * last bucket.
 */
export function checkCausality<T>(
  bars: readonly Bar[],
  build: (slice: readonly Bar[]) => readonly T[],
  { probes = 12, ignoreLastOf = 0 }: { probes?: number; ignoreLastOf?: number } = {},
): CausalityReport {
  const full = build(bars);
  const failures: CausalityFailure[] = [];
  let probesRun = 0;

  const step = Math.max(1, Math.floor(bars.length / probes));
  for (let length = step; length < bars.length; length += step) {
    probesRun += 1;
    const prefix = build(bars.slice(0, length));
    const compareTo = Math.max(0, length - ignoreLastOf);
    for (let i = 0; i < compareTo; i += 1) {
      if (prefix[i] !== full[i]) {
        failures.push({ prefixLength: length, index: i, full: full[i], prefix: prefix[i] });
        break;
      }
    }
  }

  return { causal: failures.length === 0, failures, probesRun };
}

/**
 * Verifies that a strategy's decision series is causal.
 *
 * This is the one guard that catches look-ahead bias structurally rather than by
 * inspection, so the test suite runs it for every rule and every cadence.
 */
export function assertCausal(
  bars: readonly Bar[],
  spec: StrategySpec,
  { probes = 12 }: { probes?: number } = {},
): CausalityReport {
  return checkCausality(bars, (slice) => buildSignals(slice, spec).desired, {
    probes,
    ignoreLastOf: spec.rebalance === "signal" ? 0 : 1,
  });
}

/** Shifts a decision series forward by one bar, used to prove fills are not same-bar. */
export function shiftSignals(signals: SignalSeries): SignalSeries {
  return {
    ...signals,
    desired: [null, ...signals.desired.slice(0, -1)],
    entries: [false, ...signals.entries.slice(0, -1)],
    exits: [false, ...signals.exits.slice(0, -1)],
  };
}

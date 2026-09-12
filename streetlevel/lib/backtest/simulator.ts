/**
 * The execution simulator.
 *
 * Turns a desired-position series into fills, a trade ledger and an equity
 * curve under an explicit set of assumptions. The assumptions are the whole
 * point: a backtest is only as honest as its statement of what it could not
 * know, and with daily bars the intrabar sequence is unknowable.
 *
 * Bar loop, in order:
 *   1. Fill any order queued by the previous bar, at this bar's open or close.
 *   2. Check protective exits against this bar's range.
 *   3. Read the decision for this bar and queue an order for the next one.
 *
 * Step 1 preceding step 3 is what makes the engine causal. A decision read at
 * the close of bar `i` cannot be filled before bar `i + 1`, so no fill ever
 * uses a price the decision could not have been made without.
 *
 * Mutable state lives in a single `Book` object rather than in loose local
 * variables. The helpers below close over it, and a closure that reassigns a
 * captured local defeats TypeScript's narrowing, which would force casts at
 * every read site.
 */

import { finite, isNum, safeDiv, stdDev } from "../analytics/math.ts";
import { daysBetween } from "../analytics/series.ts";
import { PERIODS_PER_YEAR } from "../analytics/types.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { buildSignals } from "./signals.ts";
import type {
  EquityPoint,
  ExitReason,
  Fill,
  Position,
  SignalSeries,
  StrategySpec,
  Trade,
} from "./types.ts";

/** Bars of trailing returns used to size a volatility-targeted position. */
const VOLATILITY_LOOKBACK = 20;

interface PendingOrder {
  side: "buy" | "sell";
  reason: ExitReason | "entry";
}

interface OpenPosition {
  shares: number;
  entryIndex: number;
  entryTimestamp: string;
  /** Price actually paid, friction included. */
  entryPrice: number;
  /** Mid price before friction, used for the gross figure. */
  entryReferencePrice: number;
  entryCommission: number;
  entryFriction: number;
  highestClose: number;
  lowestLow: number;
  highestHigh: number;
}

interface Book {
  cash: number;
  position: OpenPosition | null;
  tradeCounter: number;
}

/** Half the spread plus slippage, as a fraction, charged against the direction. */
function frictionFraction(spec: StrategySpec): number {
  const slippage = Math.max(0, spec.costs.slippageBps) / 10_000;
  const halfSpread = Math.max(0, spec.costs.spreadBps) / 2 / 10_000;
  return slippage + halfSpread;
}

function commissionFor(spec: StrategySpec, shares: number, notional: number): number {
  const amount = Math.max(0, spec.costs.commission);
  switch (spec.costs.commissionKind) {
    case "per_share":
      return amount * shares;
    case "bps":
      return (amount / 10_000) * notional;
    case "per_trade":
    default:
      return shares > 0 ? amount : 0;
  }
}

/**
 * Shares to buy given available equity and the sizing policy.
 *
 * Sizing is computed from the price the order will actually fill at, friction
 * included, so a fully invested position cannot overdraw cash by the cost of
 * its own slippage.
 */
function sizePosition(
  spec: StrategySpec,
  equity: number,
  cash: number,
  fillPrice: number,
  trailingVolatility: Maybe,
): number {
  if (!isNum(fillPrice) || fillPrice <= 0) return 0;

  let targetNotional: number;
  switch (spec.sizing.kind) {
    case "fixed_shares":
      targetNotional = Math.max(0, spec.sizing.value) * fillPrice;
      break;
    case "fixed_fraction":
      targetNotional = equity * Math.max(0, spec.sizing.value);
      break;
    case "volatility_target": {
      // Scale exposure so realized volatility lands near the target. With no
      // usable estimate the position falls back to fully invested rather than
      // to zero, which would silently skip the entire warm-up.
      const target = Math.max(0, spec.sizing.value);
      targetNotional =
        trailingVolatility === null || trailingVolatility <= 0 ? equity : equity * (target / trailingVolatility);
      break;
    }
    case "all_in":
    default:
      targetNotional = equity;
      break;
  }

  const leverageCap = equity * Math.max(0, spec.sizing.maxLeverage || 1);
  targetNotional = Math.min(targetNotional, leverageCap, cash);
  if (targetNotional <= 0) return 0;

  const raw = targetNotional / fillPrice;
  const shares = spec.sizing.wholeShares ? Math.floor(raw) : raw;
  return shares > 0 ? shares : 0;
}

/** Annualized standard deviation of the trailing returns at a bar. */
function trailingVolatilityAt(bars: readonly Bar[], index: number): Maybe {
  const start = Math.max(1, index - VOLATILITY_LOOKBACK + 1);
  if (index - start < 2) return null;
  const returns: number[] = [];
  for (let i = start; i <= index; i += 1) {
    const previous = bars[i - 1].adjClose;
    if (previous > 0) returns.push(bars[i].adjClose / previous - 1);
  }
  const deviation = stdDev(returns);
  return deviation === null ? null : finite(deviation * Math.sqrt(PERIODS_PER_YEAR["1d"]));
}

export interface SimulationOutput {
  fills: Fill[];
  trades: Trade[];
  equity: EquityPoint[];
  unfilledOrders: number;
  warnings: string[];
}

/**
 * Runs the simulation.
 *
 * `signals` may be supplied directly, which is what the look-ahead tests use to
 * feed a deliberately shifted series; otherwise it is built from the spec.
 */
export function simulate(
  bars: readonly Bar[],
  spec: StrategySpec,
  options: { symbol?: string; signals?: SignalSeries } = {},
): SimulationOutput {
  const symbol = options.symbol ?? "ASSET";
  const warnings: string[] = [];

  if (bars.length === 0) {
    return { fills: [], trades: [], equity: [], unfilledOrders: 0, warnings: ["No bars to simulate."] };
  }

  const signals = options.signals ?? buildSignals(bars, spec);
  warnings.push(...signals.warnings);

  const friction = frictionFraction(spec);
  const fills: Fill[] = [];
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const book: Book = { cash: Math.max(0, spec.initialCapital), position: null, tradeCounter: 0 };

  let pending: PendingOrder | null = null;
  let unfilledOrders = 0;

  const openAt = (index: number, referencePrice: number, shares: number, effectivePrice: number): void => {
    const notional = shares * effectivePrice;
    const commission = commissionFor(spec, shares, notional);
    book.cash -= notional + commission;
    const frictionCost = shares * (effectivePrice - referencePrice);

    fills.push({
      index,
      timestamp: bars[index].timestamp,
      side: "buy",
      shares,
      referencePrice,
      effectivePrice,
      commission,
      frictionCost,
      reason: "entry",
    });

    book.position = {
      shares,
      entryIndex: index,
      entryTimestamp: bars[index].timestamp,
      entryPrice: effectivePrice,
      entryReferencePrice: referencePrice,
      entryCommission: commission,
      entryFriction: frictionCost,
      highestClose: bars[index].close,
      lowestLow: bars[index].low,
      highestHigh: bars[index].high,
    };
  };

  const buy = (index: number, referencePrice: number): boolean => {
    const effectivePrice = referencePrice * (1 + friction);
    const markEquity = book.cash + (book.position ? book.position.shares * bars[index].close : 0);
    let shares = sizePosition(spec, markEquity, book.cash, effectivePrice, trailingVolatilityAt(bars, index));
    if (shares <= 0) return false;

    // Sizing clamps to cash, so only the commission can tip the order over.
    let commission = commissionFor(spec, shares, shares * effectivePrice);
    if (shares * effectivePrice + commission > book.cash + 1e-9) {
      const affordableRaw = (book.cash - commission) / effectivePrice;
      shares = spec.sizing.wholeShares ? Math.floor(affordableRaw) : affordableRaw;
      if (shares <= 0) return false;
      commission = commissionFor(spec, shares, shares * effectivePrice);
      if (shares * effectivePrice + commission > book.cash + 1e-9) return false;
    }

    openAt(index, referencePrice, shares, effectivePrice);
    return true;
  };

  const sell = (index: number, referencePrice: number, reason: ExitReason): void => {
    const held = book.position;
    if (!held) return;

    const effectivePrice = referencePrice * (1 - friction);
    const shares = held.shares;
    const notional = shares * effectivePrice;
    const commission = commissionFor(spec, shares, notional);
    const frictionCost = shares * (referencePrice - effectivePrice);
    book.cash += notional - commission;

    fills.push({
      index,
      timestamp: bars[index].timestamp,
      side: "sell",
      shares,
      referencePrice,
      effectivePrice,
      commission,
      frictionCost,
      reason,
    });

    /**
     * The profit identity the ledger maintains:
     *   gross is measured on mid prices, before any cost;
     *   fees are every commission and every friction charge on both legs;
     *   net is gross less fees.
     *
     * Friction is already embedded in the effective fill prices, so it must be
     * subtracted from the mid-price gross exactly once. Subtracting it again
     * after using effective prices was double-counting it.
     */
    const gross = shares * (referencePrice - held.entryReferencePrice);
    const fees = held.entryCommission + held.entryFriction + commission + frictionCost;
    const net = gross - fees;
    book.tradeCounter += 1;
    trades.push({
      id: `t-${book.tradeCounter}`,
      symbol,
      entryIndex: held.entryIndex,
      entryTimestamp: held.entryTimestamp,
      entryPrice: held.entryPrice,
      exitIndex: index,
      exitTimestamp: bars[index].timestamp,
      exitPrice: effectivePrice,
      shares,
      fees,
      grossProfit: finite(gross),
      netProfit: finite(net),
      returnPct: safeDiv(net, shares * held.entryPrice),
      holdingBars: index - held.entryIndex,
      holdingDays: daysBetween(held.entryTimestamp, bars[index].timestamp),
      mae: safeDiv(held.lowestLow - held.entryPrice, held.entryPrice),
      mfe: safeDiv(held.highestHigh - held.entryPrice, held.entryPrice),
      exitReason: reason,
      open: false,
    });

    book.position = null;
  };

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];

    // 1. Fill the order queued on the previous bar.
    if (pending) {
      const referencePrice = spec.timing === "next_open" ? bar.open : bar.close;
      if (pending.side === "buy" && book.position === null) {
        if (!buy(i, referencePrice)) {
          warnings.push(`Order on ${bar.timestamp.slice(0, 10)} was skipped: the position size resolved to zero.`);
        }
      } else if (pending.side === "sell" && book.position !== null) {
        sell(i, referencePrice, "signal");
      }
      pending = null;
    }

    // 2. Track the excursion of an open position, then test protective exits
    //    against this bar's range.
    const held = book.position;
    if (held) {
      held.highestClose = Math.max(held.highestClose, bar.close);
      held.lowestLow = Math.min(held.lowestLow, bar.low);
      held.highestHigh = Math.max(held.highestHigh, bar.high);

      const stopPrice = spec.exits.stopLossPct > 0 ? held.entryPrice * (1 - spec.exits.stopLossPct) : null;
      const trailPrice = spec.exits.trailingStopPct > 0 ? held.highestClose * (1 - spec.exits.trailingStopPct) : null;
      const targetPrice = spec.exits.takeProfitPct > 0 ? held.entryPrice * (1 + spec.exits.takeProfitPct) : null;
      const effectiveStop =
        stopPrice !== null && trailPrice !== null ? Math.max(stopPrice, trailPrice) : (stopPrice ?? trailPrice);
      const stopReason: ExitReason =
        trailPrice !== null && (stopPrice === null || trailPrice >= stopPrice) ? "trailing_stop" : "stop_loss";

      if (effectiveStop !== null && bar.open <= effectiveStop) {
        // A bar that gaps through a level fills at the open, not at the level.
        // Pretending otherwise is the commonest way a backtest invents profit.
        sell(i, bar.open, stopReason);
      } else if (targetPrice !== null && bar.open >= targetPrice) {
        sell(i, bar.open, "take_profit");
      } else if (effectiveStop !== null && bar.low <= effectiveStop) {
        // Both levels touched inside one bar cannot be resolved without
        // intraday data, so the stop is assumed to fill first. This biases
        // results downward, which is the safe direction to be wrong in.
        sell(i, effectiveStop, stopReason);
      } else if (targetPrice !== null && bar.high >= targetPrice) {
        sell(i, targetPrice, "take_profit");
      } else if (spec.exits.maxHoldBars > 0 && i - held.entryIndex >= spec.exits.maxHoldBars) {
        sell(i, bar.close, "max_hold");
      }
    }

    // 3. Read the decision for this bar and queue the next order.
    const desired = signals.desired[i] ?? null;
    if (desired !== null) {
      const holding: Position = book.position ? 1 : 0;
      if (desired !== holding) {
        if (i === bars.length - 1) {
          // Nothing left to fill against, so the order is discarded rather than
          // filled on the very bar that produced it.
          unfilledOrders += 1;
        } else {
          pending = desired === 1 ? { side: "buy", reason: "entry" } : { side: "sell", reason: "signal" };
        }
      }
    }

    const current = book.position;
    const holdingsValue = current ? current.shares * bar.close : 0;
    equity.push({
      timestamp: bar.timestamp,
      equity: finite(book.cash + holdingsValue) ?? 0,
      cash: book.cash,
      shares: current ? current.shares : 0,
      exposure: holdingsValue,
      position: current ? 1 : 0,
    });
  }

  // A position still open at the end of the window is reported as an open trade
  // and marked to the final close. It is never counted as a closed round trip.
  const remaining = book.position;
  if (remaining) {
    const lastIndex = bars.length - 1;
    const lastBar = bars[lastIndex];
    // No exit has happened, so only the entry's costs apply. The same identity
    // holds: net is the mid-price gross less the fees actually paid.
    const gross = remaining.shares * (lastBar.close - remaining.entryReferencePrice);
    const fees = remaining.entryCommission + remaining.entryFriction;
    book.tradeCounter += 1;
    trades.push({
      id: `t-${book.tradeCounter}`,
      symbol,
      entryIndex: remaining.entryIndex,
      entryTimestamp: remaining.entryTimestamp,
      entryPrice: remaining.entryPrice,
      exitIndex: null,
      exitTimestamp: null,
      exitPrice: null,
      shares: remaining.shares,
      fees,
      grossProfit: finite(gross),
      netProfit: finite(gross - fees),
      returnPct: safeDiv(gross - fees, remaining.shares * remaining.entryPrice),
      holdingBars: lastIndex - remaining.entryIndex,
      holdingDays: daysBetween(remaining.entryTimestamp, lastBar.timestamp),
      mae: safeDiv(remaining.lowestLow - remaining.entryPrice, remaining.entryPrice),
      mfe: safeDiv(remaining.highestHigh - remaining.entryPrice, remaining.entryPrice),
      exitReason: null,
      open: true,
    });
  }

  if (unfilledOrders > 0) {
    warnings.push(
      `${unfilledOrders} ${unfilledOrders === 1 ? "order was" : "orders were"} discarded because the signal fired on the final bar.`,
    );
  }

  return { fills, trades, equity, unfilledOrders, warnings };
}

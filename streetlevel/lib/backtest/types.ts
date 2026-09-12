/**
 * Types for the backtest engine.
 *
 * The engine is long-only and bar-based. It is deliberately small in what it
 * claims: a strategy expresses a *desired position* at each bar, and the
 * simulator turns that into fills one bar later under stated cost and fill
 * assumptions. Every assumption that changes a result is a named field here
 * rather than a constant buried in the loop, so a run can be reproduced from
 * its specification alone.
 *
 * What this engine does not model: shorting, leverage, margin interest,
 * options, partial fills from limited liquidity, and anything that needs
 * intraday data. The bundled dataset is daily, so intrabar sequencing is an
 * assumption, not an observation, and `INTRABAR_POLICY` records which
 * assumption was made.
 */

import type { Bar, Maybe } from "../analytics/types.ts";

/** Long-only: the engine is either in the market or flat. */
export type Position = 0 | 1;

export type RuleKind =
  | "buy_and_hold"
  | "sma_cross"
  | "price_vs_sma"
  | "ema_cross"
  | "rsi_threshold"
  | "bollinger_reversion"
  | "macd_cross"
  | "donchian_breakout";

/** How a fill price is taken once an order has been decided. */
export type FillTiming = "next_open" | "next_close";

/** What to do when a rule asks to enter and exit on the same bar. */
export type ConflictPolicy = "exit_wins" | "entry_wins" | "hold";

export type SizingKind = "all_in" | "fixed_fraction" | "fixed_shares" | "volatility_target";

export type CommissionKind = "per_trade" | "per_share" | "bps";

export type RebalanceCadence = "signal" | "weekly" | "monthly";

export interface SizingSpec {
  kind: SizingKind;
  /**
   * Meaning depends on `kind`: a fraction of equity for `fixed_fraction`, a
   * share count for `fixed_shares`, an annualized volatility target as a
   * fraction for `volatility_target`, and ignored for `all_in`.
   */
  value: number;
  /** Round down to whole shares. Off allows fractional share sizing. */
  wholeShares: boolean;
  /** Cap on notional as a fraction of equity, applied after sizing. */
  maxLeverage: number;
}

export interface CostSpec {
  commission: number;
  commissionKind: CommissionKind;
  /** One-way slippage in basis points, applied against the trade direction. */
  slippageBps: number;
  /** Full bid-ask spread in basis points. Half is paid on each side. */
  spreadBps: number;
}

export interface ExitSpec {
  /** Stop loss as a fraction below the entry price, or 0 for none. */
  stopLossPct: number;
  /** Take profit as a fraction above the entry price, or 0 for none. */
  takeProfitPct: number;
  /** Trailing stop as a fraction below the highest close since entry, or 0 for none. */
  trailingStopPct: number;
  /** Maximum bars to hold before exiting regardless of signal, or 0 for none. */
  maxHoldBars: number;
}

export interface StrategySpec {
  rule: RuleKind;
  /** Rule parameters. Unknown keys are ignored; missing keys take rule defaults. */
  params: Record<string, number>;
  sizing: SizingSpec;
  costs: CostSpec;
  exits: ExitSpec;
  timing: FillTiming;
  conflict: ConflictPolicy;
  rebalance: RebalanceCadence;
  /** Starting cash. */
  initialCapital: number;
}

/**
 * The decision series a rule produces.
 *
 * `desired[i]` is the position wanted *as of the close of bar i*, and `null`
 * means the rule cannot decide yet because an indicator is still warming up.
 * A `null` is not "go flat": the simulator holds whatever it has through a
 * warm-up rather than churning.
 */
export interface SignalSeries {
  desired: Array<Position | null>;
  /** True on bars where the rule's entry condition fired. */
  entries: boolean[];
  /** True on bars where the rule's exit condition fired. */
  exits: boolean[];
  /** Bars where entry and exit fired together and `conflict` decided the outcome. */
  conflicts: number;
  /** Index of the first bar on which the rule could decide anything. */
  firstDecisionIndex: number;
  /** Human-readable notes, including insufficient-history messages. */
  warnings: string[];
}

export type ExitReason =
  | "signal"
  | "stop_loss"
  | "take_profit"
  | "trailing_stop"
  | "max_hold"
  | "end_of_data";

export interface Fill {
  index: number;
  timestamp: string;
  side: "buy" | "sell";
  shares: number;
  /** Reference price before costs. */
  referencePrice: number;
  /** Price actually paid or received, after slippage and half the spread. */
  effectivePrice: number;
  commission: number;
  /** Slippage and spread expressed in currency, for the cost report. */
  frictionCost: number;
  reason: ExitReason | "entry";
}

export interface Trade {
  id: string;
  symbol: string;
  entryIndex: number;
  entryTimestamp: string;
  entryPrice: number;
  exitIndex: number | null;
  exitTimestamp: string | null;
  exitPrice: number | null;
  shares: number;
  /** Commission plus friction on both legs. */
  fees: number;
  /** Before fees. */
  grossProfit: Maybe;
  /** After fees. */
  netProfit: Maybe;
  /** Net profit over the entry notional, as a fraction. */
  returnPct: Maybe;
  holdingBars: number;
  holdingDays: Maybe;
  /**
   * Maximum adverse excursion: the worst unrealized loss during the hold, as a
   * fraction of the entry price, taken from bar lows.
   */
  mae: Maybe;
  /** Maximum favourable excursion, taken from bar highs. */
  mfe: Maybe;
  exitReason: ExitReason | null;
  /** True when the position was still open at the end of the window. */
  open: boolean;
}

export interface EquityPoint {
  timestamp: string;
  /** Marked-to-market holdings plus cash. */
  equity: number;
  cash: number;
  shares: number;
  /** Holdings value only. */
  exposure: number;
  /** Position held during this bar. */
  position: Position;
}

export interface TradeStatistics {
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: Maybe;
  /** Gross wins divided by gross losses. */
  profitFactor: Maybe;
  /** Mean net profit per closed trade, in currency. */
  expectancy: Maybe;
  averageWin: Maybe;
  averageLoss: Maybe;
  /** Average win over average loss, both as magnitudes. */
  payoffRatio: Maybe;
  largestWin: Maybe;
  largestLoss: Maybe;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  averageHoldingBars: Maybe;
  averageMae: Maybe;
  averageMfe: Maybe;
  /** Fraction of bars with a position open. */
  exposure: Maybe;
  /** Longest run of consecutive flat bars. */
  longestFlatBars: number;
  /** Total notional traded divided by average equity, annualized. */
  turnover: Maybe;
  totalCommission: number;
  totalFriction: number;
}

export interface BacktestResult {
  symbol: string;
  spec: StrategySpec;
  bars: Bar[];
  signals: SignalSeries;
  fills: Fill[];
  trades: Trade[];
  equity: EquityPoint[];
  statistics: TradeStatistics;

  /** Total return of the equity curve, as a fraction. */
  totalReturn: Maybe;
  cagr: Maybe;
  /** Annualized standard deviation of daily equity returns. */
  volatility: Maybe;
  sharpe: Maybe;
  sortino: Maybe;
  maxDrawdown: Maybe;
  calmar: Maybe;
  /** Drawdown of the equity curve at each bar, for the underwater pane. */
  drawdownSeries: Maybe[];

  /** Buy-and-hold equity over the same window and cost model. */
  benchmarkEquity: EquityPoint[];
  benchmarkTotalReturn: Maybe;

  /** Orders that could not be filled because no later bar existed. */
  unfilledOrders: number;
  warnings: string[];
}

/**
 * The intrabar assumptions this engine makes, surfaced in the UI so a reader
 * knows which of its numbers are observations and which are conventions.
 */
export const INTRABAR_POLICY = [
  "A signal read at the close of one bar is filled on the next bar, never the same one.",
  "A bar that opens beyond a stop or target fills at the open, not at the trigger price.",
  "When a stop and a target are both touched inside one bar, the stop is assumed to fill first.",
  "A signal on the final bar has no later bar to fill against and is discarded.",
  "Slippage and half the quoted spread are charged against the trade direction on both legs.",
] as const;

export const DEFAULT_COSTS: CostSpec = {
  commission: 1,
  commissionKind: "per_trade",
  slippageBps: 5,
  spreadBps: 4,
};

export const DEFAULT_SIZING: SizingSpec = {
  kind: "all_in",
  value: 1,
  wholeShares: true,
  maxLeverage: 1,
};

export const DEFAULT_EXITS: ExitSpec = {
  stopLossPct: 0,
  takeProfitPct: 0,
  trailingStopPct: 0,
  maxHoldBars: 0,
};

export const DEFAULT_STRATEGY: StrategySpec = {
  rule: "sma_cross",
  params: { fast: 20, slow: 50 },
  sizing: DEFAULT_SIZING,
  costs: DEFAULT_COSTS,
  exits: DEFAULT_EXITS,
  timing: "next_open",
  conflict: "exit_wins",
  rebalance: "signal",
  initialCapital: 100_000,
};

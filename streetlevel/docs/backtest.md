# Backtest reference

The Performance page runs a trading rule over the bundled history. This document
is the contract: what the engine assumes, what it refuses to claim, and where
each behaviour is pinned by a test.

Run the suite with `npm test`.

## What this cannot tell you

Read this first, because it governs how every number on the page should be
taken.

| Limit | Value |
| --- | --- |
| Symbols | 10, all large-cap survivors |
| Sessions per symbol | 252 |
| Window | 2 Sep 2025 to 1 Sep 2026 |
| Intraday bars | none |

Ten hand-picked names that survived, with no delisted constituents, carries
severe survivorship bias. One non-overlapping year is a single observation of
any annual statistic. And with daily bars, the order of events inside a session
is an assumption rather than an observation.

So the feature is a transparent simulator, not a validation tool. The UI carries
that disclosure permanently rather than in a footnote, and the engine attaches
warnings to any run with a short window or a thin trade count.

## Execution model

A rule produces a **desired position** at each bar. The simulator turns that
into fills, in this order per bar:

1. Fill any order queued by the previous bar, at this bar's open or close.
2. Test protective exits against this bar's range.
3. Read the decision for this bar and queue an order for the next one.

Step 1 preceding step 3 is what makes the engine causal: a decision read at the
close of bar `t` cannot be filled before bar `t + 1`.

The assumptions that change results, all of them named fields on the
specification rather than constants in the loop:

- **A gap through a level fills at the open, not at the level.** A stop at 90
  against a bar that opens at 80 fills at 80. Claiming 90 manufactures ten
  dollars a share that nobody could have had.
- **When a stop and a target are both touched inside one bar, the stop fills
  first.** This is unresolvable without intraday data, and the choice biases
  results downward, which is the safe direction to be wrong in.
- **A signal on the final bar is discarded.** There is no later bar to fill
  against, and filling on the signal bar itself would be look-ahead.
- **Slippage and half the quoted spread are charged against the direction on
  both legs**, and the buy-and-hold benchmark pays the same. Comparing a
  cost-bearing strategy against a frictionless benchmark understates the
  strategy by exactly the amount the comparison exists to measure.
- **A `null` decision holds the current position** rather than going flat, so an
  indicator warm-up does not churn the book.

Long only. No shorting, leverage, margin interest, partial fills from limited
liquidity, or anything needing intraday data.

## Rules

Every rule is composed from the indicators in `lib/analytics/indicators.ts`, so
a crossover drawn on the analytics chart and one traded in a backtest cannot
disagree.

| Rule | Long while / Enters when |
| --- | --- |
| Buy and hold | Always, from the first fillable bar |
| SMA crossover | Fast simple average above the slow one |
| EMA crossover | Fast exponential average above the slow one |
| Price above average | Close above its own moving average |
| MACD histogram | Histogram positive |
| RSI reversion | Enters on a cross down through the lower band, exits on a cross up through the upper |
| Bollinger reversion | Enters below the lower band, exits above the middle band |
| Donchian breakout | Enters on a close above the prior window's high, exits below the prior window's low |

Two details worth stating:

**The first defined indicator reading is treated as a decision on its level,
not as a non-event.** A pure crossing rule never fires if the indicator is
already inside the band when it warms up, which is exactly the data where a
reversion rule should act. A series that has already fallen hard starts below
30, never crosses into it, and would otherwise never trade.

**Donchian compares against the window ending on the previous bar**, so a bar is
never measured against a high it set itself.

Entry and exit firing on the same bar is genuinely ambiguous, so the outcome is
a policy rather than an accident of evaluation order: `exit_wins` is the
conservative default, `entry_wins` the aggressive one, `hold` keeps whatever is
held.

## Causality

`checkCausality` recomputes a series over truncated prefixes of the data and
requires each answer to match the corresponding prefix of the full run. A
builder that reads a future bar, directly or through an indicator, produces a
different value once that bar is removed.

It is generic rather than wired to the signal layer so that **the guard itself
is tested**: the suite hands it a deliberately peeking builder and confirms it is
caught. A guard that has never been shown to fail is not evidence of anything.

The suite runs it for every rule, every cadence, and every symbol in the
dataset. A second test shifts the whole decision series forward by one bar and
requires the equity curve to change, which catches a same-bar fill.

## The trade ledger

One identity holds across every trade, and the suite asserts it on constructed
fixtures and on all ten real symbols:

```
net profit = gross profit − fees
```

- **gross** is measured on mid prices, before any cost
- **fees** are every commission and friction charge on both legs
- **net** is what the account actually kept

Friction is already embedded in the effective fill prices, so it is subtracted
from the mid-price gross exactly once. Subtracting it again after using
effective prices was a real bug, caught by a fixture where a flat round trip
should lose exactly its costs.

**Open positions are excluded from every closed-trade statistic.** A position
still running has not yet been right or wrong, and counting its paper profit as
a win is how a losing strategy is made to look like a winning one. A trade
whose net profit is exactly zero is a scratch, counted in neither wins nor
losses, so the win rate is over decided trades.

`profitFactor` is `null` rather than infinite when a strategy has never lost.

## Accounting

The simulator emits a transaction log, and `analyzePortfolio` from the analytics
engine derives cash, FIFO lots, the daily value series, time-weighted return and
drawdown from it independently. `reconcileEquity` reports the largest difference
between the two accountings.

The suite requires agreement within a hundredth of a cent across every symbol
and rule combination. Two independent code paths agreeing is the strongest
evidence available without an external vendor.

## Multi-symbol runs

One strategy across several names against **one** cash account. Running the
single-symbol engine once per name and adding the results would assume capital
the portfolio never had.

The calendar is the intersection of the constituents' trading days. A positional
walk across separate arrays would eventually pair one symbol's Monday with
another's Tuesday.

When more entries arrive on a bar than there are free position slots, candidates
are ranked by trailing volatility, lowest first. This is a deterministic
tie-break; ranking by array order would make the result depend on how the caller
happened to list the symbols, which the suite checks by running the same
portfolio with the symbols reversed and requiring an identical return.

Exits are filled before entries on a bar, so capital freed by a sale is
available to the same bar's buys.

## Sweeps and the multiple-testing correction

A grid search over one year will always return a winner. That is a property of
searching, not of the winner.

Every sweep reports the best cell, the **distribution** across all cells, and a
deflated Sharpe ratio. On NVDA with a 49-cell grid over the bundled year:

| Figure | Value |
| --- | --- |
| Best Sharpe | 0.38 |
| Median Sharpe | −0.29 |
| Expected best under the null | 2.28 |
| Deflated Sharpe | 0.03 |

The best cell would need a Sharpe near 2.3 to be distinguishable from the best
of 49 worthless rules. At 0.38 it is not, and the engine says so.

The deflated Sharpe uses the order-statistic result for the expected maximum of
many zero-mean draws, `(1 − γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(Ne))`, scaled by the
standard error of the Sharpe estimate.

That standard error is where a subtle error lives. The textbook expression
`sqrt((1 + SR²/2) / (n − 1))` applies to a Sharpe measured at the **same
frequency as the returns**. Applying it directly to an annualized figure
understates the error by the annualization factor, nearly fourteen for daily
data: it would claim one year of daily bars pins an annualized Sharpe to about
±0.07 when the true figure is nearer ±1. The error is therefore computed per
period and annualized the same way the Sharpe itself was. Without that fix the
deflation does nothing, and the suite pins the magnitude.

Invalid cells stay in the grid with null statistics rather than being dropped,
because the heatmap's axes have to match its cells.

## Walk-forward

Each fold picks parameters on an earlier slice and measures them on the slice
that immediately follows, which the choice never saw. This is the only figure on
the page that the search did not contaminate.

`efficiency` is out-of-sample mean return over in-sample mean return. Well below
1 means the parameter choice did not generalise. With 252 bars and three folds
each slice holds about 63 sessions, below what the engine considers usable, and
it says so.

## Hardening

`sanitizeSpec` clamps every field into a runnable range and reports what it
changed. Input is corrected rather than rejected, because it arrives from URL
parameters anyone can edit: a malformed link should open a working page with a
note, not an error screen.

`guardedRun` validates, bounds the bar count, runs, and memoizes. Nothing in the
engine reads a clock, a random source or ambient state, so the same
specification over the same bars always yields the same result, which is what
makes the cache key sound. The memo is keyed on inputs and never expires on a
timer; `clearRunCache` is the only invalidation.

The cache key is built by `canonicalize`, which sorts object keys at every
level. `JSON.stringify(value, keys)` looks like it would do this, but its second
argument is a property **allowlist** applied at every depth, so passing the
top-level keys dropped every nested key. Two specifications differing only in
their parameters serialized identically and collided, returning one strategy's
result for another's request. A test now requires the key to change for a change
at any depth.

Non-finite figures are caught before they reach the UI: a run producing one is
discarded with an error rather than rendered.

## Sharing a run

Every field that changes the outcome is encoded in the query string, so a pasted
link reruns exactly the same simulation. Defaults are omitted to keep links
short. Decoding is total: an unreadable parameter falls back to its default and
the page says what it adjusted.

The query is parsed on the **server** and passed down as a prop. Reading it with
`useSearchParams` in the client component opted the whole subtree out of server
rendering, so a shared link showed a skeleton until hydration.

## Test coverage

| File | Covers |
| --- | --- |
| `tests/backtest-signals.test.ts` | every rule, cadences, conflicts, causality, the guard itself |
| `tests/backtest-simulator.test.ts` | fill timing, hand-computed profit, costs, gaps, stops, reconciliation |
| `tests/backtest-sweep.test.ts` | normal quantiles, expected maximum, deflated Sharpe, grids, walk-forward |
| `tests/backtest-portfolio.test.ts` | shared cash, shared calendar, slots, ranking, attribution |
| `tests/backtest-runner.test.ts` | sanitizing, cache keys at depth, bounds, determinism |
| `tests/backtest-dataset.test.ts` | all rules on all symbols, cross-engine agreement, cost monotonicity |

The cross-engine check is the important one: buy-and-hold through the simulator
reproduces the return the analytics engine reports for the same window, on every
symbol, and the equity curve reconciles with the portfolio replay across all
eighty symbol-and-rule combinations.

# Analytics reference

Every figure the site displays is produced by a pure function in `lib/analytics`.
This document is the contract those functions honour: the formula, what happens
at the edges, and where the behaviour is pinned by a test.

Run the suite with `npm test`. It uses Node's built-in test runner with type
stripping, so there is no build step and no test dependency.

## Conventions

**Returns are fractions, not percentages.** `0.0512` means +5.12%. The
multiplication by 100 happens exactly once, in `format.ts`. Mixing the two
representations is the usual cause of hundred-fold errors in this kind of code,
so the boundary is kept sharp.

**Adjusted versus raw prices.** Return, volatility, drawdown, moving-average and
oscillator maths all use `adjClose`, the split- and dividend-adjusted close.
Candles, the period high and low, and the currency change use the raw `open`,
`high`, `low` and `close`, so what is drawn matches what traded on the day.
Across a dividend or a split the percentage return and the currency change can
legitimately disagree; that is correct, not a defect.

**Nulls, never NaN.** Every metric returns `null` when it cannot be computed. No
function in this module returns `NaN` or `±Infinity`. Division goes through
`safeDiv`, which treats a zero denominator as undefined rather than as
infinitely large. Formatters render `null` as an em dash, so a reader can scan a
column and see immediately which cells have data.

**Rounding happens once, at the end.** Calculations keep full double precision
throughout; `format.ts` is the only place values are rounded. This stops errors
compounding through chained metrics such as "volatility of daily returns".
`round()` rounds half away from zero, which is symmetric for negatives, and
normalizes `-0` so no cell ever reads `-0.00`.

| Quantity | Displayed precision |
| --- | --- |
| Price at or above $1 | 2 decimals |
| Price below $1 | 4 decimals |
| Price change | 2 decimals, always signed |
| Percentages | 2 decimals, 1 or 0 where noted |
| Ratios (beta, Sharpe) | 2 decimals |
| RSI and other point readings | 1 decimal |
| Volume | Compact, `65.4M` |
| Dates | UTC, `Sep 1, 2026` |

## Series hygiene

`normalizeBars` runs before anything else. It rejects a bar when a price is
missing, non-finite or not strictly positive, when volume is negative, when the
low exceeds the high, or when the open or close falls outside the day's range.
That last check catches a feed that has mixed adjusted and unadjusted fields,
which otherwise corrupts candles silently. Duplicate timestamps collapse to the
last occurrence, matching how providers issue corrections. Out-of-order bars are
sorted and counted.

The result carries a `DataQuality` record: bars accepted, rejected, duplicated,
reordered, weekday sessions missing inside the covered window, and how many
trading days old the newest bar is. Staleness is measured in **weekdays**, so a
Friday close read on a Sunday is zero days stale rather than two.

`resolveRange` anchors every named window on the newest bar in the dataset, not
on wall-clock time. Anchoring on `Date.now()` returns an empty chart whenever
the feed is a few days behind, which is precisely when someone wants to look.
Staleness is reported separately instead.

A window is marked `truncated` only when its `coverage` falls below 0.97 of the
requested span. A one-year request against exactly one year of daily bars begins
a day or two after the calendar anniversary, because the first session of the
window is not the anniversary itself; flagging that would put a warning on a
complete chart.

## Return and risk

| Metric | Formula | Unavailable when |
| --- | --- | --- |
| Simple return | `(to - from) / from` | `from` is not strictly positive |
| Total / period return | first `adjClose` to last | fewer than 2 bars |
| Absolute change | last `close` minus first `close` | fewer than 2 bars |
| Daily returns | `C_t / C_(t-1) - 1` per bar transition | fewer than 2 bars |
| Weekly / monthly returns | bucket close to previous bucket's close | fewer than 2 buckets |
| CAGR | `(end / start)^(365.25 / days) - 1` | window under 330 days |
| Annualized volatility | `σ_sample(r) × √P` | fewer than 2 returns |
| Drawdown at t | `C_t / max(C_0..C_t) - 1` | empty series |
| Max drawdown | minimum of the drawdown series | empty series |
| Sharpe | `(mean(r)·P − rf) / (σ·√P)` | σ is 0 or undefined |
| Sortino | same, over `√(mean(min(r − MAR, 0)²))` | nothing ever falls |
| Calmar | CAGR / abs(max drawdown) | no CAGR, or no drawdown |

`P` is periods per year: 252 daily, 52 weekly, 12 monthly.

Weekly and monthly returns are measured from the **previous** bucket's final
close, so no part of a move is lost at the boundary. The first bucket has no
predecessor and is omitted, which is why a three-month window yields two or
three monthly returns rather than four.

CAGR is withheld below 330 days rather than shown with a caveat. Annualizing a
one-month move produces figures like +900% that are arithmetically correct and
analytically meaningless. Volatility takes the opposite approach: it is reported
from two returns onward but flagged `sufficient: false` below 20 observations, so
the UI can mark it indicative rather than hide it.

Volatility uses the **sample** standard deviation, dividing by `n − 1`. A return
series is a sample from an unknown distribution, not a complete population.

Drawdown is computed on closes throughout. Using intraday lows would give a
deeper and equally defensible number, but mixing the two conventions across a
page is what makes two cards disagree.

Period high and low use **intraday** extremes, because a "52-week high" that
ignores the wick is not what anyone means by the phrase.

## Volume

`average` and `median` cover the window; the median is reported because a single
earnings-day spike distorts the mean. `latestVsAverage` compares the newest bar
against the trailing 20-bar average **excluding itself**; including it dampens
exactly the spike the metric exists to detect. `periodOverPeriod` compares the
window's average against the equally long window immediately before it, and is
`null` when no such window exists.

## Indicators

Every indicator returns an array the same length as its input, with `null` in
the warm-up positions. Index alignment with the bars is what lets the chart
overlay a series without re-deriving offsets, and it makes short history
explicit rather than implied by a shorter array.

- **SMA(n)** — mean of the trailing `n` closes, defined from index `n − 1`.
- **EMA(n)** — `k = 2 / (n + 1)`, seeded at index `n − 1` with the SMA of the
  first `n` values. Seeding with the first close instead leaves a visible bias
  for several multiples of the period and does not match published charts.
- **RSI(14)** — Wilder's smoothing of gains and losses, then
  `100 − 100 / (1 + avgGain / avgLoss)`. Needs 15 closes.
  - `avgLoss = 0` with a positive gain divides by zero; RSI is 100 there.
  - `avgGain = 0` with a positive loss gives 0.
  - Both zero means a perfectly flat window. RS is genuinely undefined, and RSI
    is reported as the neutral **50**, not the 100 a divide-by-zero shortcut
    produces and which would read as maximally overbought.
- **MACD(12, 26, 9)** — `EMA(12) − EMA(26)`, signal is the 9-period EMA of that
  line seeded from its first defined values, histogram is their difference.
- **Bollinger(20, 2)** — SMA centre with the **population** deviation of the
  window, which is Bollinger's own definition; the sample estimator widens the
  bands and would not match published charts. `%B` is `null` on a flat window
  where the bands collapse.
- **ATR(14)** — Wilder smoothing of
  `max(H − L, |H − C_prev|, |L − C_prev|)`, which counts overnight gaps that a
  plain high-minus-low ignores.
- **OBV** — running volume total signed by the close change, seeded at 0, so
  only the shape is meaningful.
- **Crosses** — the fast average moving from at-or-below to strictly above the
  slow average, and the reverse. Warm-up positions are skipped.

Price against a moving average is `(price / ma) − 1`. When the average has not
warmed up, the comparison, the value and the above/below flag are all `null` and
the UI shows bars available against bars required.

## Comparison

Two series are joined on UTC calendar day by `alignSeries` before anything is
computed. Assets differ in listing date, holiday calendar and halts, so a
positional zip eventually pairs Monday's close for one with Tuesday's for the
other. Days missing on either side are dropped and counted rather than
forward-filled: carrying a stale price forward manufactures a zero return and
biases correlation upward.

Both legs are rebased to 100 at the first **shared** date, so the chart answers
"what would a dollar have done". Rebasing each leg to its own first bar, when
those bars fall on different days, produces a chart that looks right and is
wrong.

| Metric | Formula |
| --- | --- |
| Excess return | asset total return − benchmark total return |
| Relative growth | `(1 + asset) / (1 + benchmark) − 1` |
| Correlation | Pearson, on aligned periodic returns |
| Beta | `cov(asset, benchmark) / var(benchmark)` |
| Alpha | `assetCAGR − (rf + β·(benchCAGR − rf))` |
| Tracking error | `σ(asset − benchmark) × √P` |
| Information ratio | annualized mean excess / tracking error |

Correlation, beta, tracking error and the information ratio are withheld below
20 aligned observations, with a note added to `warnings`. A beta computed from
four days is noise with a decimal point.

The dataset ships no index series, so the house benchmark is `SL10`, an
equal-weight composite of the ten covered names rebased to 100 at the first date
all of them trade. It is labelled as that in the UI, not as a proxy for a
published index.

## Portfolio

The portfolio is replayed from a transaction log rather than read from a
holdings snapshot. A snapshot cannot say what was paid or when money entered, so
it cannot support a return figure.

Cost basis uses **FIFO** lots, with commissions capitalized into the purchase
price. The lot method changes only the split between realized and unrealized
profit, never the total. A sale larger than the position consumes what is there
and ignores the excess; a short position is not representable in this model, so
going negative would produce a cost basis with no meaning.

A holding with no price is reported in `unpricedSymbols` and excluded from total
value, weights and risk, rather than valued at zero. Valuing it at zero would
understate the account and show a loss that did not happen. Because the cash
that bought it did leave the account, `unrealizedPl + realizedPl` then exceeds
`totalValue − netContributions` by exactly `unpricedCostBasis`, which is
reported for that reason and shown in the UI.

Return is **time-weighted**: daily returns are `(V_t − F_t) / V_(t−1) − 1`, with
`F_t` the external flow settled that day, then chained. Deposits and withdrawals
move the account value without being performance, and a page that blurs the two
flatters whoever added money on a good week.

Contribution is `(endValue − startValue − netPurchases) / startTotalValue` per
position. The contributions sum to the portfolio return, which is asserted in
`tests/portfolio.test.ts`.

Effective holdings is the inverse Herfindahl index of the **invested** weights,
renormalized to sum to 1. Computed on weights that include cash, nine roughly
equal positions beside 9% cash score above ten, which is nonsense. Cash is
reported separately.

## Charts

Bars are laid out on a band scale **indexed by position**, not by elapsed time.
That is the whole of the weekend and holiday handling: a series that jumps
Friday to Monday draws as two adjacent bars with no dead gap, because the axis
counts sessions.

A `null` in a series starts a new subpath rather than interpolating across it.
Drawing a straight line over a warm-up period or a missing session invents data
that was never there.

Past 1,200 bars the series is thinned by `downsampleIndices`, which returns
positions rather than items so the same selection applies to the bars and to
every overlay and pane. Thinning each array independently would misalign the
crosshair from the line it is reading. Each bucket contributes its minimum and
its maximum in the order they occurred, so a one-session spike survives; plain
every-nth sampling drops it.

Zero-width domains are widened by a unit rather than dividing by zero, so a flat
series draws through the middle of the plot instead of collapsing onto an edge.
Volume axes are anchored at zero, because a bar chart that does not start at
zero exaggerates every difference.

## API

| Endpoint | Notes |
| --- | --- |
| `GET /api/analytics/:symbol/history` | `interval`, `range`, or explicit `start` and `end` |
| `GET /api/analytics/:symbol/quote` | latest bar as a quote, with staleness |
| `GET /api/analytics/:symbol/summary` | the full snapshot, without the bar arrays |
| `GET /api/analytics/quotes?symbols=` | batch, up to 25, partial success |

Errors return `{ error: { code, message, action? } }`. Codes map to fixed
statuses: validation failures 400, unknown symbol 404, a known interval the
current source cannot serve 422, rate limit 429, empty upstream 503, anything
unexpected 500 with a generic body and the real cause logged server-side.

Symbols must be 1 to 12 characters starting with a letter, which admits
`BRK.B` and `SHOP.TO` while rejecting traversal, wildcards and injection
payloads. Dates must be full ISO-8601 UTC timestamps; a bare `2026-01-01`, a
local time, an offset time and an overflow date such as `2026-02-31` are all
refused, because `new Date()` accepts several of those and silently skews the
window.

The batch quote endpoint succeeds partially, listing unknown tickers under
`missing`, so one bad symbol in a watchlist does not blank every other row.

Responses are cached in process with an explicit TTL and LRU eviction, and only
successful responses are written back: caching an error would turn a transient
upstream failure into a minute of guaranteed failures. Expired entries are
evicted on read, so nothing is served that is known to be stale.

## Test coverage

| File | Covers |
| --- | --- |
| `tests/math.test.ts` | guards, rounding, aggregates, correlation |
| `tests/indicators.test.ts` | SMA, EMA, RSI, MACD, Bollinger, ATR, OBV, crosses |
| `tests/returns.test.ts` | returns, CAGR, volatility, drawdown, extremes, volume, ratios |
| `tests/series.test.ts` | validation, ranges, resampling, alignment, composite |
| `tests/compare.test.ts` | rebasing, excess return, beta, correlation matrix |
| `tests/portfolio.test.ts` | lots, sells, missing prices, TWR, allocation, contribution |
| `tests/news.test.ts` | de-duplication, symbol association, event markers |
| `tests/format.test.ts` | null rendering, percentages, volume, UTC dates |
| `tests/summary.test.ts` | snapshot shape, insufficient history, empty input, intervals |
| `tests/chart.test.ts` | scales, ticks, paths with gaps, hit testing, thinning, zoom |
| `tests/api.test.ts` | request validation, error mapping, cache, rate limiter |
| `tests/dataset.test.ts` | the bundled dataset, with figures re-derived independently |

RSI is checked against Wilder's published worked example and, at every index,
against a second implementation transcribed separately from the formula in
`tests/helpers.ts`. EMA is checked the same way. The integration tests re-derive
total return, absolute change, annualized volatility, max drawdown, period
extremes and average volume from the raw JSON with inline arithmetic, so the
engine is compared against something other than itself.

The independent reference is a second implementation, not an external data
vendor. The bundled dataset is a fixed snapshot, so before a release against a
live feed the headline figures should also be spot-checked against the
provider's own published values.

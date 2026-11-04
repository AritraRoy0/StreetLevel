/**
 * Guide bodies.
 *
 * Each guide explains one measure the way the engine in `lib/analytics` and
 * `lib/backtest` actually computes it, edge cases included, and pairs the
 * explanation with a table computed from the bundled dataset at build time.
 *
 * The prose deliberately quotes no figures from the data. Every number a
 * reader sees comes from the live panel beside it, so the text cannot drift
 * out of date when the dataset is refreshed.
 *
 * Server-only: the catalog in `catalog.ts` is what client code imports.
 */

export type LiveKey =
  | "rsi"
  | "macd"
  | "bollinger"
  | "moving-averages"
  | "crosses"
  | "atr"
  | "volatility"
  | "drawdown"
  | "sharpe"
  | "sortino"
  | "beta"
  | "correlation"
  | "cagr"
  | "deflated-sharpe"
  | "walk-forward";

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface GuideBody {
  /** The opening paragraph: what the measure is, in two sentences. */
  lede: string;
  formula?: { lines: string[]; legend: Array<{ term: string; meaning: string }> };
  sections: GuideSection[];
  live?: LiveKey;
  /** A preset for the backtest workspace, as its query string. */
  backtest?: { query: string; label: string };
  faqs: GuideFaq[];
  /** Slugs of related guides. */
  related: string[];
}

export const GUIDES: Record<string, GuideBody> = {
  rsi: {
    lede:
      "The Relative Strength Index measures the speed and size of recent price changes on a scale from 0 to 100. Readings above 70 are conventionally called overbought and readings below 30 oversold.",
    formula: {
      lines: [
        "gain_t = max(C_t − C_(t−1), 0)",
        "loss_t = max(C_(t−1) − C_t, 0)",
        "avgGain_t = (avgGain_(t−1) · 13 + gain_t) / 14",
        "avgLoss_t = (avgLoss_(t−1) · 13 + loss_t) / 14",
        "RSI = 100 − 100 / (1 + avgGain / avgLoss)",
      ],
      legend: [
        { term: "C_t", meaning: "the close on session t, adjusted for splits and dividends" },
        { term: "avgGain, avgLoss", meaning: "seeded with the simple mean of the first 14 gains and losses" },
        { term: "14", meaning: "the lookback period Wilder proposed, and the default almost everywhere" },
      ],
    },
    sections: [
      {
        heading: "What RSI measures",
        paragraphs: [
          "J. Welles Wilder introduced the RSI in 1978 in New Concepts in Technical Trading Systems. It compares the average size of the up-closes in a lookback window with the average size of the down-closes. When gains dominate, the ratio of the two is large and RSI approaches 100; when losses dominate it approaches 0.",
          "Because it is bounded, RSI can be read on the same scale for any stock at any price, which is a large part of why it became the most widely used momentum oscillator.",
        ],
      },
      {
        heading: "How it is calculated, step by step",
        paragraphs: [
          "The calculation works on close-to-close changes, so fourteen changes need fifteen closes. That is why a 14-period RSI has no value until the fifteenth bar.",
        ],
        bullets: [
          "Take the change between each close and the one before it.",
          "Split each change into a gain (the change if positive, otherwise zero) and a loss (the size of the change if negative, otherwise zero).",
          "Seed the averages with the simple mean of the first 14 gains and the first 14 losses.",
          "From then on, smooth each average with Wilder's method: keep 13/14 of the previous average and add 1/14 of the new value.",
          "Divide the average gain by the average loss to get RS, and convert it with RSI = 100 − 100 / (1 + RS).",
        ],
      },
      {
        heading: "Reading the indicator",
        paragraphs: [
          "The 70 and 30 bands are conventions, not laws. In a strong uptrend RSI can stay above 70 for weeks while the price keeps rising, so an overbought reading on its own is a description of recent momentum rather than a sell signal. Some traders widen the bands to 80 and 20 for volatile stocks, or watch the 50 line as a simple trend filter.",
          "Divergence is the other common reading: the price makes a new high while RSI makes a lower high, suggesting the advance is losing force. It is a prompt to look closer, and it can persist for a long time before anything happens.",
        ],
      },
      {
        heading: "Edge cases worth getting right",
        paragraphs: [
          "When the average loss is zero and the average gain is positive, RS divides by zero and RSI is defined as 100. When the average gain is zero, RSI is 0. When both are zero the price has not moved at all; RS is genuinely undefined and StreetLevel reports a neutral 50, rather than the 100 that a divide-by-zero shortcut produces and that would read as maximally overbought.",
          "The input is the adjusted close. Using the raw close would turn a stock split into an enormous one-day loss and drag RSI towards zero for weeks.",
        ],
      },
      {
        heading: "Testing RSI as a trading rule",
        paragraphs: [
          "The StreetLevel backtester includes an RSI reversion rule: it buys when RSI crosses down through the lower band and sells when it crosses up through the upper band. The first defined reading counts as a decision on its level, so a stock that is already below 30 when the indicator warms up is treated as oversold rather than ignored until it crosses again.",
        ],
      },
    ],
    live: "rsi",
    backtest: { query: "rule=rsi_threshold&symbol=NVDA", label: "Backtest RSI reversion on NVDA" },
    faqs: [
      {
        question: "What is a good RSI value?",
        answer:
          "There is no good or bad value. Readings between 30 and 70 are conventionally neutral, above 70 overbought and below 30 oversold, but a strongly trending stock can stay outside those bands for weeks.",
      },
      {
        question: "Why does a 14-period RSI need 15 prices?",
        answer:
          "RSI is built from changes between consecutive closes, and 14 changes require 15 closes. The first RSI value therefore appears on the fifteenth bar.",
      },
      {
        question: "What is the difference between Wilder's RSI and an RSI built with an EMA?",
        answer:
          "Wilder's smoothing gives the newest value a weight of 1/14, while a standard 14-period exponential moving average gives it 2/15. An EMA-based RSI therefore reacts faster. Wilder's version is the original and the one most charting platforms display.",
      },
      {
        question: "Is RSI calculated on closing prices?",
        answer:
          "Yes. StreetLevel uses closes adjusted for splits and dividends, so a corporate action does not register as a price move.",
      },
    ],
    related: ["macd", "bollinger-bands", "moving-averages", "average-true-range"],
  },

  macd: {
    lede:
      "MACD tracks the gap between a fast and a slow exponential moving average of price. Its signal line and histogram show whether that gap is widening or narrowing, which is a read on whether momentum is building or fading.",
    formula: {
      lines: [
        "MACD line = EMA12(C) − EMA26(C)",
        "Signal    = EMA9(MACD line)",
        "Histogram = MACD line − Signal",
      ],
      legend: [
        { term: "EMA_n", meaning: "exponential moving average with weight 2 / (n + 1), seeded with the simple average of its first n values" },
        { term: "C", meaning: "the adjusted close" },
      ],
    },
    sections: [
      {
        heading: "What MACD measures",
        paragraphs: [
          "Gerald Appel developed the Moving Average Convergence Divergence in the late 1970s, and Thomas Aspray added the histogram in 1986. The MACD line is positive when the 12-period average sits above the 26-period average, which happens when recent prices are higher than older ones, and its slope shows whether that difference is growing.",
          "The signal line is a 9-period average of the MACD line itself, and the histogram is the distance between the two. A histogram that shrinks towards zero says momentum is fading even while the MACD line is still positive.",
        ],
      },
      {
        heading: "How much history it needs",
        paragraphs: [
          "The 26-period average needs 26 closes before it has a value, so the MACD line starts on the 26th bar. The signal line then needs nine MACD values of its own, so the signal and the histogram start on the 34th bar.",
          "StreetLevel seeds each exponential average with the simple average of its first n values. Seeding with the first close instead is common and leaves a visible bias for several multiples of the period, which is why two charts of the same stock can disagree near the start of their data.",
        ],
      },
      {
        heading: "Reading crossovers and the zero line",
        paragraphs: [
          "The most common signal is the MACD line crossing its signal line, which is the same event as the histogram changing sign. A cross of the MACD line through zero marks the 12 and 26-period averages themselves crossing.",
          "Both are lagging signals built from averages of averages. They tend to work in sustained trends and to produce a run of small losses when the price moves sideways.",
        ],
      },
      {
        heading: "Why MACD cannot be compared across stocks",
        paragraphs: [
          "MACD is measured in price units. A MACD of 2 is a large reading for a $40 stock and a negligible one for a $900 stock, so ranking a list of stocks by MACD ranks them mostly by share price. To compare names, divide the MACD line by a moving average of price; that ratio is known as the percentage price oscillator. The histogram's sign, which is what the table on this page reports as the trend, is comparable.",
        ],
      },
    ],
    live: "macd",
    backtest: { query: "rule=macd_cross&symbol=AMD", label: "Backtest the MACD histogram rule on AMD" },
    faqs: [
      {
        question: "What do the numbers 12, 26 and 9 mean in MACD?",
        answer:
          "They are the lookback periods: a 12-period fast exponential average, a 26-period slow one, and a 9-period average of their difference for the signal line. They are Appel's original defaults and still the standard.",
      },
      {
        question: "How many bars does MACD need?",
        answer:
          "The MACD line needs 26 closes. The signal line and histogram need 34, because the 9-period signal average starts only once the MACD line has nine values.",
      },
      {
        question: "Is a MACD crossover a buy signal?",
        answer:
          "A cross of the MACD line above its signal line shows that short-term momentum has turned up relative to the recent past. It is a lagging trend signal that performs best in trending markets and whipsaws in sideways ones, so it is usually combined with other evidence.",
      },
      {
        question: "Can I compare MACD values between two stocks?",
        answer:
          "Not directly, because MACD is in price units and scales with the share price. Compare the sign of the histogram, or normalise MACD by price to get the percentage price oscillator.",
      },
    ],
    related: ["moving-averages", "rsi", "golden-cross", "bollinger-bands"],
  },

  "bollinger-bands": {
    lede:
      "Bollinger Bands draw an envelope two standard deviations above and below a 20-period moving average. The bands widen when the price becomes more volatile and narrow when it calms, so they adapt to each stock on their own.",
    formula: {
      lines: [
        "Middle = SMA20(C)",
        "Upper  = Middle + 2 · σ20",
        "Lower  = Middle − 2 · σ20",
        "%B     = (C − Lower) / (Upper − Lower)",
        "Bandwidth = (Upper − Lower) / Middle",
      ],
      legend: [
        { term: "σ20", meaning: "the population standard deviation of the last 20 closes" },
        { term: "%B", meaning: "where the close sits inside the bands: 0 at the lower band, 1 at the upper" },
      ],
    },
    sections: [
      {
        heading: "What the bands show",
        paragraphs: [
          "John Bollinger introduced the bands in the 1980s. Because their width is set by the recent standard deviation of price, the same two-deviation envelope is tight around a quiet utility and wide around a volatile chip stock, with no tuning per symbol.",
          "Under a normal distribution about 95% of observations fall within two standard deviations, but daily prices are not normally distributed, so closes outside the bands are more common than that figure suggests. Treat the 95% as intuition rather than a probability.",
        ],
      },
      {
        heading: "Reading %B and bandwidth",
        paragraphs: [
          "%B turns the bands into a single number. Above 1 the close is above the upper band; below 0 it is below the lower band; 0.5 is the middle line. It is the figure the table on this page ranks by, because unlike the band levels it is comparable across stocks.",
          "Bandwidth measures how wide the bands are relative to price. Unusually low bandwidth, often called a squeeze, marks a quiet period, and quiet periods tend to be followed by larger moves, though the bands say nothing about which direction.",
        ],
      },
      {
        heading: "Population or sample deviation",
        paragraphs: [
          "Bollinger's definition uses the population standard deviation, dividing by 20. Some libraries use the sample deviation, dividing by 19, which widens every band by about 2.6% and stops the chart matching published ones. StreetLevel uses the population form.",
          "When all 20 closes are identical the bands collapse onto the average and %B divides by zero. StreetLevel reports %B as unavailable in that case rather than inventing a value.",
        ],
      },
      {
        heading: "Touching a band is not a signal by itself",
        paragraphs: [
          "In a strong trend the price can walk along the upper band for many sessions. Mean-reversion strategies that sell every touch of the upper band tend to do well in ranges and badly in trends, which is exactly the kind of claim worth testing before trusting.",
        ],
      },
    ],
    live: "bollinger",
    backtest: { query: "rule=bollinger_reversion&symbol=AAPL", label: "Backtest Bollinger reversion on AAPL" },
    faqs: [
      {
        question: "What does %B mean in Bollinger Bands?",
        answer:
          "%B is the position of the close within the bands: 0 at the lower band, 0.5 at the middle and 1 at the upper band. Values above 1 or below 0 mean the close is outside the bands.",
      },
      {
        question: "Why are Bollinger Bands set at two standard deviations?",
        answer:
          "Two deviations is Bollinger's default and roughly corresponds to 95% of a normal distribution. Because price changes have fatter tails than a normal distribution, closes outside the bands happen somewhat more often than that.",
      },
      {
        question: "Do Bollinger Bands use the sample or the population standard deviation?",
        answer:
          "The population standard deviation, which divides by the number of periods. Using the sample version widens the bands slightly and no longer matches the standard definition.",
      },
      {
        question: "Is touching the upper Bollinger Band a sell signal?",
        answer:
          "Not on its own. A close at the upper band shows the price is high relative to its recent range, and in a trending market it can stay there for a long time.",
      },
    ],
    related: ["volatility", "moving-averages", "rsi", "average-true-range"],
  },

  "moving-averages": {
    lede:
      "A moving average smooths a price series by averaging a trailing window of closes. The simple moving average weights every close in the window equally; the exponential moving average weights recent closes more heavily, so it turns sooner.",
    formula: {
      lines: [
        "SMA_n(t) = (C_t + C_(t−1) + … + C_(t−n+1)) / n",
        "EMA_n(t) = k · C_t + (1 − k) · EMA_n(t−1),   k = 2 / (n + 1)",
        "EMA_n seed = SMA_n of the first n closes",
        "Price vs average = C_t / MA_t − 1",
      ],
      legend: [
        { term: "n", meaning: "the number of sessions in the window" },
        { term: "k", meaning: "the EMA's weight on the newest close: 2/21 for a 20-period EMA" },
      ],
    },
    sections: [
      {
        heading: "Simple versus exponential",
        paragraphs: [
          "The simple average treats a close from n sessions ago the same as today's, then drops it entirely the next day. That makes it smooth and easy to reason about, but it lags, and it can jump when a large move leaves the window.",
          "The exponential average never drops a close; it lets each one fade geometrically. It reacts faster to a new move and has no drop-off effect, at the cost of being more sensitive to noise. Neither is better in general: the EMA suits signals that need to be early, the SMA levels that many participants watch.",
        ],
      },
      {
        heading: "The 20, 50 and 200-session averages",
        paragraphs: [
          "A trading month is roughly 21 sessions, a quarter roughly 63, and a year roughly 252. The 20-session average therefore tracks about a month of price, the 50 a little over two months, and the 200 most of a year. The 50 and 200-day averages are the ones quoted most often, partly because so many people watch them.",
        ],
      },
      {
        heading: "Warm-up and seeding",
        paragraphs: [
          "A 200-session average has no value until there are 200 closes. StreetLevel shows the bars available against the bars required instead of plotting a shorter, different average under the same name.",
          "The EMA has a subtler start-up problem. Seeding it with the very first close lets that single price dominate for several multiples of the period. Seeding with the simple average of the first n closes, as StreetLevel does, removes the bias and matches published charts.",
        ],
      },
      {
        heading: "Price relative to the average",
        paragraphs: [
          "The table on this page reports how far each close sits above or below its averages as a percentage. Far above a rising 200-day average describes a strong trend; far below a falling one describes the opposite. Distance from the average also measures how stretched a move has become, which is the idea behind mean-reversion rules.",
        ],
      },
    ],
    live: "moving-averages",
    backtest: { query: "rule=sma_cross&symbol=MSFT", label: "Backtest a 20/50 SMA crossover on MSFT" },
    faqs: [
      {
        question: "Is the EMA better than the SMA?",
        answer:
          "Neither is better in general. The EMA reacts faster because it weights recent prices more heavily, which helps signals that need to be early. The SMA is smoother and is the version behind widely watched levels such as the 200-day average.",
      },
      {
        question: "How many days of data does a 200-day moving average need?",
        answer:
          "It needs 200 sessions of closes, roughly ten months of trading, before it produces its first value.",
      },
      {
        question: "Why is the 200-day moving average watched so closely?",
        answer:
          "It summarises most of a year of trading in one line, and because so many investors and funds reference it, a move through it can attract attention and orders of its own.",
      },
      {
        question: "What does it mean when a stock trades above its 50-day moving average?",
        answer:
          "The latest close is higher than the average of the last 50 closes, which means the price has risen relative to its recent two-month history.",
      },
    ],
    related: ["golden-cross", "macd", "bollinger-bands", "rsi"],
  },

  "golden-cross": {
    lede:
      "A golden cross is the 50-day moving average crossing above the 200-day moving average. A death cross is the reverse. Both mark a change in the longer-term trend after it has already happened.",
    formula: {
      lines: [
        "Golden cross at t:  SMA50(t−1) ≤ SMA200(t−1)  and  SMA50(t) > SMA200(t)",
        "Death cross at t:   SMA50(t−1) ≥ SMA200(t−1)  and  SMA50(t) < SMA200(t)",
      ],
      legend: [
        { term: "SMA50, SMA200", meaning: "simple moving averages of the adjusted close over 50 and 200 sessions" },
      ],
    },
    sections: [
      {
        heading: "Why the signal lags",
        paragraphs: [
          "For the 50-day average to overtake the 200-day, prices must have been rising for long enough to lift a two-month average above a ten-month one. By the time a golden cross prints, the move that caused it is usually weeks or months old.",
          "That lag is the trade-off of a slow signal. It ignores short pullbacks, and in a long trend it can keep an investor positioned for most of the move. In a sideways market the two averages can cross back and forth several times, each crossing a false start.",
        ],
      },
      {
        heading: "The exact rule",
        paragraphs: [
          "StreetLevel counts a golden cross when the fast average moves from at or below the slow average on one session to strictly above it on the next, and a death cross for the reverse. Sessions where either average is still warming up are skipped, so a cross can never be declared from a partial average.",
        ],
      },
      {
        heading: "How much history it needs",
        paragraphs: [
          "The 200-day average needs 200 sessions before it exists, so a crossing can only be detected from the 201st session onward. With about a year of daily data, that leaves roughly the final fifth of the window in which a cross can appear, which is why many names in the table below show no recent cross at all.",
          "StreetLevel reports the most recent cross within the last 120 sessions. Older crossings are left out on the grounds that they no longer describe the current trend.",
        ],
      },
    ],
    live: "crosses",
    backtest: {
      query: "rule=sma_cross&symbol=MSFT&p.fast=50&p.slow=200",
      label: "Backtest a 50/200 crossover on MSFT",
    },
    faqs: [
      {
        question: "Is a golden cross bullish?",
        answer:
          "It confirms that the medium-term average has risen above the long-term one, which describes an uptrend that is already under way. It is a lagging confirmation rather than a forecast, and it can reverse in sideways markets.",
      },
      {
        question: "What is the difference between a golden cross and a death cross?",
        answer:
          "A golden cross is the 50-day average crossing above the 200-day; a death cross is the 50-day crossing below it. They are the same signal in opposite directions.",
      },
      {
        question: "How long does it take for a golden cross to form?",
        answer:
          "There is no fixed time. It requires at least 200 sessions of history and a rise sustained long enough to lift the 50-day average above the 200-day one, which usually takes weeks to months.",
      },
      {
        question: "Can I backtest a golden cross strategy?",
        answer:
          "Yes. Set the SMA crossover rule to a fast period of 50 and a slow period of 200. With a single year of daily data the rule only has the final sessions after the 200-day average warms up in which to trade, so treat the result as an illustration.",
      },
    ],
    related: ["moving-averages", "macd", "walk-forward-analysis", "backtesting-bias"],
  },

  "average-true-range": {
    lede:
      "Average True Range measures how far a stock typically moves in a session, overnight gaps included. It is quoted in price units and says nothing about direction, only about the size of the moves.",
    formula: {
      lines: [
        "TR_t  = max(H_t − L_t, |H_t − C_(t−1)|, |L_t − C_(t−1)|)",
        "ATR_t = (ATR_(t−1) · 13 + TR_t) / 14",
        "ATR % of price = ATR_t / C_t",
      ],
      legend: [
        { term: "H, L, C", meaning: "the session's high, low and close as traded, not adjusted" },
        { term: "ATR seed", meaning: "the simple mean of the first 14 true ranges" },
      ],
    },
    sections: [
      {
        heading: "Why true range instead of high minus low",
        paragraphs: [
          "Wilder introduced the true range in the same 1978 book as the RSI. The plain high-minus-low of a session misses gaps: a stock that closes at 100, opens at 110 after news and trades between 109 and 111 has a two-dollar range but moved eleven dollars. True range takes the largest of the session's range and its distance from the previous close, so the gap counts.",
        ],
      },
      {
        heading: "Raw prices, not adjusted",
        paragraphs: [
          "ATR is computed from the unadjusted high, low and close, because it describes what traded on the day: a stop placed one ATR below the market has to be a price that existed. The return and oscillator maths elsewhere on the site use adjusted closes instead.",
        ],
      },
      {
        heading: "Comparing ATR across stocks",
        paragraphs: [
          "Because ATR is in dollars, a higher-priced stock has a larger ATR even if it is calmer. Dividing by the close turns it into a percentage of price, which is the column the table on this page ranks by and the one to use when comparing names.",
        ],
      },
      {
        heading: "How traders use it",
        paragraphs: [
          "ATR sets distances that adapt to each stock. A stop two ATRs below the entry is tight for a calm stock and loose for a volatile one in exactly the proportion their moves differ. The same idea sizes positions: risking a fixed amount per trade and dividing it by the ATR buys fewer shares of a jumpier stock.",
        ],
      },
    ],
    live: "atr",
    faqs: [
      {
        question: "What is a good ATR value?",
        answer:
          "There is no target value. ATR describes typical daily movement, so it is only meaningful relative to the price and to the same stock's own history. Compare stocks using ATR as a percentage of price.",
      },
      {
        question: "Why use Average True Range instead of the daily high minus low?",
        answer:
          "Because high minus low ignores gaps between sessions. True range includes the distance from the previous close, so an overnight jump counts towards the measured volatility.",
      },
      {
        question: "Does ATR show the direction of the trend?",
        answer:
          "No. ATR measures the size of price moves, not their direction. A stock falling sharply and one rising sharply can have the same ATR.",
      },
      {
        question: "How is ATR used for stop-losses?",
        answer:
          "A common approach places the stop a multiple of ATR away from the entry, often between one and three, so the stop distance scales with how much the stock normally moves.",
      },
    ],
    related: ["volatility", "bollinger-bands", "rsi", "max-drawdown"],
  },

  volatility: {
    lede:
      "Annualized volatility is the standard deviation of a stock's periodic returns, scaled to a year. It is the most common single measure of how much a price swings, and the denominator of the Sharpe ratio.",
    formula: {
      lines: [
        "r_t = C_t / C_(t−1) − 1",
        "σ_periodic = √( Σ (r_t − r̄)² / (n − 1) )",
        "σ_annual = σ_periodic · √P",
      ],
      legend: [
        { term: "C_t", meaning: "the adjusted close" },
        { term: "n", meaning: "the number of returns, one fewer than the number of closes" },
        { term: "P", meaning: "periods per year: 252 for daily returns, 52 weekly, 12 monthly" },
      ],
    },
    sections: [
      {
        heading: "Why the square root of 252",
        paragraphs: [
          "If daily returns are independent, their variances add: the variance of a year's return is 252 times the variance of a day's. Standard deviation is the square root of variance, so it grows with the square root of time. A daily deviation of 2% therefore annualizes to about 2% × √252, or roughly 31.7%.",
          "The independence assumption is a working approximation. Real returns show some short-term dependence, which is why volatility measured from weekly returns can differ from volatility measured from daily ones over the same period.",
        ],
      },
      {
        heading: "Sample, not population",
        paragraphs: [
          "A year of returns is a sample from an unknown distribution, not the whole of it, so StreetLevel divides by n − 1. With 251 daily returns the difference is small, but it matters for short windows, which is also where the estimate is least reliable.",
          "Below 20 returns the figure is still shown but marked indicative. A volatility estimated from a week of data is a number, not a risk measure.",
        ],
      },
      {
        heading: "What volatility does and does not capture",
        paragraphs: [
          "Volatility treats a 5% rise and a 5% fall as equally risky. Investors usually do not, which is the motivation for the Sortino ratio's downside deviation. It also says nothing about the path: two stocks with the same volatility can have very different worst drawdowns, which is why both figures are reported.",
          "Simple returns are used throughout. For daily data the difference from log returns is small, and simple returns are what an investor actually earns.",
        ],
      },
    ],
    live: "volatility",
    faqs: [
      {
        question: "What is a high volatility for a stock?",
        answer:
          "Broad equity indexes have historically averaged roughly 15 to 20 percent annualized. Individual large-cap stocks are usually more volatile than the index they belong to, and fast-growing technology names often run well above it. Comparing a stock with its peers and with its own history is more useful than a fixed threshold.",
      },
      {
        question: "Why is daily volatility multiplied by the square root of 252?",
        answer:
          "There are about 252 trading sessions in a year. If daily returns are independent, variance scales with time and standard deviation with the square root of time, so the daily figure is multiplied by √252.",
      },
      {
        question: "Is volatility the same as risk?",
        answer:
          "It is one dimension of risk: how widely returns are spread. It treats gains and losses alike and ignores the order they arrive in, so drawdown and downside deviation complement it.",
      },
      {
        question: "Does StreetLevel use simple or log returns for volatility?",
        answer:
          "Simple returns, computed from adjusted closes. For daily data the difference from log returns is small.",
      },
    ],
    related: ["sharpe-ratio", "sortino-ratio", "max-drawdown", "average-true-range"],
  },

  "max-drawdown": {
    lede:
      "Maximum drawdown is the largest fall from a peak to a subsequent trough over a period, measured as a percentage of the peak. It answers the question volatility does not: how bad did it actually get?",
    formula: {
      lines: [
        "DD_t  = C_t / max(C_0, …, C_t) − 1",
        "MaxDD = min over t of DD_t",
        "Gain needed to recover = 1 / (1 + MaxDD) − 1",
      ],
      legend: [
        { term: "C_t", meaning: "the adjusted close" },
        { term: "DD_t", meaning: "zero at a new high and negative below it" },
      ],
    },
    sections: [
      {
        heading: "Peak, trough and recovery",
        paragraphs: [
          "Every drawdown has three dates. The peak is the highest close before the worst point, the trough is the worst point itself, and the recovery is the first close back at or above the peak. StreetLevel reports all three, along with the days from peak to trough and from trough to recovery, or notes that the price has not yet recovered.",
        ],
      },
      {
        heading: "Losses are asymmetric",
        paragraphs: [
          "A fall of a given size needs a larger rise to undo it, because the rise starts from a lower base. The gap grows quickly with the size of the loss:",
        ],
        table: {
          head: ["Drawdown", "Gain needed to recover"],
          rows: [
            ["−10%", "+11.1%"],
            ["−20%", "+25.0%"],
            ["−33%", "+49.3%"],
            ["−50%", "+100.0%"],
            ["−75%", "+300.0%"],
          ],
        },
      },
      {
        heading: "Closes, not intraday lows",
        paragraphs: [
          "Drawdown here is measured on closing prices. Using intraday lows would give a deeper and equally defensible number, but mixing the two conventions on one page is how two figures that should agree end up disagreeing. The period high and low elsewhere on the site do use intraday extremes, because that is what the phrase 52-week high means.",
        ],
      },
      {
        heading: "Compare like with like",
        paragraphs: [
          "Maximum drawdown can only grow as a window gets longer, since a longer window contains every shorter one. A five-year drawdown and a one-year drawdown are not comparable figures, so the table on this page uses the same trailing year for every stock.",
        ],
      },
    ],
    live: "drawdown",
    faqs: [
      {
        question: "What is a good maximum drawdown?",
        answer:
          "Smaller is better, but it depends on the window and the asset. Individual stocks routinely see drawdowns of 20% or more within a year, so compare a figure with peers over the same window rather than with a fixed threshold.",
      },
      {
        question: "Why does a 50% drawdown need a 100% gain to recover?",
        answer:
          "After a 50% fall, $100 is worth $50. Getting back to $100 means doubling $50, which is a 100% gain. In general the gain needed is 1 / (1 − loss) − 1.",
      },
      {
        question: "Is maximum drawdown measured on closing prices or intraday lows?",
        answer:
          "StreetLevel uses closing prices, adjusted for splits and dividends. Intraday lows would show a deeper drawdown.",
      },
      {
        question: "How is drawdown recovery time measured?",
        answer:
          "From the trough to the first close at or above the previous peak, in calendar days. If the price has not closed at the peak again, the drawdown is reported as not yet recovered.",
      },
    ],
    related: ["volatility", "cagr", "sharpe-ratio", "sortino-ratio"],
  },

  "sharpe-ratio": {
    lede:
      "The Sharpe ratio divides the return earned above the risk-free rate by the volatility it took to earn it. It is the standard measure of risk-adjusted return, and over short windows it is much less precise than it looks.",
    formula: {
      lines: [
        "Sharpe = (r̄ · P − r_f) / (σ · √P)",
        "SE(Sharpe) ≈ √( (1 + s² / 2) / (n − 1) ) · √P,   s = Sharpe / √P",
      ],
      legend: [
        { term: "r̄, σ", meaning: "the mean and sample standard deviation of periodic returns" },
        { term: "P", meaning: "periods per year, 252 for daily returns" },
        { term: "r_f", meaning: "the annual risk-free rate; StreetLevel uses zero" },
        { term: "SE", meaning: "the approximate standard error of the annualized estimate" },
      ],
    },
    sections: [
      {
        heading: "What it measures",
        paragraphs: [
          "William F. Sharpe proposed the ratio in 1966 as a reward-to-variability measure. Two stocks that both returned 20% are not equally impressive if one did it with half the volatility; the Sharpe ratio puts them on one scale.",
          "The mean return and the deviation are both annualized: the mean by multiplying by the periods in a year, the deviation by the square root of it. That makes daily, weekly and monthly figures roughly comparable.",
        ],
      },
      {
        heading: "Why a one-year Sharpe is so uncertain",
        paragraphs: [
          "The standard error of a Sharpe ratio estimated from n returns is approximately √((1 + s²/2) / (n − 1)) in per-period units. Annualizing it the same way as the ratio itself, for a year of daily data, gives an error of about ±1. Within one standard error, a one-year Sharpe of 1.5 is consistent with a true value anywhere from about 0.5 to 2.5.",
          "A common mistake applies the textbook formula directly to the annualized figure. That claims a year of daily data pins the Sharpe ratio to within about ±0.07, more than ten times too precise, and makes a single year look decisive. StreetLevel computes the error per period and scales it, which is also what makes the deflated Sharpe ratio in the backtester meaningful.",
        ],
      },
      {
        heading: "Choices that change the number",
        paragraphs: [
          "The risk-free rate is subtracted from the annualized mean. StreetLevel's analytics pages assume zero, which overstates every Sharpe ratio slightly when cash yields are positive but keeps the ranking between stocks unchanged.",
          "The ratio penalizes upside volatility as much as downside volatility. A stock that rose in a few sharp jumps can score worse than one that rose steadily, even if investors would have preferred the jumps. The Sortino ratio addresses that.",
        ],
      },
    ],
    live: "sharpe",
    faqs: [
      {
        question: "What is a good Sharpe ratio?",
        answer:
          "Over long histories broad equity indexes have delivered Sharpe ratios well below 1, so a sustained figure above 1 is uncommon. Over a single year, though, the estimate carries an error of roughly ±1, so it ranks stocks more reliably than it measures them.",
      },
      {
        question: "Why is a Sharpe ratio from one year of data unreliable?",
        answer:
          "With about 252 daily returns, the standard error of an annualized Sharpe ratio is roughly 1. The true value could differ from the estimate by about that much in either direction.",
      },
      {
        question: "Can a Sharpe ratio be negative?",
        answer: "Yes. It is negative whenever the return over the period is below the risk-free rate.",
      },
      {
        question: "What risk-free rate does StreetLevel use?",
        answer:
          "Zero, on the analytics and comparison pages. Every figure is computed the same way, so comparisons between stocks are unaffected.",
      },
    ],
    related: ["sortino-ratio", "volatility", "deflated-sharpe-ratio", "max-drawdown"],
  },

  "sortino-ratio": {
    lede:
      "The Sortino ratio is a Sharpe ratio that counts only downside volatility. Large gains do not count against a stock, so it separates a stock that is volatile because it jumps up from one that is volatile because it falls.",
    formula: {
      lines: [
        "DownsideDev = √( Σ min(r_t − MAR, 0)² / n ) · √P",
        "Sortino = (r̄ · P − r_f) / DownsideDev",
      ],
      legend: [
        { term: "MAR", meaning: "the minimum acceptable return per period; StreetLevel uses zero" },
        { term: "n", meaning: "the number of all returns, not only the negative ones" },
        { term: "P", meaning: "periods per year, 252 for daily returns" },
      ],
    },
    sections: [
      {
        heading: "Only the bad volatility",
        paragraphs: [
          "The ratio is named after Frank Sortino. Its denominator, downside deviation, squares only the returns that fall short of a minimum acceptable return and ignores the rest. A stock whose volatility comes from rallies has a small downside deviation and a Sortino ratio well above its Sharpe ratio.",
        ],
      },
      {
        heading: "The most common mistake",
        paragraphs: [
          "Downside deviation averages the squared shortfalls over every return, with the returns above the MAR contributing zero. Two shortcuts are common. One averages over only the losing periods, which divides the same shortfalls by a smaller count, enlarges the downside deviation and understates the ratio. The other takes the ordinary standard deviation of the losing returns, which measures how much the losses vary around their own average rather than how far they fall below the target; for a stock whose losses are all of similar size that figure is tiny and the ratio balloons.",
          "StreetLevel follows the definition: squared shortfalls below the MAR, averaged over every period.",
        ],
      },
      {
        heading: "When it is unavailable",
        paragraphs: [
          "If no return in the window falls below the MAR, downside deviation is zero and the ratio is undefined. StreetLevel reports it as unavailable rather than as infinity, which would break every comparison it appeared in.",
        ],
      },
    ],
    live: "sortino",
    faqs: [
      {
        question: "What is the difference between the Sortino and Sharpe ratios?",
        answer:
          "Both divide excess return by a measure of risk. The Sharpe ratio uses total volatility; the Sortino ratio uses downside deviation, which counts only returns below a minimum acceptable return.",
      },
      {
        question: "Is a higher Sortino ratio than Sharpe ratio a good sign?",
        answer:
          "It means more of the stock's volatility came from gains than from losses. The gap between the two ratios is a quick read on how lopsided the returns were.",
      },
      {
        question: "What is the minimum acceptable return in the Sortino ratio?",
        answer:
          "It is the threshold below which a return counts as a shortfall. StreetLevel uses zero, so any losing session counts towards downside deviation.",
      },
      {
        question: "Why can the Sortino ratio be unavailable?",
        answer:
          "If no return fell below the minimum acceptable return, downside deviation is zero and the ratio cannot be computed.",
      },
    ],
    related: ["sharpe-ratio", "volatility", "max-drawdown", "cagr"],
  },

  beta: {
    lede:
      "Beta measures how much a stock tends to move when its benchmark moves. A beta of 1.5 means that, on average, the stock has moved 1.5% for every 1% move in the benchmark over the period measured.",
    formula: {
      lines: [
        "β = cov(r_a, r_b) / var(r_b)",
        "β = ρ · σ_a / σ_b",
        "α = CAGR_a − (r_f + β · (CAGR_b − r_f))",
      ],
      legend: [
        { term: "r_a, r_b", meaning: "daily returns of the stock and the benchmark on their shared trading days" },
        { term: "ρ", meaning: "the correlation between the two return series" },
        { term: "α", meaning: "the annualized return not explained by beta" },
      ],
    },
    sections: [
      {
        heading: "Beta is a regression slope",
        paragraphs: [
          "Plot the stock's daily returns against the benchmark's and fit a straight line. Beta is the slope of that line. It combines two things: how closely the stock tracks the benchmark (correlation) and how large its moves are relative to the benchmark's (the ratio of their volatilities).",
          "That decomposition explains results that look odd at first. A very volatile stock with a low correlation can have a beta below 1, because its large moves are mostly unrelated to the benchmark.",
        ],
      },
      {
        heading: "Beta depends on the benchmark",
        paragraphs: [
          "Published betas are usually measured against a broad index such as the S&P 500, often from five years of monthly returns. StreetLevel measures against SL10, an equal-weight composite of the ten names it covers, over the trailing year of daily returns. The two answer different questions and will not match.",
          "Against SL10, beta answers: how much does this stock move with the rest of this particular group? A stock that dominates the group's movements will show a beta above 1.",
        ],
      },
      {
        heading: "Alignment and sample size",
        paragraphs: [
          "Returns are paired by calendar date, and days when either series did not trade are dropped rather than filled with a stale price. A forward-filled price manufactures a zero return that distorts both the covariance and the variance.",
          "Below 20 shared observations StreetLevel withholds beta, correlation and tracking error. A beta computed from four days is noise with a decimal point.",
        ],
      },
    ],
    live: "beta",
    faqs: [
      {
        question: "What does a beta of 1 mean?",
        answer:
          "It means the stock has, on average, moved one-for-one with its benchmark over the period measured. Above 1 it amplified the benchmark's moves; below 1 it dampened them.",
      },
      {
        question: "Why is StreetLevel's beta different from other websites?",
        answer:
          "Most sites measure beta against the S&P 500 using several years of monthly returns. StreetLevel measures against an equal-weight composite of its ten covered stocks using a year of daily returns, so the figures answer a different question.",
      },
      {
        question: "Can beta be negative?",
        answer:
          "Yes. A negative beta means the stock tended to move in the opposite direction to its benchmark, which is rare for individual stocks against an equity index.",
      },
      {
        question: "How is beta related to correlation?",
        answer:
          "Beta equals the correlation multiplied by the ratio of the stock's volatility to the benchmark's. Correlation says how consistently they move together; beta says how much.",
      },
    ],
    related: ["correlation", "volatility", "sharpe-ratio", "cagr"],
  },

  correlation: {
    lede:
      "Correlation measures how consistently two stocks' returns move together, on a scale from −1 for perfectly opposite moves, through 0 for no linear relationship, to +1 for moves in lockstep.",
    formula: {
      lines: ["ρ = cov(r_a, r_b) / (σ_a · σ_b)"],
      legend: [
        { term: "r_a, r_b", meaning: "daily returns of the two stocks on their shared trading days" },
        { term: "σ", meaning: "the standard deviation of each return series" },
      ],
    },
    sections: [
      {
        heading: "Returns, never prices",
        paragraphs: [
          "Two stocks that both rose over a year will show a high correlation between their prices whatever their day-to-day relationship, because any two upward-trending series correlate. The correlation that matters for risk is between returns, which strips out the shared trend and keeps only how the moves line up.",
        ],
      },
      {
        heading: "Aligning the dates",
        paragraphs: [
          "Two series are joined on calendar date before anything is computed. Stocks can differ in listing dates, halts and holiday calendars, so pairing the arrays by position would eventually line up one stock's Monday with the other's Tuesday. Days missing on either side are dropped, not forward-filled, because a filled price invents a zero return on one side of the pair.",
        ],
      },
      {
        heading: "Correlation and diversification",
        paragraphs: [
          "A portfolio's volatility depends on the correlations between its holdings as much as on their individual volatilities. Ten stocks with an average pairwise correlation near 1 behave like one stock; ten with a low average correlation offset each other's moves. The average pairwise figure in the matrix below is the single number to watch.",
          "Correlations are not constant. They tend to rise in broad sell-offs, which is when diversification is most wanted, so a correlation estimated over a calm year can overstate the protection it offers.",
        ],
      },
      {
        heading: "What correlation does not say",
        paragraphs: [
          "A correlation of 0.9 says two stocks move in the same direction on most days. It does not say they move by the same amount; that is beta's job. Nor does a correlation of zero mean the stocks are independent, only that there is no straight-line relationship between their returns.",
        ],
      },
    ],
    live: "correlation",
    faqs: [
      {
        question: "What is a high correlation between two stocks?",
        answer:
          "Above about 0.7 is usually considered high and below about 0.3 low, but the useful comparison is relative: against other pairs in the same group and over the same window.",
      },
      {
        question: "Why is correlation calculated on returns instead of prices?",
        answer:
          "Prices that trend in the same direction correlate strongly even when their daily moves are unrelated. Returns remove the trend and measure how the day-to-day moves line up.",
      },
      {
        question: "Does a high correlation mean two stocks move by the same amount?",
        answer:
          "No. Correlation measures how consistently they move together. How much one moves relative to the other is measured by beta.",
      },
      {
        question: "How many observations does a correlation need?",
        answer:
          "StreetLevel requires at least 20 shared daily returns and reports the figure as unavailable below that.",
      },
    ],
    related: ["beta", "volatility", "sharpe-ratio", "max-drawdown"],
  },

  cagr: {
    lede:
      "The compound annual growth rate is the constant yearly rate that would turn a starting value into an ending value over the same span. It is the right way to state a multi-year return as a yearly figure.",
    formula: {
      lines: ["CAGR = (End / Start) ^ (365.25 / days) − 1"],
      legend: [
        { term: "End, Start", meaning: "the adjusted closes at the two ends of the window" },
        { term: "days", meaning: "calendar days between the first and last bar" },
        { term: "365.25", meaning: "the mean length of a calendar year, leap years included" },
      ],
    },
    sections: [
      {
        heading: "Compound, not average",
        paragraphs: [
          "A stock that gains 50% one year and loses 50% the next has an average annual return of 0% but has lost a quarter of its value: 1.5 × 0.5 = 0.75. CAGR reports that correctly as about −13.4% a year, because it is the geometric rather than the arithmetic mean.",
        ],
      },
      {
        heading: "Calendar days, not trading days",
        paragraphs: [
          "StreetLevel counts calendar days between the first and last bar and divides by 365.25. Counting trading sessions and dividing by 252 gives almost the same answer over whole years, but calendar days stay correct across holidays and partial years.",
        ],
      },
      {
        heading: "Why it is withheld for short windows",
        paragraphs: [
          "Annualizing a short move multiplies its noise. A 20% gain in one month compounds to almost 800% a year, a figure that is arithmetically correct and analytically meaningless. StreetLevel does not report CAGR for windows under 330 days and says why instead.",
          "Over a window of almost exactly one year, CAGR and the total return are nearly identical, which is what the table on this page shows.",
        ],
      },
    ],
    live: "cagr",
    faqs: [
      {
        question: "What is the difference between CAGR and average annual return?",
        answer:
          "Average annual return is the arithmetic mean of yearly returns and overstates growth when returns vary. CAGR is the geometric mean: the single steady rate that reproduces the actual start and end values.",
      },
      {
        question: "Why is CAGR not shown for short periods?",
        answer:
          "Annualizing a short window magnifies its noise into extreme yearly figures. StreetLevel withholds CAGR below 330 days.",
      },
      {
        question: "Does CAGR include dividends?",
        answer:
          "StreetLevel computes it from closes adjusted for splits and dividends, so dividends are treated as reinvested.",
      },
      {
        question: "How do you calculate CAGR in a spreadsheet?",
        answer:
          "Divide the ending value by the starting value, raise the result to the power of 365.25 divided by the number of calendar days between them, and subtract one.",
      },
    ],
    related: ["max-drawdown", "sharpe-ratio", "volatility", "sortino-ratio"],
  },

  "deflated-sharpe-ratio": {
    lede:
      "Search enough parameter combinations and one of them will look good by chance. The deflated Sharpe ratio asks whether the best result of a search beats the best result you would expect from the same number of strategies with no edge at all.",
    formula: {
      lines: [
        "E[max of N] ≈ (1 − γ) · Φ⁻¹(1 − 1/N) + γ · Φ⁻¹(1 − 1/(N·e))",
        "Expected best Sharpe under the null = E[max of N] · SE(Sharpe)",
        "Deflated Sharpe = Φ( (Sharpe_best − expected best) / SE(Sharpe) )",
      ],
      legend: [
        { term: "N", meaning: "the number of parameter combinations that produced a result" },
        { term: "γ", meaning: "the Euler–Mascheroni constant, about 0.5772" },
        { term: "Φ, Φ⁻¹", meaning: "the standard normal distribution function and its inverse" },
        { term: "SE(Sharpe)", meaning: "the standard error of the annualized Sharpe ratio, computed per period and then annualized" },
      ],
    },
    sections: [
      {
        heading: "A search always finds a winner",
        paragraphs: [
          "Run a crossover rule over 49 combinations of fast and slow averages and one of the 49 will have the highest Sharpe ratio. That is a property of taking a maximum, not evidence about the rule. Even if every combination were worthless, the best of 49 noisy estimates would sit well above zero.",
          "The deflated Sharpe ratio, introduced by David Bailey and Marcos López de Prado in 2014, quantifies that effect. It estimates how high the best Sharpe would be expected to land if all N trials had a true Sharpe of zero, and reports the probability that the observed best genuinely exceeds that.",
        ],
      },
      {
        heading: "Reading the result",
        paragraphs: [
          "The output is a probability between 0 and 1. A value near 1 means the best result is very unlikely to be the luck of the search; a value near 0.5 or below means it is indistinguishable from the best of N coin flips. The worked example below shows a search whose winner, despite a positive Sharpe ratio, is nowhere near the bar.",
          "Every variation tried counts as a trial, including the ones abandoned before anyone wrote them down. A rule found after informally testing dozens of ideas should be judged against dozens of trials, not one.",
        ],
      },
      {
        heading: "The standard-error trap",
        paragraphs: [
          "The correction is only as good as the standard error behind it. Applying the textbook formula directly to an annualized Sharpe ratio understates the error more than tenfold for daily data, and makes the deflation do almost nothing. StreetLevel computes the error per period and annualizes it the same way as the Sharpe ratio itself.",
          "StreetLevel's version assumes independent, normally distributed returns. The published method also corrects for skewness and fat tails, which typically widens the error further, so this implementation errs on the generous side.",
        ],
      },
    ],
    live: "deflated-sharpe",
    backtest: { query: "rule=sma_cross&symbol=NVDA", label: "Open the NVDA crossover sweep" },
    faqs: [
      {
        question: "What is a good deflated Sharpe ratio?",
        answer:
          "It is a probability, so values close to 1, such as above 0.95, indicate the best result is unlikely to be explained by the number of trials. Values near 0.5 or below mean the search found nothing distinguishable from luck.",
      },
      {
        question: "Why does the number of trials matter?",
        answer:
          "The expected maximum of many noisy estimates grows with the number of estimates. The more combinations tested, the higher the best one will be by chance alone, so the bar for significance rises with N.",
      },
      {
        question: "Does the deflated Sharpe ratio apply to manual strategy tweaking?",
        answer:
          "Yes. Every variation tried is a trial, whether it was run by a parameter sweep or by hand. Counting only the final version understates N and overstates the result.",
      },
      {
        question: "Who developed the deflated Sharpe ratio?",
        answer:
          "David H. Bailey and Marcos López de Prado, in a 2014 paper in the Journal of Portfolio Management.",
      },
    ],
    related: ["walk-forward-analysis", "sharpe-ratio", "backtesting-bias", "moving-averages"],
  },

  "walk-forward-analysis": {
    lede:
      "Walk-forward analysis chooses a strategy's parameters on one slice of history and then measures them on the slice that follows, which the choice never saw. It is the simplest honest test of whether an optimized rule generalizes.",
    formula: {
      lines: [
        "Split the window into F + 1 equal blocks",
        "Fold k: choose parameters on blocks 1…k, test on block k + 1",
        "Efficiency = mean out-of-sample return / mean in-sample return",
      ],
      legend: [
        { term: "F", meaning: "the number of folds" },
        { term: "in-sample", meaning: "the history the parameters were chosen on" },
        { term: "out-of-sample", meaning: "the block immediately after, unseen by the choice" },
      ],
    },
    sections: [
      {
        heading: "Why in-sample results flatter",
        paragraphs: [
          "When parameters are chosen to maximize a result on some data, the result on that same data is biased upward: the choice has fitted the noise as well as any signal. The only clean measurement is on data the choice did not see, and walk-forward analysis produces several such measurements in sequence.",
        ],
      },
      {
        heading: "Anchored and rolling windows",
        paragraphs: [
          "In an anchored walk-forward each fold's in-sample period starts at the beginning of the data and grows by one block; in a rolling walk-forward it is a fixed-length window that slides forward. StreetLevel uses the anchored form, which keeps every fold's choice informed by as much history as was available at the time.",
        ],
      },
      {
        heading: "Reading efficiency",
        paragraphs: [
          "Walk-forward efficiency divides the average out-of-sample return by the average in-sample return. Close to 1 means the chosen parameters kept most of their edge on new data. Well below 1, or negative, means the in-sample performance was mostly fitted noise.",
          "Sample size limits what any of this can show. A year of daily bars split into four blocks leaves about 63 sessions per out-of-sample slice, too few for a reliable estimate. StreetLevel flags that rather than hiding it, and the worked example below should be read as a demonstration of the method rather than as evidence about the rule.",
        ],
      },
    ],
    live: "walk-forward",
    backtest: { query: "rule=sma_cross&symbol=NVDA", label: "Run walk-forward on the NVDA crossover" },
    faqs: [
      {
        question: "What is a good walk-forward efficiency?",
        answer:
          "Values close to 1 suggest the optimized parameters held up on unseen data. Values well below 1, or negative, suggest the in-sample result was mostly fitted noise.",
      },
      {
        question: "What is the difference between anchored and rolling walk-forward analysis?",
        answer:
          "Anchored walk-forward grows the in-sample window from a fixed start, so later folds see more history. Rolling walk-forward keeps the in-sample window a fixed length and slides it forward.",
      },
      {
        question: "How many folds should a walk-forward test use?",
        answer:
          "Enough to give several out-of-sample measurements, but not so many that each slice is too short to mean anything. With one year of daily data, three folds already leave slices of about three months.",
      },
      {
        question: "Is walk-forward analysis the same as cross-validation?",
        answer:
          "It is a time-ordered form of it. Ordinary cross-validation shuffles data into folds, which lets a model train on the future; walk-forward always tests on data that comes after the training data.",
      },
    ],
    related: ["deflated-sharpe-ratio", "backtesting-bias", "sharpe-ratio", "golden-cross"],
  },

  "backtesting-bias": {
    lede:
      "Most backtests look better than the strategy will trade. Look-ahead bias, optimistic fills, survivorship bias, ignored costs and overfitting are the usual reasons, and each one pushes the result in the flattering direction.",
    sections: [
      {
        heading: "Look-ahead bias",
        paragraphs: [
          "Look-ahead bias uses information that was not available at the moment of the decision. The classic case reads a signal from today's close and fills the trade at today's close, as if the order could be placed after the market had already closed.",
          "StreetLevel's simulator fills an order decided at the close of session t no earlier than session t + 1. A causality check recomputes every signal over truncated prefixes of the data and requires each answer to match the full run, which catches any rule that reads a future bar directly or through an indicator. The check itself is tested against a rule built to peek.",
        ],
      },
      {
        heading: "Optimistic fills",
        paragraphs: [
          "A stop-loss at 90 does not fill at 90 if the stock opens at 80. Daily data cannot say whether a stop or a target was touched first within a session either. StreetLevel fills gaps at the open and resolves a bar that touched both levels as a stop, choices that bias results downward, which is the safe direction to be wrong in.",
        ],
      },
      {
        heading: "Survivorship bias",
        paragraphs: [
          "A test run only on companies that exist today leaves out every company that failed, was acquired or shrank out of the index. Those are disproportionately the losers, so the surviving sample flatters any strategy that buys stocks.",
          "StreetLevel's coverage list is ten large-cap names chosen today. That is severe survivorship bias, and the backtest page says so permanently rather than in a footnote. It is a transparent simulator for studying how rules behave, not a tool for validating them.",
        ],
      },
      {
        heading: "Ignored costs",
        paragraphs: [
          "Commissions, the bid-ask spread and slippage are small per trade and large in aggregate for an active rule. By default StreetLevel charges a one-dollar commission per trade, five basis points of slippage and half of a four-basis-point spread on every fill, and charges the buy-and-hold benchmark the same, because a cost-bearing strategy compared with a free benchmark is understated by exactly the amount being measured.",
        ],
      },
      {
        heading: "Overfitting",
        paragraphs: [
          "Every parameter tuned and every variation tried is a chance to fit noise. The defences are to count the trials and deflate the best result accordingly, and to measure the chosen parameters on data they were not chosen on. The deflated Sharpe ratio and walk-forward analysis guides cover each.",
        ],
      },
    ],
    backtest: { query: "rule=sma_cross&symbol=AAPL", label: "Open the backtest workspace" },
    faqs: [
      {
        question: "What is look-ahead bias in backtesting?",
        answer:
          "It is the use of information in a simulated decision that would not have been available at the time, such as acting on a closing price before the close. It makes a backtest look better than any real trading could.",
      },
      {
        question: "What is survivorship bias?",
        answer:
          "It is testing only on assets that still exist today, which leaves out the failures. Because the failures are mostly losers, the remaining sample overstates the returns a strategy would have earned.",
      },
      {
        question: "How does StreetLevel model trading costs?",
        answer:
          "By default each fill pays a one-dollar commission, five basis points of slippage and half of a four-basis-point spread. All of them can be changed, and the benchmark pays the same costs.",
      },
      {
        question: "Can StreetLevel's backtester validate a trading strategy?",
        answer:
          "No. With ten surviving large-cap stocks and one year of daily data, it is a transparent simulator for learning how rules behave, and it says so on the page.",
      },
    ],
    related: ["deflated-sharpe-ratio", "walk-forward-analysis", "sharpe-ratio", "max-drawdown"],
  },
};

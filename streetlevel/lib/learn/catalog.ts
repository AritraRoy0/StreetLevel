/**
 * The guide catalog: one small row per guide.
 *
 * Kept apart from the guide bodies because the navigation, the command palette
 * and the footer all list guides, and the palette is a client component. This
 * file is a few kilobytes; the bodies are not, and should never reach the
 * browser bundle just so search can show a title.
 */

export type GuideCategory = "Indicators" | "Risk and return" | "Backtesting";

export const GUIDE_CATEGORIES: GuideCategory[] = ["Indicators", "Risk and return", "Backtesting"];

export const GUIDE_CATEGORY_BLURB: Record<GuideCategory, string> = {
  Indicators: "The readings drawn on the analytics chart, from momentum oscillators to moving-average trend signals.",
  "Risk and return": "How much a stock moved, how far it fell and how much return it earned per unit of risk.",
  Backtesting: "Why a backtest flatters a rule, and the corrections that keep the result honest.",
};

export interface GuideEntry {
  slug: string;
  /** The heading on the page. */
  title: string;
  /** A compact label for lists and search. */
  shortTitle: string;
  /** The `<title>`, written the way people search for the topic. */
  metaTitle: string;
  /** Meta description and list blurb, kept under about 160 characters. */
  description: string;
  category: GuideCategory;
  /** Extra words the command palette matches on. */
  keywords: string[];
}

export const GUIDE_CATALOG: GuideEntry[] = [
  {
    slug: "rsi",
    title: "Relative Strength Index (RSI)",
    shortTitle: "RSI",
    metaTitle: "RSI Indicator Explained: Formula, Calculation and How to Read It",
    description:
      "How the Relative Strength Index is calculated with Wilder's smoothing, what overbought and oversold mean, and live RSI 14 readings for ten large-cap stocks.",
    category: "Indicators",
    keywords: ["relative strength index", "overbought", "oversold", "momentum", "wilder"],
  },
  {
    slug: "macd",
    title: "MACD (Moving Average Convergence Divergence)",
    shortTitle: "MACD",
    metaTitle: "MACD Indicator Explained: Formula, Signal Line and Histogram",
    description:
      "The MACD line, signal line and histogram, step by step: the 12/26/9 formula, how many bars it needs, crossovers, and why MACD cannot be compared across stocks.",
    category: "Indicators",
    keywords: ["moving average convergence divergence", "signal line", "histogram", "crossover"],
  },
  {
    slug: "bollinger-bands",
    title: "Bollinger Bands",
    shortTitle: "Bollinger Bands",
    metaTitle: "Bollinger Bands Explained: Formula, %B and Bandwidth",
    description:
      "How Bollinger Bands are built from a 20-day average and two standard deviations, how to read %B and bandwidth, and why the population deviation is the right one.",
    category: "Indicators",
    keywords: ["percent b", "%b", "bandwidth", "squeeze", "standard deviation"],
  },
  {
    slug: "moving-averages",
    title: "Moving averages: SMA and EMA",
    shortTitle: "SMA and EMA",
    metaTitle: "SMA vs EMA: Moving Average Formulas and How to Use Them",
    description:
      "Simple and exponential moving averages compared: the formulas, how the EMA is seeded, lag, the 20, 50 and 200-day periods, and where price sits against each.",
    category: "Indicators",
    keywords: ["sma", "ema", "simple moving average", "exponential moving average", "200-day", "50-day"],
  },
  {
    slug: "golden-cross",
    title: "Golden cross and death cross",
    shortTitle: "Golden cross",
    metaTitle: "Golden Cross and Death Cross: The 50/200-Day Moving Average Signal",
    description:
      "What a golden cross and a death cross are, the exact crossing rule, why the signal lags, how much history it needs, and the latest crosses across the coverage list.",
    category: "Indicators",
    keywords: ["death cross", "50 day", "200 day", "crossover", "trend"],
  },
  {
    slug: "average-true-range",
    title: "Average True Range (ATR)",
    shortTitle: "ATR",
    metaTitle: "Average True Range (ATR): Formula, Calculation and Uses",
    description:
      "How Average True Range counts overnight gaps, Wilder's 14-period smoothing, ATR as a percentage of price, and how traders use it to size positions and set stops.",
    category: "Indicators",
    keywords: ["atr", "true range", "stop loss", "position sizing", "wilder"],
  },
  {
    slug: "volatility",
    title: "Annualized volatility",
    shortTitle: "Volatility",
    metaTitle: "Stock Volatility: How to Calculate Annualized Volatility",
    description:
      "How annualized volatility is calculated from daily returns, why it scales with the square root of 252, sample versus population deviation, and live figures by stock.",
    category: "Risk and return",
    keywords: ["standard deviation", "annualized", "square root of time", "risk", "sigma"],
  },
  {
    slug: "max-drawdown",
    title: "Maximum drawdown",
    shortTitle: "Max drawdown",
    metaTitle: "Maximum Drawdown: Formula, Calculation and Recovery Time",
    description:
      "How maximum drawdown is measured from peak to trough, how recovery time is counted, why a 50% loss needs a 100% gain, and live drawdowns for ten stocks.",
    category: "Risk and return",
    keywords: ["drawdown", "peak to trough", "recovery", "mdd", "loss"],
  },
  {
    slug: "sharpe-ratio",
    title: "Sharpe ratio",
    shortTitle: "Sharpe ratio",
    metaTitle: "Sharpe Ratio: Formula, Calculation and What Counts as Good",
    description:
      "The Sharpe ratio formula, how it is annualized, why a one-year estimate carries an error of about ±1, and live Sharpe ratios for ten large-cap stocks.",
    category: "Risk and return",
    keywords: ["risk adjusted return", "excess return", "reward to variability", "standard error"],
  },
  {
    slug: "sortino-ratio",
    title: "Sortino ratio",
    shortTitle: "Sortino ratio",
    metaTitle: "Sortino Ratio: Formula and How It Differs From the Sharpe Ratio",
    description:
      "How the Sortino ratio counts only downside volatility, the downside deviation formula and its most common mistake, and how it compares with Sharpe stock by stock.",
    category: "Risk and return",
    keywords: ["downside deviation", "minimum acceptable return", "mar", "risk adjusted return"],
  },
  {
    slug: "beta",
    title: "Beta",
    shortTitle: "Beta",
    metaTitle: "Stock Beta Explained: Formula and How to Calculate It",
    description:
      "What beta measures, the covariance formula, why it depends on the benchmark you pick, how it relates to correlation, and live betas against an equal-weight index.",
    category: "Risk and return",
    keywords: ["market sensitivity", "covariance", "capm", "alpha", "systematic risk"],
  },
  {
    slug: "correlation",
    title: "Correlation between stocks",
    shortTitle: "Correlation",
    metaTitle: "Stock Correlation: How to Calculate It and Why It Matters",
    description:
      "How the correlation between two stocks is calculated from daily returns, why prices give the wrong answer, what it means for diversification, and a live matrix.",
    category: "Risk and return",
    keywords: ["pearson", "diversification", "correlation matrix", "covariance"],
  },
  {
    slug: "cagr",
    title: "Compound annual growth rate (CAGR)",
    shortTitle: "CAGR",
    metaTitle: "CAGR Formula: How to Calculate Compound Annual Growth Rate",
    description:
      "The CAGR formula with calendar days, how it differs from an average annual return, why it should not be computed for short windows, and live figures by stock.",
    category: "Risk and return",
    keywords: ["compound annual growth rate", "annualized return", "geometric mean"],
  },
  {
    slug: "deflated-sharpe-ratio",
    title: "Deflated Sharpe ratio",
    shortTitle: "Deflated Sharpe",
    metaTitle: "Deflated Sharpe Ratio: Correcting a Backtest for Multiple Testing",
    description:
      "Why the best cell of a parameter sweep always looks good, how the deflated Sharpe ratio corrects for the number of trials, and a worked example on real data.",
    category: "Backtesting",
    keywords: ["multiple testing", "parameter sweep", "overfitting", "data snooping", "bailey"],
  },
  {
    slug: "walk-forward-analysis",
    title: "Walk-forward analysis",
    shortTitle: "Walk-forward",
    metaTitle: "Walk-Forward Analysis: Out-of-Sample Testing for Trading Rules",
    description:
      "How walk-forward analysis tests a trading rule on data its parameters never saw, anchored versus rolling windows, walk-forward efficiency, and a worked example.",
    category: "Backtesting",
    keywords: ["out of sample", "in sample", "walk forward optimization", "efficiency", "folds"],
  },
  {
    slug: "backtesting-bias",
    title: "Look-ahead bias, survivorship bias and overfitting",
    shortTitle: "Backtesting bias",
    metaTitle: "Backtesting Bias: Look-Ahead, Survivorship and Overfitting Explained",
    description:
      "The reasons backtests look better than live trading: look-ahead bias, optimistic fills, survivorship bias, ignored costs and overfitting, and how to guard against each.",
    category: "Backtesting",
    keywords: ["look-ahead bias", "survivorship bias", "overfitting", "slippage", "transaction costs"],
  },
];

export function guideEntry(slug: string): GuideEntry | undefined {
  return GUIDE_CATALOG.find((guide) => guide.slug === slug);
}

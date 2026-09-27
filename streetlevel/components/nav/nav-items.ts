/** The primary sections, shared by the navigation bar, the mobile menu and search. */
export const NAV_ITEMS: Array<{
  href: string;
  label: string;
  description: string;
  keywords: string[];
  match: (path: string) => boolean;
}> = [
  {
    href: "/",
    label: "Overview",
    description: "Coverage, aggregates and the news wire",
    keywords: ["home", "coverage", "market", "news"],
    match: (path) => path === "/",
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "One symbol: chart, indicators and risk",
    keywords: ["chart", "indicators", "rsi", "macd", "symbol"],
    match: (path) => path.startsWith("/analytics"),
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    description: "Holdings, attribution and portfolio risk",
    keywords: ["holdings", "positions", "attribution", "allocation"],
    match: (path) => path.startsWith("/portfolio"),
  },
  {
    href: "/signals",
    label: "Signals",
    description: "Rule conditions met across coverage",
    keywords: ["screen", "screener", "alerts", "conditions"],
    match: (path) => path.startsWith("/signals"),
  },
  {
    href: "/performance",
    label: "Performance",
    description: "Backtests and relative strength",
    keywords: ["backtest", "strategy", "simulation", "cross-section", "relative"],
    match: (path) => path.startsWith("/performance"),
  },
];

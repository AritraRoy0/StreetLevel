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
    href: "/performance",
    label: "Performance",
    description: "Backtests and relative strength",
    keywords: ["backtest", "strategy", "simulation", "cross-section", "relative"],
    match: (path) => path.startsWith("/performance"),
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Two stocks head to head",
    keywords: ["versus", "vs", "head to head", "pair", "correlation", "beta"],
    match: (path) => path.startsWith("/compare"),
  },
  {
    href: "/learn",
    label: "Learn",
    description: "Indicators and risk metrics explained",
    keywords: ["guide", "learn", "formula", "methodology", "explained", "sharpe", "drawdown"],
    match: (path) => path.startsWith("/learn") || path.startsWith("/methodology"),
  },
];

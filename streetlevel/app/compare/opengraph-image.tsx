import { renderOg } from "@/lib/og";
import { COMPARISON_ORDER, COMPARISON_PAIRS } from "@/lib/comparisons";

export const alt = "Compare large-cap stocks head to head: returns, volatility, drawdown, correlation and beta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOg({
    eyebrow: "Head to head",
    title: "Compare stocks side by side.",
    subtitle: `${COMPARISON_PAIRS.length} pairings of ${COMPARISON_ORDER.length} large-cap stocks: one-year returns, volatility, drawdown, Sharpe ratio, correlation and beta.`,
    metrics: [
      { label: "Pairs", value: String(COMPARISON_PAIRS.length) },
      { label: "Stocks", value: String(COMPARISON_ORDER.length) },
      { label: "Window", value: "1Y daily" },
    ],
  });
}

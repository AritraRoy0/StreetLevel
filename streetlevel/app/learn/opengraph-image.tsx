import { renderOg } from "@/lib/og";
import { GUIDE_CATALOG, GUIDE_CATEGORIES } from "@/lib/learn/catalog";

export const alt = "StreetLevel guides: technical indicators and risk metrics, explained";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOg({
    eyebrow: "Learn",
    title: "Technical indicators and risk metrics, explained.",
    subtitle: "RSI, MACD, Bollinger Bands, moving averages, volatility, drawdown, Sharpe ratio, beta and backtesting bias.",
    metrics: GUIDE_CATEGORIES.map((category) => ({
      label: category,
      value: String(GUIDE_CATALOG.filter((guide) => guide.category === category).length),
    })),
    footnote: "Each guide: the formula, the edge cases and live readings from real data",
  });
}

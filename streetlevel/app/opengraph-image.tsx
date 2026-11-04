import { renderOg, thin, toneOf } from "@/lib/og";
import { COMPOSITE_BARS, COMPOSITE_SYMBOL, SYMBOLS } from "@/lib/market-data";
import { buildSummary, formatPercent } from "@/lib/analytics";

export const alt = "StreetLevel: free stock analytics, technical indicators and backtesting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const composite = buildSummary(COMPOSITE_SYMBOL, COMPOSITE_BARS, { range: "1Y" });
  return renderOg({
    eyebrow: "Free market research workspace",
    title: "Every number traced back to a formula.",
    subtitle: `Charts, indicators, comparisons and a backtester for ${SYMBOLS.length} large-cap stocks.`,
    chart: { series: [{ values: thin(composite.bars.map((bar) => bar.adjClose)) }] },
    metrics: [
      { label: "Stocks covered", value: String(SYMBOLS.length) },
      {
        label: "SL10 1Y return",
        value: formatPercent(composite.periodReturn, { signed: true, digits: 1 }),
        tone: toneOf(composite.periodReturn),
      },
      { label: "Trading rules", value: "8" },
      { label: "Price", value: "Free" },
    ],
  });
}

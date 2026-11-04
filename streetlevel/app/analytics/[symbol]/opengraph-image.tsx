import { renderOg, thin, toneOf } from "@/lib/og";
import { COMPOSITE_BARS, COMPOSITE_SYMBOL, SNAPSHOTS, SYMBOLS, getProfile } from "@/lib/market-data";
import { buildSummary, formatDate, formatPercent, formatPoints, formatPrice } from "@/lib/analytics";

export const alt = "Stock analysis card: last close, one-year return, volatility, drawdown and RSI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Rendered once per symbol at build time, like the page itself, rather than on every crawl. */
export function generateStaticParams() {
  return [...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => ({ symbol }));
}

export const dynamicParams = false;

export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const isComposite = symbol === COMPOSITE_SYMBOL;
  const summary = isComposite ? buildSummary(COMPOSITE_SYMBOL, COMPOSITE_BARS, { range: "1Y" }) : SNAPSHOTS[symbol];
  const profile = getProfile(symbol);

  return renderOg({
    eyebrow: isComposite ? "Equal-weight composite" : `${profile.sector} · stock analysis`,
    title: symbol,
    mono: true,
    subtitle: profile.name,
    chart: { series: [{ values: thin(summary.bars.map((bar) => bar.adjClose)) }], tone: toneOf(summary.periodReturn) },
    metrics: [
      {
        label: "Last close",
        value: isComposite ? (summary.lastPrice?.toFixed(1) ?? "—") : formatPrice(summary.lastPrice),
      },
      { label: "1Y return", value: formatPercent(summary.periodReturn, { signed: true, digits: 1 }), tone: toneOf(summary.periodReturn) },
      { label: "Volatility", value: formatPercent(summary.volatility.annualized, { digits: 1 }) },
      { label: "Max drawdown", value: formatPercent(summary.drawdown.maxDrawdown, { digits: 1 }) },
      { label: "RSI 14", value: formatPoints(summary.rsi.value) },
    ],
    footnote: `Daily data to ${formatDate(summary.lastBarTimestamp)} · not investment advice`,
  });
}

import { COMPOSITE_SYMBOL, DATASET, SYMBOLS, getProfile } from "@/lib/market-data";
import { COMPARISON_PAIRS, POPULAR_PAIRS } from "@/lib/comparisons";
import { GUIDE_CATALOG } from "@/lib/learn/catalog";
import { formatDate } from "@/lib/analytics";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * `/llms.txt`: a plain-text map of the site for language-model crawlers and
 * answer engines, following the llms.txt convention. It lists the pages worth
 * citing with one line on what each answers, so an assistant asked "how is
 * RSI calculated" can find the guide rather than guess from the navigation.
 */
export const dynamic = "force-static";

export function GET() {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `Figures come from a validated daily snapshot (${DATASET.source}, ${formatDate(DATASET.from)} to ${formatDate(DATASET.to)}). Every formula is published on the methodology page. Nothing on the site is investment advice.`,
    "",
    "## Stock analytics",
    "",
    ...[...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => {
      const profile = getProfile(symbol);
      return `- [${symbol}: ${profile.name}](${absoluteUrl(`/analytics/${symbol}`)}): price chart, RSI, MACD, Bollinger Bands, moving averages, volatility, drawdown and beta over the trailing year.`;
    }),
    "",
    "## Guides",
    "",
    ...GUIDE_CATALOG.map((guide) => `- [${guide.title}](${absoluteUrl(`/learn/${guide.slug}`)}): ${guide.description}`),
    "",
    "## Comparisons",
    "",
    `- [All ${COMPARISON_PAIRS.length} head-to-head comparisons](${absoluteUrl("/compare")})`,
    ...POPULAR_PAIRS.map(
      (pair) => `- [${pair.first} vs ${pair.second}](${absoluteUrl(`/compare/${pair.slug}`)}): returns, volatility, drawdown, Sharpe ratio, correlation and beta.`,
    ),
    "",
    "## Reference",
    "",
    `- [Methodology](${absoluteUrl("/methodology")}): data validation and the formula behind every figure.`,
    `- [Backtester](${absoluteUrl("/performance")}): eight trading rules with costs, slippage, stops, parameter sweeps and walk-forward analysis.`,
    `- [About](${absoluteUrl("/about")}): what the site covers and where the data comes from.`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

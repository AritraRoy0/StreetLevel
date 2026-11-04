import { renderOg, thin, toneOf } from "@/lib/og";
import { COMPARISON_PAIRS, buildHeadToHead, resolvePairSlug } from "@/lib/comparisons";
import { formatDate, formatPercent, formatRatio } from "@/lib/analytics";

export const alt = "Head-to-head stock comparison: both stocks rebased to 100 with returns, correlation and beta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Canonical pairs only: a reversed slug redirects before anything would ask for its card. */
export function generateStaticParams() {
  return COMPARISON_PAIRS.map((pair) => ({ pair: pair.slug }));
}

export const dynamicParams = false;

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const resolved = resolvePairSlug((await params).pair);
  if (!resolved) return new Response("Not found", { status: 404 });

  const { pair, first, second, firstProfile, secondProfile, comparison } = buildHeadToHead(resolved.pair);
  const rebased = comparison.normalized.filter((point) => point.base !== null && point.benchmark !== null);

  return renderOg({
    eyebrow: "Head to head · trailing year",
    title: `${pair.first} vs ${pair.second}`,
    mono: true,
    subtitle: `${firstProfile.shortName} against ${secondProfile.shortName}: returns, risk, correlation and beta.`,
    chart: {
      series: [
        { values: thin(rebased.map((point) => point.base as number)), label: pair.first },
        { values: thin(rebased.map((point) => point.benchmark as number)), label: pair.second },
      ],
    },
    metrics: [
      { label: `${pair.first} 1Y`, value: formatPercent(first.periodReturn, { signed: true, digits: 1 }), tone: toneOf(first.periodReturn) },
      { label: `${pair.second} 1Y`, value: formatPercent(second.periodReturn, { signed: true, digits: 1 }), tone: toneOf(second.periodReturn) },
      { label: "Correlation", value: formatRatio(comparison.correlation) },
      { label: `Beta of ${pair.first}`, value: formatRatio(comparison.beta) },
    ],
    footnote: `Rebased to 100 · daily data to ${formatDate(first.lastBarTimestamp)}`,
  });
}

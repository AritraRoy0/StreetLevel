import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import { JsonLd } from "@/components/json-ld";
import { PageShell, StatusStrip } from "@/components/shell";
import {
  Eyebrow,
  Metric,
  MetricCell,
  MetricGrid,
  Panel,
  PanelHeader,
  PanelNote,
  TableScroll,
  Td,
  Th,
  buttonClass,
} from "@/components/ui";
import { allPairSlugs, buildHeadToHead, pairsWith, resolvePairSlug } from "@/lib/comparisons";
import type { HeadToHead } from "@/lib/comparisons";
import { DATA_QUALITY, DATASET } from "@/lib/market-data";
import {
  EMPTY,
  formatCompactCurrency,
  formatDate,
  formatPercent,
  formatPoints,
  formatPrice,
  formatRatio,
} from "@/lib/analytics";
import type { Maybe } from "@/lib/analytics";
import type { GuideFaq } from "@/lib/learn/guides";
import { breadcrumbNode, faqNode, graph, pageMetadata, webPageNode } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Every canonical pair, plus each reversed order so it can redirect to the canonical one. */
export function generateStaticParams() {
  return allPairSlugs().map((pair) => ({ pair }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair: slug } = await params;
  const resolved = resolvePairSlug(slug);
  if (!resolved) return {};
  const data = buildHeadToHead(resolved.pair);
  const { first, second } = resolved.pair;
  return pageMetadata({
    title: `${first} vs ${second}: Stock Returns, Volatility, Correlation and Beta Compared`,
    socialTitle: `${first} vs ${second}: head to head`,
    description: describe(data),
    path: `/compare/${resolved.pair.slug}`,
  });
}

function describe({ pair, first, second, comparison }: HeadToHead) {
  return `${pair.first} returned ${formatPercent(first.periodReturn, { signed: true })} and ${pair.second} ${formatPercent(second.periodReturn, { signed: true })} over the year to ${formatDate(first.lastBarTimestamp)}. Compare volatility, drawdown, Sharpe ratio, correlation (${formatRatio(comparison.correlation)}) and beta side by side.`;
}

/** The higher of two figures, or the lower when `lowerIsBetter`; `null` on a tie or a missing value. */
function better(a: Maybe, b: Maybe, lowerIsBetter = false): "a" | "b" | null {
  if (a === null || b === null || a === b) return null;
  return (a > b) !== lowerIsBetter ? "a" : "b";
}

function correlationWord(value: Maybe) {
  if (value === null) return "unavailable";
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "moderate";
  return "low";
}

function narrative(data: HeadToHead): string[] {
  const { pair, first, second, comparison } = data;
  const asOf = formatDate(first.lastBarTimestamp);
  const lead = better(first.periodReturn, second.periodReturn) === "b" ? pair.second : pair.first;
  const lastPoint = comparison.normalized[comparison.normalized.length - 1];

  const paragraphs = [
    `Over the trailing year to ${asOf}, ${pair.first} returned ${formatPercent(first.periodReturn, { signed: true })} and ${pair.second} returned ${formatPercent(second.periodReturn, { signed: true })}, so ${lead} came out ahead by ${formatPercent(Math.abs((first.periodReturn ?? 0) - (second.periodReturn ?? 0)))}.${
      lastPoint && comparison.windowStart
        ? ` Rebased to 100 on ${formatDate(comparison.windowStart)}, ${pair.first} finished at ${lastPoint.base?.toFixed(1) ?? EMPTY} and ${pair.second} at ${lastPoint.benchmark?.toFixed(1) ?? EMPTY}.`
        : ""
    }`,
  ];

  const volatile = better(first.volatility.annualized, second.volatility.annualized) === "b" ? "second" : "first";
  const [hot, cool] = volatile === "first" ? [first, second] : [second, first];
  const [hotSymbol, coolSymbol] = volatile === "first" ? [pair.first, pair.second] : [pair.second, pair.first];
  const deeper = (hot.drawdown.maxDrawdown ?? 0) <= (cool.drawdown.maxDrawdown ?? 0);
  paragraphs.push(
    `${hotSymbol} was the more volatile of the two, at ${formatPercent(hot.volatility.annualized)} annualized against ${formatPercent(cool.volatility.annualized)} for ${coolSymbol}, and it ${deeper ? "also suffered the deeper" : "nonetheless had the shallower"} maximum drawdown: ${formatPercent(hot.drawdown.maxDrawdown)} against ${formatPercent(cool.drawdown.maxDrawdown)}.`,
  );

  const sharpeLead = better(first.sharpe, second.sharpe);
  if (sharpeLead) {
    const gap = Math.abs((first.sharpe ?? 0) - (second.sharpe ?? 0));
    const [winner, loser] = sharpeLead === "a" ? [pair.first, pair.second] : [pair.second, pair.first];
    paragraphs.push(
      `On a risk-adjusted basis ${winner} had the higher Sharpe ratio, ${formatRatio(sharpeLead === "a" ? first.sharpe : second.sharpe)} against ${formatRatio(sharpeLead === "a" ? second.sharpe : first.sharpe)} for ${loser}. With a single year of daily data each estimate carries an error of roughly ±1, so ${gap < 1 ? "a gap this size is within the noise of the estimate" : "even allowing for that, the gap is wide"}.`,
    );
  }

  if (comparison.correlation !== null && comparison.beta !== null) {
    paragraphs.push(
      `Their daily returns had a ${correlationWord(comparison.correlation)} correlation of ${formatRatio(comparison.correlation)} across ${comparison.alignedPoints} shared sessions. Regressing ${pair.first} on ${pair.second} gives a beta of ${formatRatio(comparison.beta)}: on average ${pair.first} moved ${formatRatio(comparison.beta)}% for each 1% move in ${pair.second}.`,
    );
  }

  return paragraphs;
}

function headToHeadFaqs(data: HeadToHead): GuideFaq[] {
  const { pair, first, second, comparison } = data;
  const asOf = formatDate(first.lastBarTimestamp);
  const pick = <T,>(side: "a" | "b" | null, a: T, b: T) => (side === "b" ? [b, a] : [a, b]);

  const [returnWinner, returnLoser] = pick(better(first.periodReturn, second.periodReturn), { s: pair.first, x: first }, { s: pair.second, x: second });
  const [moreVolatile, lessVolatile] = pick(
    better(first.volatility.annualized, second.volatility.annualized),
    { s: pair.first, x: first },
    { s: pair.second, x: second },
  );
  const [deeper, shallower] = pick(
    better(first.drawdown.maxDrawdown, second.drawdown.maxDrawdown, true),
    { s: pair.first, x: first },
    { s: pair.second, x: second },
  );

  const faqs: GuideFaq[] = [
    {
      question: `Which stock performed better over the past year, ${pair.first} or ${pair.second}?`,
      answer: `${returnWinner.s} returned ${formatPercent(returnWinner.x.periodReturn, { signed: true })} over the trailing year to ${asOf}, against ${formatPercent(returnLoser.x.periodReturn, { signed: true })} for ${returnLoser.s}.`,
    },
    {
      question: `Is ${pair.first} or ${pair.second} more volatile?`,
      answer: `${moreVolatile.s}. Its annualized volatility over the trailing year was ${formatPercent(moreVolatile.x.volatility.annualized)}, against ${formatPercent(lessVolatile.x.volatility.annualized)} for ${lessVolatile.s}.`,
    },
    {
      question: `Which had the bigger drawdown, ${pair.first} or ${pair.second}?`,
      answer: `${deeper.s} fell further: its maximum drawdown over the trailing year was ${formatPercent(deeper.x.drawdown.maxDrawdown)}, against ${formatPercent(shallower.x.drawdown.maxDrawdown)} for ${shallower.s}.`,
    },
  ];

  if (comparison.correlation !== null) {
    faqs.push({
      question: `How correlated are ${pair.first} and ${pair.second}?`,
      answer: `Their daily returns had a correlation of ${formatRatio(comparison.correlation)} over ${comparison.alignedPoints} shared sessions, which is ${correlationWord(comparison.correlation)}. A beta of ${formatRatio(comparison.beta)} means ${pair.first} moved, on average, ${formatRatio(comparison.beta)}% for each 1% move in ${pair.second}.`,
    });
  }

  return faqs;
}

export default async function ComparePairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair: slug } = await params;
  const resolved = resolvePairSlug(slug);
  if (!resolved) notFound();
  if (!resolved.canonical) permanentRedirect(`/compare/${resolved.pair.slug}`);

  const data = buildHeadToHead(resolved.pair);
  const { pair, first, second, firstProfile, secondProfile, comparison, firstVsComposite, secondVsComposite } = data;
  const path = `/compare/${pair.slug}`;
  const asOf = formatDate(first.lastBarTimestamp);
  const quality = DATA_QUALITY[pair.first];
  const faqs = headToHeadFaqs(data);
  const title = `${pair.first} vs ${pair.second}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/compare" },
    { name: title, path },
  ];

  const rows: Array<{ label: string; a: Maybe; b: Maybe; format: (value: Maybe) => string; lowerIsBetter?: boolean; neutral?: boolean }> = [
    { label: "Last close", a: first.lastPrice, b: second.lastPrice, format: formatPrice, neutral: true },
    { label: "1Y return", a: first.periodReturn, b: second.periodReturn, format: (v) => formatPercent(v, { signed: true }) },
    { label: "CAGR", a: first.cagr.value, b: second.cagr.value, format: (v) => formatPercent(v, { signed: true }) },
    { label: "Volatility", a: first.volatility.annualized, b: second.volatility.annualized, format: formatPercent, lowerIsBetter: true },
    { label: "Max drawdown", a: first.drawdown.maxDrawdown, b: second.drawdown.maxDrawdown, format: formatPercent },
    { label: "Sharpe ratio", a: first.sharpe, b: second.sharpe, format: formatRatio },
    { label: "Sortino ratio", a: first.sortino, b: second.sortino, format: formatRatio },
    { label: "RSI 14", a: first.rsi.value, b: second.rsi.value, format: formatPoints, neutral: true },
    { label: "Beta to SL10", a: firstVsComposite.beta, b: secondVsComposite.beta, format: formatRatio, neutral: true },
    { label: "Market cap", a: firstProfile.marketCap, b: secondProfile.marketCap, format: formatCompactCurrency, neutral: true },
    { label: "P/E ratio", a: firstProfile.peRatio, b: secondProfile.peRatio, format: (v) => (v === null || !Number.isFinite(v) ? EMPTY : v.toFixed(1)), neutral: true },
  ];

  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path,
            name: `${title}: stock comparison`,
            description: describe(data),
            dateModified: first.lastBarTimestamp ?? DATASET.downloadedAt,
            breadcrumbId: `${absoluteUrl(path)}#breadcrumb`,
          }),
          breadcrumbNode(path, crumbs),
          faqNode(path, faqs),
        )}
      />
      <StatusStrip asOf={quality?.lastBar ?? null} source={DATASET.source} stale={quality?.stale} note="Head to head" />
      <PageShell>
        <Breadcrumbs crumbs={crumbs} />
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-hairline-strong pb-6">
          <div className="min-w-0 max-w-2xl">
            <Eyebrow className="mb-2">Head to head · trailing year to {asOf}</Eyebrow>
            <h1 className="font-mono text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
              {pair.first} <span className="font-sans font-normal text-muted">vs</span> {pair.second}
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              {firstProfile.name} against {secondProfile.name}: returns, risk, correlation and beta from the same
              validated daily bars, aligned on the sessions both traded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/analytics/${pair.first}`} className={buttonClass({ size: "sm" })}>
              {pair.first} analytics
            </Link>
            <Link href={`/analytics/${pair.second}`} className={buttonClass({ size: "sm" })}>
              {pair.second} analytics
            </Link>
            <Link
              href={`/performance?multi=1&symbols=${pair.first},${pair.second}`}
              className={buttonClass({ variant: "primary", size: "sm" })}
            >
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              Backtest both
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
          <Panel className="min-w-0">
            <PanelHeader title={`${pair.first} and ${pair.second} rebased to 100`} eyebrow="Growth of 100 on the first shared session" />
            <div className="p-3 sm:p-4">
              <ComparisonChart points={comparison.normalized} baseLabel={pair.first} benchmarkLabel={pair.second} />
            </div>
            <PanelNote>
              Adjusted closes from {formatDate(comparison.windowStart)} to {formatDate(comparison.windowEnd)}, aligned
              on {comparison.alignedPoints} sessions both stocks traded.
            </PanelNote>
          </Panel>

          <Panel className="min-w-0">
            <PanelHeader title="Side by side" eyebrow="Trailing year · stronger figure in bold" />
            <TableScroll>
              <table className="w-full border-collapse">
                <caption className="sr-only">
                  {pair.first} and {pair.second} compared on return, risk and valuation over the trailing year
                </caption>
                <thead>
                  <tr>
                    <Th>Measure</Th>
                    <Th align="right">{pair.first}</Th>
                    <Th align="right">{pair.second}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const lead = row.neutral ? null : better(row.a, row.b, row.lowerIsBetter);
                    return (
                      <tr key={row.label}>
                        <Td className="text-muted">{row.label}</Td>
                        <Td align="right" className={cn(lead === "a" && "font-semibold text-ink")}>
                          {row.format(Number.isFinite(row.a ?? Number.NaN) ? row.a : null)}
                        </Td>
                        <Td align="right" className={cn(lead === "b" && "font-semibold text-ink")}>
                          {row.format(Number.isFinite(row.b ?? Number.NaN) ? row.b : null)}
                        </Td>
                      </tr>
                    );
                  })}
                  <tr>
                    <Td className="text-muted">Sector</Td>
                    <Td align="right" className="font-sans">
                      {firstProfile.sector}
                    </Td>
                    <Td align="right" className="font-sans">
                      {secondProfile.sector}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </TableScroll>
          </Panel>
        </section>

        <section className="mt-8" aria-labelledby="together">
          <Panel>
            <div className="border-b border-hairline px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {pair.first} measured against {pair.second}
              </p>
              <h2 id="together" className="text-[13px] font-semibold tracking-tight text-ink">
                How they move together
              </h2>
            </div>
            <MetricGrid className="border-x-0 border-t-0">
              <MetricCell>
                <Metric label="Correlation" value={formatRatio(comparison.correlation)} hint={`${comparison.alignedPoints} shared sessions`} />
              </MetricCell>
              <MetricCell>
                <Metric label={`Beta of ${pair.first}`} value={formatRatio(comparison.beta)} hint={`Per 1% move in ${pair.second}`} />
              </MetricCell>
              <MetricCell>
                <Metric
                  label="Relative growth"
                  value={formatPercent(comparison.relativeGrowth, { signed: true })}
                  tone={comparison.relativeGrowth}
                  hint={`${pair.first} wealth relative to ${pair.second}`}
                />
              </MetricCell>
              <MetricCell>
                <Metric label="Tracking error" value={formatPercent(comparison.trackingError)} hint="Annualized deviation of the gap" />
              </MetricCell>
            </MetricGrid>
          </Panel>
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-10">
            <section aria-labelledby="summary">
              <h2 id="summary" className="text-lg font-semibold tracking-tight text-ink">
                {pair.first} vs {pair.second}: the trailing year in brief
              </h2>
              <div className="mt-3 max-w-[70ch] space-y-3 text-[14px] leading-[1.7] text-ink-soft">
                {narrative(data).map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section aria-labelledby="faq">
              <h2 id="faq" className="text-lg font-semibold tracking-tight text-ink">
                Frequently asked questions
              </h2>
              <dl className="mt-3 divide-y divide-hairline border-y border-hairline">
                {faqs.map((faq) => (
                  <div key={faq.question} className="py-4">
                    <dt className="text-[14px] font-semibold text-ink">{faq.question}</dt>
                    <dd className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-soft">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Figures describe the bundled daily snapshot and are for research and education, not investment advice.
              </p>
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <MoreComparisons symbol={pair.first} exclude={pair.slug} />
            <MoreComparisons symbol={pair.second} exclude={pair.slug} />
            <Panel>
              <PanelHeader title="What these measures mean" eyebrow="Guides" />
              <ul className="divide-y divide-hairline">
                {[
                  ["correlation", "Correlation between stocks"],
                  ["beta", "Beta"],
                  ["volatility", "Annualized volatility"],
                  ["max-drawdown", "Maximum drawdown"],
                  ["sharpe-ratio", "Sharpe ratio"],
                ].map(([slug, label]) => (
                  <li key={slug}>
                    <Link
                      href={`/learn/${slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                    >
                      {label}
                      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      </PageShell>
    </>
  );
}

function MoreComparisons({ symbol, exclude }: { symbol: string; exclude: string }) {
  const pairs = pairsWith(symbol).filter((pair) => pair.slug !== exclude);
  return (
    <Panel>
      <PanelHeader title={`More with ${symbol}`} eyebrow="Head to head" />
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {pairs.map((pair) => (
          <Link
            key={pair.slug}
            href={`/compare/${pair.slug}`}
            className="border border-hairline px-2 py-1 font-mono text-[11px] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:bg-sunken hover:text-ink"
          >
            {pair.first} vs {pair.second}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

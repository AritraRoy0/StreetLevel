/**
 * The written summary under a symbol's workspace.
 *
 * The workspace above it is interactive and redraws for any window; this
 * section is fixed to the trailing year and says in sentences what the
 * figures show, the way someone asking "how volatile is NVDA" would want it
 * answered. It is rendered on the server, so the text is in the page's HTML
 * for readers and crawlers alike, and the questions it answers are the same
 * ones its structured data declares.
 *
 * The section also links outward: to every head-to-head comparison with this
 * name, and to the guides that explain each measure it quotes.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Delta, Panel, PanelNote } from "@/components/ui";
import { formatDate, formatPercent, formatPoints, formatPrice, formatRatio } from "@/lib/analytics";
import type { AnalyticsSummary, ComparisonResult } from "@/lib/analytics";
import type { SymbolProfile } from "@/lib/market-data";
import type { ComparisonPair } from "@/lib/comparisons";
import type { GuideFaq } from "@/lib/learn/guides";

export interface SymbolBriefData {
  symbol: string;
  profile: SymbolProfile;
  summary: AnalyticsSummary;
  isComposite: boolean;
  /** The SL10 composite's one-year summary. */
  composite: AnalyticsSummary;
  /** This name against the composite, or null when this is the composite. */
  versusComposite: ComparisonResult | null;
  /** Median annualized volatility across the covered names. */
  medianVolatility: number | null;
  /** Rank by volatility, 1 being the most volatile, among `peerCount` names. */
  volatilityRank: number | null;
  peerCount: number;
  /** Comparison pages that include this name, with each pairing's one-year return gap. */
  comparisons: Array<{ pair: ComparisonPair; other: string; gap: number | null }>;
  /** Composite constituents, shown in place of comparisons on the composite's page. */
  constituents: Array<{ symbol: string; name: string; periodReturn: number | null }>;
}

const GUIDE_LINKS: Array<{ slug: string; label: string }> = [
  { slug: "rsi", label: "Relative Strength Index" },
  { slug: "macd", label: "MACD" },
  { slug: "bollinger-bands", label: "Bollinger Bands" },
  { slug: "moving-averages", label: "Moving averages" },
  { slug: "volatility", label: "Annualized volatility" },
  { slug: "max-drawdown", label: "Maximum drawdown" },
  { slug: "beta", label: "Beta" },
  { slug: "sharpe-ratio", label: "Sharpe ratio" },
];

function signedPercent(value: number | null) {
  return formatPercent(value, { signed: true });
}

function zonePhrase(zone: AnalyticsSummary["rsi"]["zone"]) {
  if (zone === "overbought") return "in overbought territory above 70";
  if (zone === "oversold") return "in oversold territory below 30";
  if (zone === "neutral") return "inside the neutral band between 30 and 70";
  return "unavailable";
}

function recoveryPhrase(summary: AnalyticsSummary) {
  const { drawdown } = summary;
  if (drawdown.peakTimestamp === null) return "The price set a new high on every session, so there was no drawdown.";
  return drawdown.recoveryTimestamp
    ? `The price regained that peak on ${formatDate(drawdown.recoveryTimestamp)}.`
    : `It had not regained that peak by ${formatDate(summary.lastBarTimestamp)}.`;
}

function maPhrase(summary: AnalyticsSummary, label: string, name: string) {
  const average = summary.movingAverages.find((item) => item.label === label);
  if (!average || average.priceVsMa === null) return null;
  return `${formatPercent(Math.abs(average.priceVsMa))} ${average.priceVsMa >= 0 ? "above" : "below"} its ${name}`;
}

/** The questions and answers, shared by the visible list and the structured data. */
export function symbolFaqs(data: SymbolBriefData): GuideFaq[] {
  const { symbol, summary, composite, versusComposite, medianVolatility, isComposite } = data;
  const asOf = formatDate(summary.lastBarTimestamp);
  const drawdownAnswer =
    summary.drawdown.maxDrawdown === null || summary.drawdown.peakTimestamp === null
      ? `${symbol} had no drawdown over the trailing year to ${asOf}.`
      : `${formatPercent(summary.drawdown.maxDrawdown)}, measured on closing prices from a peak on ${formatDate(summary.drawdown.peakTimestamp)} to a trough on ${formatDate(summary.drawdown.troughTimestamp)}. ${recoveryPhrase(summary)}`;

  const faqs: GuideFaq[] = [
    {
      question: isComposite ? "How did the SL10 composite perform over the past year?" : `How did ${symbol} stock perform over the past year?`,
      answer: isComposite
        ? `The SL10 composite returned ${signedPercent(summary.periodReturn)} over the trailing year to ${asOf}.`
        : `${symbol} returned ${signedPercent(summary.periodReturn)} over the trailing year to ${asOf}, against ${signedPercent(composite.periodReturn)} for the equal-weight SL10 composite of the ten stocks StreetLevel covers.`,
    },
    {
      question: isComposite ? "How volatile is the SL10 composite?" : `How volatile is ${symbol} stock?`,
      answer: `Annualized volatility over the trailing year was ${formatPercent(summary.volatility.annualized)}, computed from ${summary.volatility.observations} daily returns. The median across the ten covered stocks was ${formatPercent(medianVolatility)}.`,
    },
    {
      question: `What was ${symbol}'s maximum drawdown over the past year?`,
      answer: drawdownAnswer,
    },
    {
      question: isComposite ? "Is the SL10 composite overbought?" : `Is ${symbol} stock overbought?`,
      answer:
        summary.rsi.value === null
          ? `RSI 14 is unavailable for ${symbol} over this window.`
          : `The 14-day RSI read ${formatPoints(summary.rsi.value)} on ${asOf}, ${zonePhrase(summary.rsi.zone)}. Overbought is a description of recent momentum rather than a forecast.`,
    },
  ];

  if (isComposite) {
    faqs.push({
      question: "What is the SL10 composite?",
      answer:
        "An equal-weight index of the ten large-cap stocks StreetLevel covers, rebased to 100 at the first session all of them traded. It serves as the house benchmark and is not a proxy for the S&P 500 or any published index.",
    });
  } else if (versusComposite) {
    faqs.push({
      question: `What is ${symbol}'s beta?`,
      answer: `Against the equal-weight SL10 composite, ${symbol}'s beta over the trailing year was ${formatRatio(versusComposite.beta)}, with a correlation of ${formatRatio(versusComposite.correlation)}. Betas published elsewhere are usually measured against the S&P 500 and will differ.`,
    });
  }

  return faqs;
}

export function SymbolBrief({ data }: { data: SymbolBriefData }) {
  const { symbol, profile, summary, composite, versusComposite, isComposite } = data;
  const asOf = formatDate(summary.lastBarTimestamp);
  const faqs = symbolFaqs(data);

  const performance = isComposite
    ? `The SL10 composite is an equal-weight index of the ten stocks StreetLevel covers, rebased to 100 at their first common session. It closed at ${summary.lastPrice?.toFixed(2) ?? "—"} on ${asOf} and returned ${signedPercent(summary.periodReturn)} over the trailing year.`
    : `${profile.name} (${symbol}) closed at ${formatPrice(summary.lastPrice)} on ${asOf}, ${signedPercent(summary.lastChangePercent)} on the session. Over the trailing year it returned ${signedPercent(summary.periodReturn)}, against ${signedPercent(composite.periodReturn)} for the SL10 composite${
        versusComposite && versusComposite.excessReturn !== null
          ? `, ${versusComposite.excessReturn >= 0 ? "ahead" : "behind"} by ${formatPercent(Math.abs(versusComposite.excessReturn))}`
          : ""
      }.`;

  const rankPhrase =
    data.volatilityRank === null
      ? ""
      : data.volatilityRank === 1
        ? `, the most volatile of the ${data.peerCount} covered names`
        : data.volatilityRank === data.peerCount
          ? `, the least volatile of the ${data.peerCount} covered names`
          : "";
  const risk = `Annualized volatility over the year was ${formatPercent(summary.volatility.annualized)}, ${
    (summary.volatility.annualized ?? 0) >= (data.medianVolatility ?? 0) ? "above" : "below"
  } the median of ${formatPercent(data.medianVolatility)} across the ten covered names${rankPhrase}.${
    summary.drawdown.peakTimestamp
      ? ` The deepest decline was ${formatPercent(summary.drawdown.maxDrawdown)}, from a peak on ${formatDate(summary.drawdown.peakTimestamp)} to a trough on ${formatDate(summary.drawdown.troughTimestamp)}. ${recoveryPhrase(summary)}`
      : ""
  }`;

  const fifty = maPhrase(summary, "SMA 50", "50-day average");
  const twoHundred = maPhrase(summary, "SMA 200", "200-day average");
  const cross = summary.cross
    ? ` The 50-day average crossed ${summary.cross.kind === "golden" ? "above" : "below"} the 200-day on ${formatDate(summary.cross.timestamp)}, a ${summary.cross.kind} cross.`
    : "";
  const indicators = `On the latest session RSI 14 read ${formatPoints(summary.rsi.value)}, ${zonePhrase(summary.rsi.zone)}. The MACD histogram was ${
    summary.macdSummary.trend === null ? "unavailable" : `${summary.macdSummary.trend === "bullish" ? "positive" : "negative"}, a ${summary.macdSummary.trend} reading`
  }${fifty || twoHundred ? `, and the close sat ${[fifty, twoHundred].filter(Boolean).join(" and ")}` : ""}.${cross}`;

  const relationship =
    versusComposite && versusComposite.beta !== null
      ? `Against the SL10 composite its beta was ${formatRatio(versusComposite.beta)} and its correlation ${formatRatio(versusComposite.correlation)}, so it ${
          versusComposite.beta > 1.1 ? "amplified" : versusComposite.beta < 0.9 ? "dampened" : "moved roughly in line with"
        } the group's daily moves.`
      : null;

  return (
    <section aria-labelledby="symbol-brief" className="mt-10 grid gap-6 sm:mt-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
      <Panel className="min-w-0">
        <div className="border-b border-hairline px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Trailing year to {asOf}</p>
          <h2 id="symbol-brief" className="text-[15px] font-semibold tracking-tight text-ink">
            {isComposite ? "The SL10 composite at a glance" : `${profile.shortName} (${symbol}) at a glance`}
          </h2>
        </div>
        <div className="max-w-3xl space-y-3 px-4 py-4 text-[13px] leading-relaxed text-ink-soft">
          <p>{performance}</p>
          <p>{risk}</p>
          <p>{indicators}</p>
          {relationship && <p>{relationship}</p>}
        </div>

        <div className="border-t border-hairline px-4 py-4">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">
            {isComposite ? "Questions about the SL10 composite" : `Questions about ${symbol} stock`}
          </h2>
          <dl className="mt-3 divide-y divide-hairline">
            {faqs.map((faq) => (
              <div key={faq.question} className="py-3 first:pt-0 last:pb-0">
                <dt className="text-[13px] font-medium text-ink">{faq.question}</dt>
                <dd className="mt-1 max-w-3xl text-[12px] leading-relaxed text-muted">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>

        <PanelNote>
          Figures describe the bundled daily snapshot and the trailing year ending {asOf}. They are for research and
          education, not investment advice.{" "}
          <Link href="/methodology" className="underline underline-offset-2 hover:text-ink">
            How every figure is computed
          </Link>
          .
        </PanelNote>
      </Panel>

      <div className="min-w-0 space-y-6">
        {isComposite ? (
          <Panel>
            <SideHeader title="Constituents" eyebrow="Equal weight · 1Y return" />
            <ul className="divide-y divide-hairline">
              {data.constituents.map((item) => (
                <li key={item.symbol}>
                  <Link
                    href={`/analytics/${item.symbol}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-[12px] font-semibold text-ink">{item.symbol}</span>
                      <span className="ml-2 truncate text-[11px] text-muted">{item.name}</span>
                    </span>
                    <Delta value={item.periodReturn} className="text-[12px]" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel>
            <SideHeader title={`Compare ${symbol}`} eyebrow={`1Y return gap, ${symbol} minus the other`} />
            <ul className="divide-y divide-hairline">
              {data.comparisons.map((item) => (
                <li key={item.pair.slug}>
                  <Link
                    href={`/compare/${item.pair.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken"
                  >
                    <span className="text-[12px] text-ink-soft">
                      <span className="font-mono font-semibold text-ink">{symbol}</span> vs{" "}
                      <span className="font-mono font-semibold text-ink">{item.other}</span>
                    </span>
                    <Delta value={item.gap} className="text-[12px]" />
                  </Link>
                </li>
              ))}
            </ul>
            <PanelNote>
              <Link href="/compare" className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                All head-to-head comparisons
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            </PanelNote>
          </Panel>
        )}

        <Panel>
          <SideHeader title="How these figures work" eyebrow="Guides" />
          <ul className="divide-y divide-hairline">
            {GUIDE_LINKS.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/learn/${guide.slug}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                >
                  {guide.label}
                  <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function SideHeader({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="border-b border-hairline px-4 py-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
    </div>
  );
}

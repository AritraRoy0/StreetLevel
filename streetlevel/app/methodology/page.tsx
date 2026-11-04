import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageHeader, PageShell } from "@/components/shell";
import { Panel, PanelHeader, TableScroll, Td, Th } from "@/components/ui";
import { DATASET, SYMBOLS } from "@/lib/market-data";
import { formatDate } from "@/lib/analytics";
import { CONTENT_UPDATED } from "@/lib/site";
import { articleNode, breadcrumbNode, graph, pageMetadata } from "@/lib/seo";

const DESCRIPTION =
  "How StreetLevel computes every figure: data validation, adjusted versus raw prices, the formulas for returns, volatility, drawdown, Sharpe, beta and every indicator, and the backtest execution model.";

export const metadata = pageMetadata({
  title: "Methodology: How Every Figure Is Calculated",
  socialTitle: "StreetLevel methodology",
  description: DESCRIPTION,
  path: "/methodology",
  type: "article",
  publishedTime: CONTENT_UPDATED,
  modifiedTime: CONTENT_UPDATED,
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Methodology", path: "/methodology" },
];

const CONTENTS = [
  { id: "data", label: "Data and validation" },
  { id: "conventions", label: "Conventions" },
  { id: "return-and-risk", label: "Return and risk" },
  { id: "indicators", label: "Indicators" },
  { id: "comparison", label: "Benchmark comparison" },
  { id: "backtesting", label: "Backtesting" },
  { id: "verification", label: "How the figures are checked" },
  { id: "limits", label: "Limits" },
];

const RISK_FORMULAS: Array<[string, string, string, string?]> = [
  ["Simple return", "(to − from) / from", "from is not strictly positive"],
  ["Period return", "first adjusted close to last", "fewer than 2 bars"],
  ["CAGR", "(end / start)^(365.25 / days) − 1", "window under 330 days", "cagr"],
  ["Annualized volatility", "σ_sample(r) × √P", "fewer than 2 returns", "volatility"],
  ["Drawdown at t", "C_t / max(C_0 … C_t) − 1", "empty series", "max-drawdown"],
  ["Sharpe", "(mean(r) · P − r_f) / (σ · √P)", "σ is zero or undefined", "sharpe-ratio"],
  ["Sortino", "same numerator, over √(mean(min(r − MAR, 0)²)) · √P", "nothing falls below MAR", "sortino-ratio"],
  ["Calmar", "CAGR / |max drawdown|", "no CAGR or no drawdown"],
];

const INDICATORS: Array<[string, string, string?]> = [
  ["SMA(n)", "Mean of the trailing n closes, defined from the nth bar.", "moving-averages"],
  ["EMA(n)", "Weight 2 / (n + 1), seeded with the SMA of the first n closes rather than the first close.", "moving-averages"],
  ["RSI(14)", "Wilder smoothing of gains and losses; a perfectly flat window reads a neutral 50, not 100.", "rsi"],
  ["MACD(12, 26, 9)", "EMA 12 minus EMA 26; the signal is a 9-period EMA of that line; histogram is the difference.", "macd"],
  ["Bollinger(20, 2)", "SMA 20 centre with the population deviation of the window, as Bollinger defined it.", "bollinger-bands"],
  ["ATR(14)", "Wilder smoothing of the true range, which counts overnight gaps.", "average-true-range"],
  ["OBV", "Running volume total signed by the close-to-close change, seeded at zero."],
  ["Crosses", "The fast average moving from at or below the slow one to strictly above it, and the reverse.", "golden-cross"],
];

export default function MethodologyPage() {
  return (
    <PageShell>
      <JsonLd
        data={graph(
          articleNode({ path: "/methodology", headline: "How every StreetLevel figure is calculated", description: DESCRIPTION }),
          breadcrumbNode("/methodology", CRUMBS),
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} />
      <PageHeader
        eyebrow="Methodology"
        title="How every figure is calculated"
        description="Every number on StreetLevel comes from a pure function with a stated formula. This page is the contract those functions honour: the inputs, the formula, and what happens at the edges."
      />

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="On this page" className="hidden lg:sticky lg:top-[calc(var(--nav-height)+1.5rem)] lg:block lg:self-start">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">On this page</p>
          <ul className="space-y-1.5">
            {CONTENTS.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="text-[12px] text-ink-soft hover:text-ink hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          <Section id="data" title="Data and validation">
            <p>
              The bundled dataset is a daily download from the {DATASET.source}, covering {SYMBOLS.length} large-cap
              stocks from {formatDate(DATASET.from)} to {formatDate(DATASET.to)}, captured on{" "}
              {formatDate(DATASET.downloadedAt)}. There are no intraday bars.
            </p>
            <p>
              Every bar passes through validation before anything is computed. A bar is rejected when a price is
              missing, non-finite or not strictly positive, when volume is negative, when the low exceeds the high, or
              when the open or close falls outside the day&apos;s range. That last check catches a feed that has mixed
              adjusted and unadjusted fields, which otherwise corrupts candles silently. Duplicate timestamps collapse
              to the last occurrence, matching how providers issue corrections, and out-of-order bars are sorted and
              counted.
            </p>
            <p>
              The result carries a data-quality record: bars accepted, rejected, duplicated and reordered, weekday
              sessions missing inside the window, and how many trading days old the newest bar is. Staleness is counted
              in weekdays, so a Friday close read on a Sunday is not stale. Named windows such as one year are anchored
              on the newest bar rather than on today&apos;s date, so a feed that is a few days behind still draws a full
              chart, with its age reported separately.
            </p>
            <p>
              The headlines in the news panels are illustrative fixtures written for the demonstration, not real
              reporting, and are labelled as a sample feed wherever they appear.
            </p>
          </Section>

          <Section id="conventions" title="Conventions">
            <p>
              <strong className="font-semibold text-ink">Returns are fractions.</strong> 0.0512 means +5.12%. The
              multiplication by 100 happens exactly once, at display, which is how hundred-fold errors are avoided.
            </p>
            <p>
              <strong className="font-semibold text-ink">Adjusted versus raw prices.</strong> Return, volatility,
              drawdown, moving-average and oscillator calculations use the split- and dividend-adjusted close. Candles,
              the period high and low, the currency change and ATR use the raw open, high, low and close, so what is
              drawn matches what traded on the day. Across a dividend the percentage return and the currency change can
              legitimately disagree.
            </p>
            <p>
              <strong className="font-semibold text-ink">Unavailable, never wrong.</strong> A metric that cannot be
              computed is reported as unavailable and shown as an em dash, never as NaN, infinity or zero. Division by
              zero is treated as undefined rather than as infinitely large.
            </p>
            <p>
              <strong className="font-semibold text-ink">Rounding happens once.</strong> Calculations keep full
              precision; values are rounded only for display, half away from zero, so errors cannot compound through
              chained metrics. Dates are shown in UTC.
            </p>
          </Section>

          <Section id="return-and-risk" title="Return and risk">
            <p>
              P is the number of periods per year: 252 for daily returns, 52 for weekly and 12 for monthly. The
              risk-free rate on the analytics pages is zero.
            </p>
            <FormulaTable
              head={["Measure", "Formula", "Unavailable when"]}
              rows={RISK_FORMULAS.map(([name, formula, unavailable, guide]) => [
                guide ? <GuideLink key={name} slug={guide}>{name}</GuideLink> : name,
                <code key={`${name}-formula`} className="font-mono text-[12px] text-ink">{formula}</code>,
                unavailable,
              ])}
            />
            <p>
              Volatility uses the sample standard deviation and is marked indicative below 20 returns. CAGR is withheld
              below 330 days, because annualizing a one-month move produces figures that are arithmetically correct
              and analytically meaningless. Drawdown is measured on closes; the period high and low use intraday
              extremes, because that is what a 52-week high means.
            </p>
          </Section>

          <Section id="indicators" title="Indicators">
            <p>
              Every indicator returns a series the same length as its input, with gaps in the warm-up positions, so an
              overlay lines up with the bars without re-deriving offsets and short history is explicit.
            </p>
            <FormulaTable
              head={["Indicator", "Definition"]}
              rows={INDICATORS.map(([name, definition, guide]) => [
                guide ? <GuideLink key={name} slug={guide}>{name}</GuideLink> : name,
                definition,
              ])}
            />
          </Section>

          <Section id="comparison" title="Benchmark comparison">
            <p>
              Two series are joined on calendar day before anything is computed. Days missing on either side are
              dropped and counted rather than forward-filled, because a carried-forward price manufactures a zero
              return. Both legs are rebased to 100 at the first shared date, so the chart answers what a dollar would
              have done.
            </p>
            <p>
              <GuideLink slug="correlation">Correlation</GuideLink>, <GuideLink slug="beta">beta</GuideLink>, tracking
              error and the information ratio are withheld below 20 aligned observations. The house benchmark, SL10, is
              an equal-weight composite of the covered names rebased to 100 at the first date all of them trade. It is
              labelled as that, not as a proxy for a published index.
            </p>
          </Section>

          <Section id="backtesting" title="Backtesting">
            <p>
              A rule produces a desired position at each bar. On every bar the simulator first fills any order queued by
              the previous bar, then tests protective exits against the bar&apos;s range, then reads the rule and queues
              an order for the next bar. Filling before deciding is what makes the engine causal: a decision read at the
              close of one session cannot fill before the next.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 marker:text-faint">
              <li>A gap through a stop or target fills at the open, not at the level.</li>
              <li>When a stop and a target are both touched inside one bar, the stop fills first.</li>
              <li>A signal on the final bar is discarded, since there is no later bar to fill against.</li>
              <li>
                Slippage and half the quoted spread are charged against the direction on both legs, and the buy-and-hold
                benchmark pays the same costs.
              </li>
              <li>Long only: no shorting, leverage or margin.</li>
            </ul>
            <p>
              A causality check recomputes every signal over truncated prefixes of the data and requires each answer to
              match the full run. Parameter sweeps report the full distribution and a{" "}
              <GuideLink slug="deflated-sharpe-ratio">deflated Sharpe ratio</GuideLink>, and{" "}
              <GuideLink slug="walk-forward-analysis">walk-forward analysis</GuideLink> measures chosen parameters on
              data they never saw. The <GuideLink slug="backtesting-bias">backtesting bias guide</GuideLink> covers why
              each of these matters.
            </p>
          </Section>

          <Section id="verification" title="How the figures are checked">
            <p>
              The engine is covered by an automated test suite. RSI and EMA are checked against Wilder&apos;s published
              worked example and against a second implementation written separately from the formula. The integration
              tests re-derive total return, volatility, maximum drawdown, period extremes and average volume from the
              raw data with inline arithmetic, so the engine is compared against something other than itself.
            </p>
            <p>
              The backtester reconciles its equity curve against an independent replay of its own transaction log, to
              within a hundredth of a cent, across every symbol and rule; and buy-and-hold through the simulator must
              reproduce the return the analytics engine reports for the same window. The source and tests are{" "}
              <Link href="/about" className="underline underline-offset-2 hover:text-ink">
                public
              </Link>
              .
            </p>
          </Section>

          <Section id="limits" title="Limits">
            <p>
              The dataset covers {SYMBOLS.length} large-cap names that exist today, over roughly one year of daily
              bars. That carries severe survivorship bias, and one year is a single observation of any annual
              statistic. The figures here describe that sample; they are for research and education and are not
              investment advice. Market data can be delayed, incomplete or wrong, and should be verified independently
              before any decision.
            </p>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 max-w-[76ch] space-y-3 text-[14px] leading-[1.7] text-ink-soft">{children}</div>
    </section>
  );
}

function GuideLink({ slug, children }: { slug: string; children: ReactNode }) {
  return (
    <Link href={`/learn/${slug}`} className="text-ink underline decoration-hairline-strong underline-offset-2 hover:decoration-ink">
      {children}
    </Link>
  );
}

function FormulaTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <Panel>
      <PanelHeader title={head[0] === "Indicator" ? "Indicator definitions" : "Formulas"} eyebrow={`Updated ${formatDate(CONTENT_UPDATED)}`} />
      <TableScroll>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              {head.map((cell) => (
                <Th key={cell}>{cell}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <Td key={cellIndex} className="whitespace-normal align-top">
                    {cell}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Panel>
  );
}

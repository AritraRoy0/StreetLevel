import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LivePanel } from "@/components/learn/live-panel";
import { PageShell } from "@/components/shell";
import { Eyebrow, Panel, PanelHeader, TableScroll, Td, Th, buttonClass } from "@/components/ui";
import { GUIDE_CATALOG, guideEntry } from "@/lib/learn/catalog";
import type { GuideEntry } from "@/lib/learn/catalog";
import { GUIDES } from "@/lib/learn/guides";
import type { GuideBody, GuideSection } from "@/lib/learn/guides";
import { COMPOSITE_SYMBOL, SYMBOL_ROWS, SYMBOLS } from "@/lib/market-data";
import { formatDate } from "@/lib/analytics";
import { CONTENT_UPDATED } from "@/lib/site";
import { articleNode, breadcrumbNode, faqNode, graph, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDE_CATALOG.map((guide) => ({ slug: guide.slug }));
}

/** The guide list is closed, so an unknown slug is a real 404 rather than a render. */
export const dynamicParams = false;

const LAST_BAR = SYMBOL_ROWS[0]?.summary.lastBarTimestamp ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = guideEntry(slug);
  if (!entry) return {};
  return pageMetadata({
    title: entry.metaTitle,
    socialTitle: entry.title,
    description: entry.description,
    path: `/learn/${slug}`,
    type: "article",
    publishedTime: CONTENT_UPDATED,
    modifiedTime: CONTENT_UPDATED,
  });
}

function anchor(heading: string) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = guideEntry(slug);
  const body = GUIDES[slug];
  if (!entry || !body) notFound();

  const path = `/learn/${slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Learn", path: "/learn" },
    { name: entry.shortTitle, path },
  ];
  const related = body.related
    .map((item) => guideEntry(item))
    .filter((item): item is GuideEntry => item !== undefined);
  const [firstSection, ...otherSections] = body.sections;

  const contents = [
    ...(body.formula ? [{ id: "formula", label: "Formula" }] : []),
    ...(firstSection ? [{ id: anchor(firstSection.heading), label: firstSection.heading }] : []),
    ...(body.live ? [{ id: "live-data", label: "Live readings" }] : []),
    ...otherSections.map((section) => ({ id: anchor(section.heading), label: section.heading })),
    { id: "faq", label: "Questions" },
  ];

  return (
    <PageShell>
      <JsonLd
        data={graph(
          articleNode({ path, headline: entry.title, description: entry.description, about: entry.shortTitle }),
          breadcrumbNode(path, crumbs),
          faqNode(path, body.faqs),
        )}
      />
      <article>
        <Breadcrumbs crumbs={crumbs} />
        <header className="mb-8 border-b border-hairline-strong pb-6 sm:mb-10">
          <Eyebrow className="mb-2">{entry.category} guide</Eyebrow>
          <h1 className="max-w-3xl text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[36px]">
            {entry.title}
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{body.lede}</p>
          <p className="mt-4 text-[11px] text-muted">
            Updated <time dateTime={CONTENT_UPDATED}>{formatDate(CONTENT_UPDATED)}</time>
            {body.live && LAST_BAR && <> · Live readings to {formatDate(LAST_BAR)}</>}
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-12">
          <div className="min-w-0 space-y-10">
            {body.formula && <Formula id="formula" formula={body.formula} />}
            {firstSection && <Section section={firstSection} />}
            {body.live && (
              <section id="live-data" aria-label="Live readings" className="scroll-mt-24">
                <LivePanel kind={body.live} />
              </section>
            )}
            {otherSections.map((section) => (
              <Section key={section.heading} section={section} />
            ))}
            {body.backtest && <BacktestCallout backtest={body.backtest} />}
            <Faqs faqs={body.faqs} />
          </div>

          <aside className="min-w-0 space-y-6 lg:sticky lg:top-[calc(var(--nav-height)+1.5rem)] lg:self-start">
            <Panel className="hidden lg:block">
              <PanelHeader title="On this page" />
              <ul className="space-y-1.5 px-4 py-3">
                {contents.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="text-[12px] text-ink-soft hover:text-ink hover:underline">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="Related guides" />
              <ul className="divide-y divide-hairline">
                {related.map((guide) => (
                  <li key={guide.slug}>
                    <Link
                      href={`/learn/${guide.slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
                    >
                      {guide.title}
                      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelHeader title="See it on a chart" eyebrow="Open a symbol" />
              <div className="flex flex-wrap gap-1.5 px-4 py-3">
                {[...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => (
                  <Link
                    key={symbol}
                    href={`/analytics/${symbol}`}
                    className="border border-hairline px-2 py-1 font-mono text-[11px] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:bg-sunken hover:text-ink"
                  >
                    {symbol}
                  </Link>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}

function Formula({ id, formula }: { id: string; formula: NonNullable<GuideBody["formula"]> }) {
  return (
    <section id={id} aria-label="Formula" className="scroll-mt-24">
      <Panel>
        <PanelHeader title="Formula" eyebrow="As StreetLevel computes it" />
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-7 text-ink">{formula.lines.join("\n")}</pre>
        <dl className="grid gap-x-6 gap-y-2 border-t border-hairline px-4 py-3 text-[12px] sm:grid-cols-[max-content_1fr]">
          {formula.legend.map((item) => (
            <Fragment key={item.term}>
              <dt className="font-mono text-ink">{item.term}</dt>
              <dd className="text-muted">{item.meaning}</dd>
            </Fragment>
          ))}
        </dl>
      </Panel>
    </section>
  );
}

function Section({ section }: { section: GuideSection }) {
  return (
    <section id={anchor(section.heading)} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{section.heading}</h2>
      <div className="mt-3 max-w-[70ch] space-y-3 text-[14px] leading-[1.7] text-ink-soft">
        {section.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
        {section.bullets && (
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-faint">
            {section.bullets.map((bullet) => (
              <li key={bullet.slice(0, 48)}>{bullet}</li>
            ))}
          </ol>
        )}
      </div>
      {section.table && (
        <TableScroll className="mt-4 max-w-md border border-hairline bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {section.table.head.map((cell, index) => (
                  <Th key={cell} align={index === 0 ? "left" : "right"}>
                    {cell}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <Td key={`${row[0]}-${index}`} align={index === 0 ? "left" : "right"}>
                      {cell}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  );
}

function BacktestCallout({ backtest }: { backtest: NonNullable<GuideBody["backtest"]> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border border-hairline bg-surface px-4 py-4">
      <div className="min-w-0 max-w-xl">
        <Eyebrow>Try it</Eyebrow>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
          Run it over the bundled history with commissions, slippage and next-bar fills modelled, then change the
          parameters and watch what moves.
        </p>
      </div>
      <Link href={`/performance?${backtest.query}`} className={buttonClass({ variant: "primary", size: "md" })}>
        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
        {backtest.label}
      </Link>
    </div>
  );
}

function Faqs({ faqs }: { faqs: GuideBody["faqs"] }) {
  return (
    <section id="faq" className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-ink">Frequently asked questions</h2>
      <dl className="mt-3 divide-y divide-hairline border-y border-hairline">
        {faqs.map((faq) => (
          <div key={faq.question} className="py-4">
            <dt className="text-[14px] font-semibold text-ink">{faq.question}</dt>
            <dd className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-soft">{faq.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

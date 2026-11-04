import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageHeader, PageShell } from "@/components/shell";
import { SectionHeading } from "@/components/ui";
import { GUIDE_CATALOG, GUIDE_CATEGORIES, GUIDE_CATEGORY_BLURB } from "@/lib/learn/catalog";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbNode, graph, pageMetadata, webPageNode } from "@/lib/seo";

const DESCRIPTION =
  "Plain-language guides to technical indicators, risk metrics and backtesting: RSI, MACD, Bollinger Bands, moving averages, volatility, drawdown, Sharpe ratio, beta and more, each with live data.";

export const metadata = pageMetadata({
  title: "Technical Indicators and Risk Metrics Explained",
  socialTitle: "Technical indicators and risk metrics, explained",
  description: DESCRIPTION,
  path: "/learn",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Learn", path: "/learn" },
];

export default function LearnPage() {
  return (
    <PageShell>
      <JsonLd
        data={graph(
          {
            ...webPageNode({
              path: "/learn",
              name: "Technical indicators and risk metrics, explained",
              description: DESCRIPTION,
              type: "CollectionPage",
              breadcrumbId: `${absoluteUrl("/learn")}#breadcrumb`,
            }),
            mainEntity: {
              "@type": "ItemList",
              itemListElement: GUIDE_CATALOG.map((guide, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: guide.title,
                url: absoluteUrl(`/learn/${guide.slug}`),
              })),
            },
          },
          breadcrumbNode("/learn", CRUMBS),
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} />
      <PageHeader
        eyebrow="Learn"
        title="Technical indicators and risk metrics, explained"
        description="Each guide gives the formula exactly as StreetLevel computes it, the edge cases that trip up most implementations, and the measure read live across ten large-cap stocks."
      />

      <div className="space-y-12">
        {GUIDE_CATEGORIES.map((category) => (
          <section key={category} aria-label={category}>
            <SectionHeading title={category} description={GUIDE_CATEGORY_BLURB[category]} />
            <ul className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
              {GUIDE_CATALOG.filter((guide) => guide.category === category).map((guide) => (
                <li key={guide.slug} className="bg-surface">
                  <Link href={`/learn/${guide.slug}`} className="group flex h-full flex-col px-4 py-4 transition-colors hover:bg-sunken">
                    <span className="text-[14px] font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                      {guide.title}
                    </span>
                    <span className="mt-1.5 text-[12px] leading-relaxed text-muted">{guide.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

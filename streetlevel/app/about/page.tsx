import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageHeader, PageShell } from "@/components/shell";
import { buttonClass } from "@/components/ui";
import { COMPOSITE_SYMBOL, DATASET, SYMBOLS } from "@/lib/market-data";
import { COMPARISON_PAIRS } from "@/lib/comparisons";
import { GUIDE_CATALOG } from "@/lib/learn/catalog";
import { formatDate } from "@/lib/analytics";
import { SITE_NAME, SITE_TAGLINE, SOURCE_REPOSITORY, absoluteUrl } from "@/lib/site";
import { breadcrumbNode, graph, organizationNode, pageMetadata, webPageNode } from "@/lib/seo";

const DESCRIPTION = `${SITE_NAME} is a free, open-source market research workspace: stock analytics, technical indicators, head-to-head comparisons and a backtester, with every figure traceable to a stated formula.`;

export const metadata = pageMetadata({
  title: "About",
  socialTitle: `About ${SITE_NAME}`,
  description: DESCRIPTION,
  path: "/about",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

export default function AboutPage() {
  return (
    <PageShell>
      <JsonLd
        data={graph(
          webPageNode({
            path: "/about",
            name: `About ${SITE_NAME}`,
            description: DESCRIPTION,
            type: "AboutPage",
            breadcrumbId: `${absoluteUrl("/about")}#breadcrumb`,
          }),
          organizationNode(),
          breadcrumbNode("/about", CRUMBS),
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} />
      <PageHeader eyebrow="About" title={`${SITE_NAME}: ${SITE_TAGLINE.replace(/\.$/, "").toLowerCase()}`} description={DESCRIPTION} />

      <div className="max-w-[76ch] space-y-10 text-[14px] leading-[1.7] text-ink-soft">
        <Block title="What it is">
          <p>
            {SITE_NAME} turns market noise into a focused view of signals and context. It covers {SYMBOLS.length}{" "}
            large-cap stocks and an equal-weight composite of them, {COMPOSITE_SYMBOL}, with an interactive chart for
            each, {COMPARISON_PAIRS.length} head-to-head comparisons, {GUIDE_CATALOG.length} guides to the measures it
            uses, and a backtester for eight trading rules.
          </p>
          <p>
            Every figure states its window and its sample size, and every formula is published on the{" "}
            <Link href="/methodology" className="text-ink underline underline-offset-2">
              methodology page
            </Link>
            . Where a number cannot be computed honestly, such as an annual growth rate from a month of data, the site
            says so instead of showing it.
          </p>
        </Block>

        <Block title="Who it is for">
          <p>
            Investors, students and researchers who want to see how a measure is built as well as what it reads, and
            anyone who has wondered why two websites quote different betas for the same stock. It is free and needs no
            account.
          </p>
        </Block>

        <Block title="The data">
          <p>
            Prices are a daily download from the {DATASET.source} covering {formatDate(DATASET.from)} to{" "}
            {formatDate(DATASET.to)}, captured on {formatDate(DATASET.downloadedAt)}. Every bar is validated before use
            and the result of that validation is shown on each page. The news headlines are illustrative samples written
            for the demonstration, not real reporting.
          </p>
        </Block>

        <Block title="Open source">
          <p>
            The application, the analytics engine and its test suite are public. Anyone can read exactly how a figure
            was produced, run the tests, or report a mistake.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={SOURCE_REPOSITORY} className={buttonClass({ variant: "primary", size: "md" })} rel="noopener" target="_blank">
              Source on GitHub
            </a>
            <Link href="/methodology" className={buttonClass({ size: "md" })}>
              Methodology
            </Link>
          </div>
        </Block>

        <Block title="Not investment advice">
          <p>
            {SITE_NAME} is a research and education tool. Nothing on it is financial, investment, tax or legal advice.
            Market data can be delayed, incomplete or inaccurate, and the coverage list is a small set of companies that
            exist today, which flatters any backward-looking test. Verify information independently before making any
            financial decision.
          </p>
        </Block>
      </div>
    </PageShell>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

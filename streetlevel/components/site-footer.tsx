/**
 * The site footer, rendered once by the root layout.
 *
 * Besides the provenance line, it is the one place every page links to every
 * section: each covered symbol, the most searched comparisons, the guides and
 * the reference pages. Readers use it to jump sideways, and crawlers use it
 * to reach every page from every other in a single hop.
 *
 * A server component, so these links cost the browser no JavaScript.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { COMPOSITE_SYMBOL, DATASET, SYMBOLS, getProfile } from "@/lib/market-data";
import { POPULAR_PAIRS } from "@/lib/comparisons";
import { GUIDE_CATALOG } from "@/lib/learn/catalog";
import { SITE_NAME, SITE_TAGLINE, SOURCE_REPOSITORY } from "@/lib/site";
import { formatDate } from "@/lib/analytics";

const FEATURED_GUIDES = ["rsi", "macd", "bollinger-bands", "moving-averages", "volatility", "max-drawdown", "sharpe-ratio", "beta"];

export function SiteFooter() {
  const guides = FEATURED_GUIDES.map((slug) => GUIDE_CATALOG.find((guide) => guide.slug === slug)).filter(
    (guide): guide is (typeof GUIDE_CATALOG)[number] => guide !== undefined,
  );

  return (
    <footer className="border-t border-hairline-strong bg-surface">
      <div className="mx-auto w-full max-w-[1560px] px-4 pb-10 pt-10 sm:px-6 lg:px-10">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center gap-2.5 text-ink" aria-label={`${SITE_NAME} home`}>
              <span className="flex h-7 w-7 items-center justify-center bg-ink font-mono text-[11px] font-bold text-surface">
                SL
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              {SITE_TAGLINE} Free stock analytics, technical indicators and backtesting, with every figure traceable to
              a stated formula.
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              For research and education only. Nothing on this site is investment advice.
            </p>
          </div>

          <FooterColumn title="Stocks">
            {[...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => (
              <FooterLink key={symbol} href={`/analytics/${symbol}`}>
                <span className="font-mono text-[11px] font-semibold">{symbol}</span>{" "}
                <span className="text-muted">{getProfile(symbol).shortName}</span>
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Compare">
            {POPULAR_PAIRS.map((pair) => (
              <FooterLink key={pair.slug} href={`/compare/${pair.slug}`}>
                {pair.first} vs {pair.second}
              </FooterLink>
            ))}
            <FooterLink href="/compare" strong>
              All comparisons
            </FooterLink>
          </FooterColumn>

          <FooterColumn title="Learn">
            {guides.map((guide) => (
              <FooterLink key={guide.slug} href={`/learn/${guide.slug}`}>
                {guide.shortTitle}
              </FooterLink>
            ))}
            <FooterLink href="/learn" strong>
              All guides
            </FooterLink>
          </FooterColumn>

          <FooterColumn title={SITE_NAME}>
            <FooterLink href="/">Market overview</FooterLink>
            <FooterLink href="/performance">Backtester</FooterLink>
            <FooterLink href="/performance?view=cross">Relative strength</FooterLink>
            <FooterLink href="/methodology">Methodology</FooterLink>
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href={SOURCE_REPOSITORY} external>
              Source on GitHub
            </FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-hairline pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{SITE_NAME} / market research</span>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>{DATASET.source}</span>
            <span>Snapshot {formatDate(DATASET.downloadedAt)}</span>
            <span>Demonstration data, not investment advice</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <ul className="space-y-1.5">{children}</ul>
    </nav>
  );
}

function FooterLink({
  href,
  children,
  strong = false,
  external = false,
}: {
  href: string;
  children: ReactNode;
  strong?: boolean;
  external?: boolean;
}) {
  const className = `text-[12px] transition-colors hover:text-ink hover:underline underline-offset-2 ${strong ? "font-semibold text-ink" : "text-ink-soft"}`;
  return (
    <li>
      {external ? (
        <a href={href} className={className} rel="noopener" target="_blank">
          {children}
        </a>
      ) : (
        <Link href={href} className={className}>
          {children}
        </Link>
      )}
    </li>
  );
}

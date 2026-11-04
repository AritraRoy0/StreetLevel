import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { PageHeader, PageShell } from "@/components/shell";
import { Panel, PanelHeader, PanelNote, SectionHeading, TableScroll, Th } from "@/components/ui";
import { COMPARISON_ORDER, COMPARISON_PAIRS, pairsWith } from "@/lib/comparisons";
import { canonicalPair } from "@/lib/compare-pairs";
import { SNAPSHOTS, getProfile } from "@/lib/market-data";
import { formatDate, formatPercent } from "@/lib/analytics";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbNode, graph, pageMetadata, webPageNode } from "@/lib/seo";
import { cn } from "@/lib/utils";

const DESCRIPTION = `Compare ${COMPARISON_ORDER.length} large-cap stocks head to head, ${COMPARISON_PAIRS.length} pairs in all: one-year returns, volatility, drawdown, Sharpe ratio, correlation and beta, side by side with a rebased chart.`;

export const metadata = pageMetadata({
  title: "Compare Stocks Head to Head: Returns, Risk and Correlation",
  socialTitle: "Compare stocks head to head",
  description: DESCRIPTION,
  path: "/compare",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Compare", path: "/compare" },
];

export default function ComparePage() {
  const asOf = SNAPSHOTS[COMPARISON_ORDER[0]]?.lastBarTimestamp ?? null;
  const returns = Object.fromEntries(COMPARISON_ORDER.map((symbol) => [symbol, SNAPSHOTS[symbol]?.periodReturn ?? null]));
  const scale = Math.max(
    0.0001,
    ...COMPARISON_PAIRS.map((pair) => Math.abs((returns[pair.first] ?? 0) - (returns[pair.second] ?? 0))),
  );

  return (
    <PageShell>
      <JsonLd
        data={graph(
          {
            ...webPageNode({
              path: "/compare",
              name: "Compare stocks head to head",
              description: DESCRIPTION,
              type: "CollectionPage",
              breadcrumbId: `${absoluteUrl("/compare")}#breadcrumb`,
            }),
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: COMPARISON_PAIRS.length,
              itemListElement: COMPARISON_PAIRS.map((pair, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${pair.first} vs ${pair.second}`,
                url: absoluteUrl(`/compare/${pair.slug}`),
              })),
            },
          },
          breadcrumbNode("/compare", CRUMBS),
        )}
      />
      <Breadcrumbs crumbs={CRUMBS} />
      <PageHeader
        eyebrow="Head to head"
        title="Compare stocks head to head"
        description={`Every pairing of the ${COMPARISON_ORDER.length} covered stocks, measured over the same trailing year: returns, volatility, drawdown and risk-adjusted return side by side, with correlation and beta between the two.`}
      />

      <Panel className="mb-10">
        <PanelHeader title="One-year return gap" eyebrow={`Row minus column · trailing year to ${formatDate(asOf)}`} />
        <TableScroll>
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">
              Difference in one-year return between each pair of covered stocks. Each cell links to that comparison.
            </caption>
            <thead>
              <tr>
                <Th />
                {COMPARISON_ORDER.map((symbol) => (
                  <Th key={symbol} align="right">
                    {symbol}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ORDER.map((row) => (
                <tr key={row}>
                  <th scope="row" className="border-b border-hairline px-3 py-2 text-left">
                    <Link href={`/analytics/${row}`} className="font-mono text-[12px] font-semibold text-ink hover:underline">
                      {row}
                    </Link>
                  </th>
                  {COMPARISON_ORDER.map((column) => {
                    if (row === column) {
                      return (
                        <td key={column} className="border-b border-hairline bg-sunken px-3 py-2 text-right text-[12px] text-faint">
                          —
                        </td>
                      );
                    }
                    const pair = canonicalPair(row, column, COMPARISON_ORDER);
                    const gap =
                      returns[row] === null || returns[column] === null ? null : (returns[row] as number) - (returns[column] as number);
                    const strength = gap === null ? 0 : Math.round((Math.abs(gap) / scale) * 36);
                    const colour = (gap ?? 0) >= 0 ? "var(--color-pos)" : "var(--color-neg)";
                    return (
                      <td
                        key={column}
                        className="border-b border-hairline p-0 text-right"
                        style={{ background: strength > 0 ? `color-mix(in srgb, ${colour} ${strength}%, transparent)` : undefined }}
                      >
                        {pair && (
                          <Link
                            href={`/compare/${pair.slug}`}
                            aria-label={`${row} vs ${column}`}
                            className={cn(
                              "block px-3 py-2 font-mono text-[12px] tabular-nums transition-colors hover:bg-ink/5 hover:underline",
                              (gap ?? 0) >= 0 ? "text-pos" : "text-neg",
                            )}
                          >
                            {formatPercent(gap, { signed: true, digits: 0 })}
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        <PanelNote>
          Each cell is the row stock&apos;s one-year return minus the column stock&apos;s, and opens the full comparison.
          Stocks are ordered by market capitalisation.
        </PanelNote>
      </Panel>

      <SectionHeading title="All comparisons" description="Grouped by the larger company in each pair." />
      <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
        {COMPARISON_ORDER.map((symbol) => {
          const pairs = pairsWith(symbol).filter((pair) => pair.first === symbol);
          if (pairs.length === 0) return null;
          return (
            <section key={symbol} aria-label={`${symbol} comparisons`} className="bg-surface px-4 py-4">
              <h3 className="text-[12px] font-semibold text-ink">
                <span className="font-mono">{symbol}</span>{" "}
                <span className="font-normal text-muted">{getProfile(symbol).name}</span>
              </h3>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {pairs.map((pair) => (
                  <li key={pair.slug}>
                    <Link
                      href={`/compare/${pair.slug}`}
                      className="inline-block border border-hairline px-2 py-1 font-mono text-[11px] font-semibold text-ink-soft transition-colors hover:border-hairline-strong hover:bg-sunken hover:text-ink"
                    >
                      {pair.first} vs {pair.second}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}

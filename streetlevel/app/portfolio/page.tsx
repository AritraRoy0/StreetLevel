import { Footer, PageHeader, PageShell, StatusStrip, TopNav } from "@/components/shell";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { Badge } from "@/components/ui";
import { DATA_QUALITY, DATASET, SYMBOLS, sparklineFor } from "@/lib/market-data";
import { getPortfolio } from "@/lib/portfolio-service";
import { formatPercent } from "@/lib/analytics";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  const portfolio = getPortfolio();
  const quality = DATA_QUALITY[SYMBOLS[0]];

  const sparklines = Object.fromEntries(
    portfolio.positions.map((position) => [position.symbol, sparklineFor(position.symbol, 60)]),
  );

  return (
    <>
      <TopNav />
      <StatusStrip
        asOf={quality?.lastBar ?? null}
        source={DATASET.source}
        stale={quality?.stale}
        note={`${portfolio.positions.length} holdings`}
      />
      <PageShell>
        <PageHeader
          eyebrow="Attribution"
          title="Portfolio"
          description="Position and portfolio analytics replayed from a transaction log, so cost basis, realized profit, cash and external flows are all derived rather than assumed."
          actions={
            <Badge tone={(portfolio.timeWeightedReturn ?? 0) >= 0 ? "positive" : "negative"}>
              {formatPercent(portfolio.timeWeightedReturn, { signed: true })} time-weighted
            </Badge>
          }
        />
        <PortfolioView portfolio={portfolio} sparklines={sparklines} />
        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

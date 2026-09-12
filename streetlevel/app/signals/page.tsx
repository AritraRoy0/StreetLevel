import Link from "next/link";
import { Footer, PageHeader, PageShell, StatusStrip, TopNav } from "@/components/shell";
import { Badge, Delta, Panel, PanelHeader, TableScroll, Td, Th } from "@/components/ui";
import { Sparkline } from "@/components/charts/sparkline";
import { DATA_QUALITY, DATASET, SYMBOL_ROWS, SYMBOLS } from "@/lib/market-data";
import { EMPTY, formatDate, formatPercent, formatPoints, formatPrice } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";
import type { Tone } from "@/components/ui";

export const metadata = { title: "Signals" };

interface Signal {
  symbol: string;
  name: string;
  rule: string;
  detail: string;
  tone: Tone;
  timestamp: string | null;
}

/**
 * Signals are derived from the same summaries the analytics pages render, so a
 * name cannot appear here as overbought while its own page says otherwise.
 * Each rule states the threshold it fired on rather than asserting a verdict.
 */
function signalsFor(symbol: string, name: string, summary: AnalyticsSummary): Signal[] {
  const found: Signal[] = [];
  const asOf = summary.lastBarTimestamp;

  if (summary.rsi.value !== null && summary.rsi.value >= 70) {
    found.push({
      symbol,
      name,
      rule: "RSI above 70",
      detail: `14-period RSI at ${formatPoints(summary.rsi.value)}, in the conventional overbought band.`,
      tone: "negative",
      timestamp: asOf,
    });
  }
  if (summary.rsi.value !== null && summary.rsi.value <= 30) {
    found.push({
      symbol,
      name,
      rule: "RSI below 30",
      detail: `14-period RSI at ${formatPoints(summary.rsi.value)}, in the conventional oversold band.`,
      tone: "accent",
      timestamp: asOf,
    });
  }
  if (summary.cross) {
    found.push({
      symbol,
      name,
      rule: summary.cross.kind === "golden" ? "Golden cross" : "Death cross",
      detail: `The 50-period average crossed ${summary.cross.kind === "golden" ? "above" : "below"} the 200-period average ${summary.cross.barsAgo} bars ago.`,
      tone: summary.cross.kind === "golden" ? "positive" : "negative",
      timestamp: summary.cross.timestamp,
    });
  }
  if (summary.bollingerSummary.position === "upper") {
    found.push({
      symbol,
      name,
      rule: "Above upper band",
      detail: `Close is outside the 20-period Bollinger band, %B at ${formatPercent(summary.bollingerSummary.percentB, { digits: 0 })}.`,
      tone: "warning",
      timestamp: asOf,
    });
  }
  if (summary.bollingerSummary.position === "lower") {
    found.push({
      symbol,
      name,
      rule: "Below lower band",
      detail: `Close is outside the 20-period Bollinger band, %B at ${formatPercent(summary.bollingerSummary.percentB, { digits: 0 })}.`,
      tone: "warning",
      timestamp: asOf,
    });
  }
  if (summary.volume.latestVsAverage !== null && summary.volume.latestVsAverage > 1) {
    found.push({
      symbol,
      name,
      rule: "Volume spike",
      detail: `Latest session traded ${formatPercent(summary.volume.latestVsAverage, { signed: true })} against the prior 20-session average.`,
      tone: "warning",
      timestamp: asOf,
    });
  }
  if (summary.drawdown.currentDrawdown !== null && summary.drawdown.currentDrawdown <= -0.2) {
    found.push({
      symbol,
      name,
      rule: "Deep drawdown",
      detail: `Trading ${formatPercent(summary.drawdown.currentDrawdown)} below its highest close of the past year.`,
      tone: "negative",
      timestamp: asOf,
    });
  }
  return found;
}

export default function SignalsPage() {
  const quality = DATA_QUALITY[SYMBOLS[0]];
  const signals = SYMBOL_ROWS.flatMap((row) => signalsFor(row.symbol, row.profile.name, row.summary));

  const byRule = new Map<string, number>();
  for (const signal of signals) byRule.set(signal.rule, (byRule.get(signal.rule) ?? 0) + 1);

  return (
    <>
      <TopNav />
      <StatusStrip
        asOf={quality?.lastBar ?? null}
        source={DATASET.source}
        stale={quality?.stale}
        note={`${signals.length} conditions met`}
      />
      <PageShell>
        <PageHeader
          eyebrow="Rules over the trailing year"
          title="Signals"
          description="Every condition below is evaluated from the same validated series the analytics pages use. A signal reports the threshold it crossed; it is not a recommendation."
        />

        <div className="mb-8 flex flex-wrap gap-2">
          {Array.from(byRule.entries()).map(([rule, count]) => (
            <Badge key={rule}>
              {rule} · {count}
            </Badge>
          ))}
          {byRule.size === 0 && <Badge>No conditions currently met</Badge>}
        </div>

        <Panel>
          <PanelHeader title="Active conditions" eyebrow={`${signals.length} across ${SYMBOL_ROWS.length} names`} />
          {signals.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted">
              Nothing is currently triggering. Conditions are re-evaluated whenever the dataset updates.
            </p>
          ) : (
            <TableScroll>
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr>
                    <Th>Symbol</Th>
                    <Th>Rule</Th>
                    <Th>Detail</Th>
                    <Th align="right">As of</Th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal, index) => (
                    <tr key={`${signal.symbol}-${signal.rule}-${index}`} className="hover:bg-sunken">
                      <Td>
                        <Link href={`/analytics/${signal.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                          {signal.symbol}
                        </Link>
                        <span className="mt-0.5 block max-w-[160px] truncate text-[11px] text-muted">{signal.name}</span>
                      </Td>
                      <Td>
                        <Badge tone={signal.tone}>{signal.rule}</Badge>
                      </Td>
                      <Td className="max-w-[420px] whitespace-normal text-[12px] leading-relaxed">{signal.detail}</Td>
                      <Td align="right">{formatDate(signal.timestamp)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <section className="mt-10">
          <Panel>
            <PanelHeader title="Screen" eyebrow="Every covered name, ranked by momentum" />
            <TableScroll>
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    <Th>Symbol</Th>
                    <Th align="right">Last</Th>
                    <Th align="right">RSI</Th>
                    <Th align="right">%B</Th>
                    <Th align="right">Price vs SMA 50</Th>
                    <Th align="right">Drawdown</Th>
                    <Th align="right" className="hidden lg:table-cell">
                      Trend
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {[...SYMBOL_ROWS]
                    .sort((a, b) => (b.summary.rsi.value ?? 0) - (a.summary.rsi.value ?? 0))
                    .map((row) => {
                      const sma50 = row.summary.movingAverages.find((average) => average.label === "SMA 50");
                      return (
                        <tr key={row.symbol} className="hover:bg-sunken">
                          <Td>
                            <Link href={`/analytics/${row.symbol}`} className="font-mono text-[12px] font-semibold text-ink">
                              {row.symbol}
                            </Link>
                          </Td>
                          <Td align="right">{formatPrice(row.summary.lastPrice)}</Td>
                          <Td align="right">
                            {row.summary.rsi.value === null ? EMPTY : formatPoints(row.summary.rsi.value)}
                          </Td>
                          <Td align="right">
                            {row.summary.bollingerSummary.percentB === null
                              ? EMPTY
                              : formatPercent(row.summary.bollingerSummary.percentB, { digits: 0 })}
                          </Td>
                          <Td align="right">
                            <Delta value={sma50?.priceVsMa ?? null} />
                          </Td>
                          <Td align="right">
                            <Delta value={row.summary.drawdown.currentDrawdown} showSign={false} />
                          </Td>
                          <Td align="right" className="hidden lg:table-cell">
                            <div className="flex justify-end">
                              <Sparkline values={row.summary.bars.slice(-60).map((bar) => bar.adjClose)} width={72} height={22} />
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </TableScroll>
          </Panel>
        </section>

        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

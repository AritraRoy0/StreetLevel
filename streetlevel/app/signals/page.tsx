import { Footer, PageHeader, PageShell, StatusStrip } from "@/components/shell";
import { SignalBoard, type ScreenRow, type SignalItem } from "@/components/signals/signal-board";
import { DATA_QUALITY, DATASET, SYMBOL_ROWS, SYMBOLS } from "@/lib/market-data";
import { formatPercent, formatPoints } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

export const metadata = { title: "Signals" };

/**
 * Signals are derived from the same summaries the analytics pages render, so a
 * name cannot appear here as overbought while its own page says otherwise.
 * Each rule states the threshold it fired on rather than asserting a verdict.
 */
function signalsFor(symbol: string, name: string, summary: AnalyticsSummary): SignalItem[] {
  const found: SignalItem[] = [];
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
      // The drawdown is negative; "below" already carries the sign.
      detail: `Trading ${formatPercent(Math.abs(summary.drawdown.currentDrawdown))} below its highest close of the past year.`,
      tone: "negative",
      timestamp: asOf,
    });
  }
  return found;
}

export default function SignalsPage() {
  const quality = DATA_QUALITY[SYMBOLS[0]];
  const signals = SYMBOL_ROWS.flatMap((row) => signalsFor(row.symbol, row.profile.name, row.summary));

  const screen: ScreenRow[] = SYMBOL_ROWS.map((row) => ({
    symbol: row.symbol,
    name: row.profile.name,
    last: row.summary.lastPrice,
    rsi: row.summary.rsi.value,
    percentB: row.summary.bollingerSummary.percentB,
    vsSma50: row.summary.movingAverages.find((average) => average.label === "SMA 50")?.priceVsMa ?? null,
    drawdown: row.summary.drawdown.currentDrawdown,
    spark: row.summary.bars.slice(-60).map((bar) => Number(bar.adjClose.toFixed(2))),
  }));

  return (
    <>
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

        <SignalBoard signals={signals} screen={screen} universe={SYMBOL_ROWS.length} />

        <Footer source={DATASET.source} downloadedAt={DATASET.downloadedAt} />
      </PageShell>
    </>
  );
}

"use client";

/**
 * Latest readings for the indicators the chart can display.
 *
 * Each row states the reading and what it means in one clause. An RSI of 71
 * with no interpretation is a number; an RSI of 71 labelled "overbought" is a
 * finding, and the reader can disagree with it.
 */

import { Badge, Eyebrow, Panel, PanelHeader } from "@/components/ui";
import { EMPTY, formatPercent, formatPoints, formatPrice, formatRatio, formatVolume } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";
import type { Tone } from "@/components/ui";
import { cn } from "@/lib/utils";

function Row({
  label,
  value,
  detail,
  badge,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  badge?: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{detail}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-mono text-[15px] font-medium tabular-nums text-ink">{value}</span>
        {badge && <Badge tone={tone}>{badge}</Badge>}
      </div>
    </div>
  );
}

export function IndicatorSummary({ summary, className }: { summary: AnalyticsSummary; className?: string }) {
  const { rsi, macdSummary, bollingerSummary, atr, volume } = summary;

  const rsiTone: Tone =
    rsi.zone === "overbought" ? "negative" : rsi.zone === "oversold" ? "accent" : "neutral";

  const bollingerLabel =
    bollingerSummary.position === "upper"
      ? "Above upper band"
      : bollingerSummary.position === "lower"
        ? "Below lower band"
        : bollingerSummary.percentB === null
          ? undefined
          : "Inside bands";

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader title="Indicator readings" eyebrow="Latest bar in window" />
      <div className="divide-y divide-hairline">
        <Row
          label="RSI 14"
          value={rsi.value === null ? EMPTY : formatPoints(rsi.value)}
          detail={
            rsi.insufficientHistory
              ? `Needs 15 bars; the window has ${rsi.available}.`
              : "Wilder's smoothing. Above 70 is conventionally overbought, below 30 oversold."
          }
          badge={rsi.zone ?? undefined}
          tone={rsiTone}
        />
        <Row
          label="MACD 12 / 26 / 9"
          value={macdSummary.value === null ? EMPTY : formatRatio(macdSummary.value)}
          detail={
            macdSummary.signal === null
              ? "Needs 34 bars before the signal line begins."
              : `Signal ${formatRatio(macdSummary.signal)}, histogram ${formatRatio(macdSummary.histogram)}.`
          }
          badge={macdSummary.trend ?? undefined}
          tone={macdSummary.trend === "bullish" ? "positive" : macdSummary.trend === "bearish" ? "negative" : "neutral"}
        />
        <Row
          label="Bollinger 20 / 2"
          value={bollingerSummary.percentB === null ? EMPTY : formatPercent(bollingerSummary.percentB, { digits: 0 })}
          detail={
            bollingerSummary.middle === null
              ? "Needs 20 bars."
              : `Bands at ${formatPrice(bollingerSummary.lower)} and ${formatPrice(bollingerSummary.upper)}, centred on ${formatPrice(bollingerSummary.middle)}.`
          }
          badge={bollingerLabel}
          tone={bollingerSummary.position === "upper" ? "negative" : bollingerSummary.position === "lower" ? "accent" : "neutral"}
        />
        <Row
          label="ATR 14"
          value={atr.value === null ? EMPTY : formatPrice(atr.value)}
          detail="Average true range, which counts overnight gaps as well as the intraday span."
          badge={atr.percentOfPrice === null ? undefined : `${formatPercent(atr.percentOfPrice)} of price`}
        />
        <Row
          label="Relative volume"
          value={volume.latestVsAverage === null ? EMPTY : formatPercent(volume.latestVsAverage, { signed: true })}
          detail={`Latest session ${formatVolume(volume.latest)} against the prior 20-session average, which excludes the latest bar.`}
          badge={
            volume.latestVsAverage === null
              ? undefined
              : volume.latestVsAverage > 0.5
                ? "Elevated"
                : volume.latestVsAverage < -0.4
                  ? "Light"
                  : "Normal"
          }
          tone={volume.latestVsAverage !== null && volume.latestVsAverage > 0.5 ? "warning" : "neutral"}
        />
      </div>
    </Panel>
  );
}

/** Risk statistics that sit alongside the indicator readings. */
export function RiskSummary({ summary, className }: { summary: AnalyticsSummary; className?: string }) {
  const { drawdown, volatility, sharpe, sortino, calmar, cagr } = summary;

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader title="Risk" eyebrow="Selected window" />
      <div className="divide-y divide-hairline">
        <Row
          label="Annualized volatility"
          value={formatPercent(volatility.annualized)}
          detail={
            volatility.observations === 0
              ? "Needs at least two returns."
              : `Sample deviation of ${volatility.observations} returns, scaled by the square root of the periods in a year.`
          }
          badge={volatility.sufficient ? undefined : "Indicative"}
          tone="warning"
        />
        <Row
          label="Max drawdown"
          value={formatPercent(drawdown.maxDrawdown)}
          detail={
            drawdown.peakTimestamp === null
              ? "The price made a new high on every session in this window."
              : `Peak to trough over ${drawdown.drawdownDays === null ? EMPTY : Math.round(drawdown.drawdownDays)} days${
                  drawdown.recoveryTimestamp
                    ? `, recovered after ${Math.round(drawdown.recoveryDays ?? 0)} more`
                    : ", not yet recovered"
                }.`
          }
          badge={drawdown.recoveryTimestamp ? "Recovered" : drawdown.maxDrawdown === 0 ? undefined : "Open"}
          tone={drawdown.recoveryTimestamp ? "positive" : "warning"}
        />
        <Row
          label="Current drawdown"
          value={formatPercent(drawdown.currentDrawdown)}
          detail="Distance below the highest close reached inside this window."
        />
        <Row
          label="CAGR"
          value={formatPercent(cagr.value)}
          detail={
            cagr.insufficientHistory
              ? "Withheld: annualizing a window under eleven months produces a figure that is arithmetically correct and analytically meaningless."
              : `Compounded over ${cagr.days === null ? EMPTY : Math.round(cagr.days)} calendar days.`
          }
        />
        <Row
          label="Sharpe / Sortino"
          value={`${formatRatio(sharpe)} / ${formatRatio(sortino)}`}
          detail="Excess return per unit of total risk, then per unit of downside risk. A risk-free rate of zero is assumed."
        />
        <Row
          label="Calmar"
          value={formatRatio(calmar)}
          detail="Annualized return divided by the magnitude of the worst drawdown."
        />
      </div>
    </Panel>
  );
}

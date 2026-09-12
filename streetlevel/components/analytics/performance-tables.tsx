"use client";

/**
 * Period performance and moving-average tables.
 *
 * Both are built to make the sample size visible. A win rate over four weeks
 * and a win rate over four years look identical unless the count is shown next
 * to them, so the count is shown next to them.
 */

import { Panel, PanelHeader, Td, Th, TableScroll, Delta, Badge } from "@/components/ui";
import {
  EMPTY,
  formatDate,
  formatPercent,
  formatPrice,
} from "@/lib/analytics";
import type { AnalyticsSummary, PeriodReturn, ReturnDistribution } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function DistributionRow({
  label,
  stats,
  periods,
}: {
  label: string;
  stats: ReturnDistribution;
  periods: PeriodReturn[];
}) {
  return (
    <tr>
      <Td>
        <span className="font-semibold text-ink">{label}</span>
        <span className="ml-2 text-[11px] text-faint">{periods.length}</span>
      </Td>
      <Td align="right">
        <Delta value={stats.average} />
      </Td>
      <Td align="right">
        {stats.best ? (
          <span title={formatDate(stats.best.timestamp)}>
            <Delta value={stats.best.value} />
          </span>
        ) : (
          EMPTY
        )}
      </Td>
      <Td align="right">
        {stats.worst ? (
          <span title={formatDate(stats.worst.timestamp)}>
            <Delta value={stats.worst.value} />
          </span>
        ) : (
          EMPTY
        )}
      </Td>
      <Td align="right">{stats.hitRate === null ? EMPTY : formatPercent(stats.hitRate, { digits: 0 })}</Td>
      <Td align="right" className="hidden sm:table-cell">
        <span className="text-pos">{stats.positive}</span>
        <span className="text-faint"> / </span>
        <span className="text-neg">{stats.negative}</span>
      </Td>
    </tr>
  );
}

export function PeriodPerformance({ summary, className }: { summary: AnalyticsSummary; className?: string }) {
  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Period returns"
        eyebrow="Distribution"
        actions={
          <span className="text-[10px] uppercase tracking-wider text-faint">
            Close to close, adjusted
          </span>
        }
      />
      <TableScroll>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <Th>Frequency / n</Th>
              <Th align="right">Average</Th>
              <Th align="right">Best</Th>
              <Th align="right">Worst</Th>
              <Th align="right">Win rate</Th>
              <Th align="right" className="hidden sm:table-cell">
                Up / down
              </Th>
            </tr>
          </thead>
          <tbody>
            <DistributionRow label="Daily" stats={summary.dailyStats} periods={summary.daily} />
            <DistributionRow label="Weekly" stats={summary.weeklyStats} periods={summary.weekly} />
            <DistributionRow label="Monthly" stats={summary.monthlyStats} periods={summary.monthly} />
          </tbody>
        </table>
      </TableScroll>
      <p className="border-t border-hairline px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        Weekly and monthly returns are measured from the previous period&apos;s final session, so no part of a
        move is lost at the boundary. The first bucket has no predecessor and is excluded.
      </p>
    </Panel>
  );
}

export function MovingAverageTable({ summary, className }: { summary: AnalyticsSummary; className?: string }) {
  const cross = summary.cross;

  return (
    <Panel className={cn("min-w-0", className)}>
      <PanelHeader
        title="Trend"
        eyebrow="Price against moving averages"
        actions={
          cross ? (
            <Badge tone={cross.kind === "golden" ? "positive" : "negative"}>
              {cross.kind === "golden" ? "Golden cross" : "Death cross"} · {cross.barsAgo}b
            </Badge>
          ) : undefined
        }
      />
      <TableScroll>
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              <Th>Average</Th>
              <Th align="right">Value</Th>
              <Th align="right">Price vs</Th>
              <Th align="right">Position</Th>
            </tr>
          </thead>
          <tbody>
            {summary.movingAverages.map((average) => (
              <tr key={average.label}>
                <Td>
                  <span className="font-semibold text-ink">{average.label}</span>
                </Td>
                <Td align="right">{formatPrice(average.value)}</Td>
                <Td align="right">
                  <Delta value={average.priceVsMa} />
                </Td>
                <Td align="right">
                  {average.value === null ? (
                    <span
                      className="text-[11px] text-faint"
                      title={`Needs ${average.required} bars, window has ${average.available}`}
                    >
                      {average.available} / {average.required} bars
                    </span>
                  ) : (
                    <span className={average.above ? "text-pos" : "text-neg"}>
                      {average.above ? "Above" : "Below"}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {cross && (
        <p className="border-t border-hairline px-4 py-2.5 text-[11px] text-muted">
          The 50-period average crossed {cross.kind === "golden" ? "above" : "below"} the 200-period average on{" "}
          {formatDate(cross.timestamp)}.
        </p>
      )}
    </Panel>
  );
}

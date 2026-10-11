/**
 * The data-quality banner.
 *
 * It renders only when something is actually wrong with the series: bars
 * rejected in validation, duplicate timestamps, missing weekday sessions, or a
 * feed that has stopped updating. Silence here is the normal state and means
 * the data checked out.
 *
 * The headline and the most important warning stay visible; the full list
 * folds away. With a fixed snapshot the staleness warning is permanent, and a
 * five-line block above every page's content is the kind of banner that stops
 * being read. One line that states the condition, with the particulars a click
 * away, keeps it honest without making it furniture.
 */

import { Notice } from "@/components/ui";
import { formatDate } from "@/lib/analytics";
import type { DataQuality } from "@/lib/analytics";

export function DataQualityNotice({
  quality,
  className,
}: {
  quality: DataQuality | undefined;
  className?: string;
}) {
  if (!quality || quality.warnings.length === 0) return null;

  const tone = quality.pointCount === 0 ? "negative" : quality.stale ? "warning" : "neutral";
  const title =
    quality.pointCount === 0
      ? "No usable price history"
      : quality.stale
        ? "Market data is behind"
        : "Data quality notes";

  // Lead with the staleness line when there is one, since it is the one that
  // changes how every figure on the page should be read.
  const headline =
    quality.warnings.find((warning) => /old|behind|stale/i.test(warning)) ?? quality.warnings[0];

  return (
    <Notice tone={tone} title={title} summary={headline} className={className}>
      <ul className="space-y-0.5">
        {quality.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      {quality.lastBar && (
        <p className="mt-1.5 text-[11px] text-faint">
          Newest bar {formatDate(quality.lastBar)} · {quality.pointCount} sessions validated
          {quality.rejected > 0 ? ` · ${quality.rejected} rejected` : ""}
        </p>
      )}
    </Notice>
  );
}

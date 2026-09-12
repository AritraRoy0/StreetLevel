/**
 * The data-quality banner.
 *
 * It renders only when something is actually wrong with the series: bars
 * rejected in validation, duplicate timestamps, missing weekday sessions, or a
 * feed that has stopped updating. A banner that is always on stops being read,
 * so silence here is the normal state and means the data checked out.
 */

import { Callout } from "@/components/ui";
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

  return (
    <Callout tone={tone} title={title} className={className}>
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
    </Callout>
  );
}

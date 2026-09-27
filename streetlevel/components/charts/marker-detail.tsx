"use client";

/**
 * The detail strip for a selected chart marker: a news event on the analytics
 * chart, or a trade entry or exit on the backtest chart. Both pages open the
 * same strip under their chart, so it lives beside the chart it annotates.
 */

import { X } from "lucide-react";
import { Eyebrow } from "@/components/ui";
import { formatDate } from "@/lib/analytics";
import type { ChartMarker } from "./price-chart";

export function MarkerDetail({ marker, onClose }: { marker: ChartMarker; onClose: () => void }) {
  return (
    <div className="sl-enter border-t border-hairline bg-sunken px-4 py-3" role="status">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>
            {formatDate(marker.timestamp)} · {marker.title}
          </Eyebrow>
          <ul className="mt-1.5 space-y-1">
            {(marker.lines ?? [marker.title]).map((line) => (
              <li key={line} className="text-[12px] leading-snug text-ink-soft">
                {line}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="-m-1 shrink-0 p-1 text-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

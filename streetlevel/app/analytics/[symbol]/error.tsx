"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Callout } from "@/components/ui";

/**
 * Error boundary for the analytics route.
 *
 * It offers the two recoveries that actually work here: retry the render, or
 * go back to a page that is known to be intact. The digest is shown because it
 * is the only handle a user has when reporting the failure; the underlying
 * message is not, since it can carry internals.
 */
export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[analytics] render failed", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-24">
      <Callout tone="negative" title="This symbol's analytics could not be built">
        <p>
          The price history failed to load or did not pass validation, so no figures are shown rather than figures
          that might be wrong.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-faint">Reference {error.digest}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="bg-ink px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface hover:bg-ink-soft"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-hairline-strong px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink hover:bg-sunken"
          >
            Back to overview
          </Link>
        </div>
      </Callout>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, Callout, buttonClass } from "@/components/ui";

/**
 * Error boundary for the analytics route.
 *
 * It offers the two recoveries that actually work here: retry the render, or
 * go back to a page that is known to be intact. The digest is shown because it
 * is the only handle a user has when reporting the failure; the underlying
 * message is not, since it can carry internals.
 *
 * The navigation comes from the root layout, so the reader can also leave for
 * any other section or search for a different symbol from here.
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
    <main id="content" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 py-16 outline-none sm:py-24">
      <Callout tone="negative" title="This symbol's analytics could not be built">
        <p>
          The price history failed to load or did not pass validation, so no figures are shown rather than figures
          that might be wrong.
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-faint">Reference {error.digest}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Link href="/" className={buttonClass()}>
            Back to overview
          </Link>
        </div>
      </Callout>
    </main>
  );
}

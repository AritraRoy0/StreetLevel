"use client";

/**
 * The page frame: status strip, content column, page header and footer.
 *
 * The primary navigation is not here. It is rendered once by the root layout,
 * so it survives loading, error and not-found states without every page
 * remembering to include it.
 */

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { formatDate } from "@/lib/analytics";

/**
 * The status strip under the navigation.
 *
 * It states, in one line, what the data behind the page is and how old it is.
 * On a phone it keeps only the state and the date of the last bar; the source
 * and the clock return from `sm` up, rather than wrapping the strip onto three
 * lines above every page.
 *
 * The clock is rendered only after mount: a server-rendered time would not
 * match the browser's, and React would report a hydration mismatch.
 */
export function StatusStrip({
  asOf,
  source,
  stale,
  note,
}: {
  asOf: string | null;
  source: string;
  stale?: boolean;
  note?: string;
}) {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setNow(format.format(new Date()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="border-b border-hairline bg-surface">
      <div className="mx-auto flex h-9 max-w-[1560px] items-center justify-between gap-x-6 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("sl-live-dot h-1.5 w-1.5 shrink-0 rounded-full", stale ? "bg-warn" : "bg-accent")}
          />
          <Eyebrow className={cn("shrink-0", stale ? "text-warn" : "text-accent")}>
            {stale ? "Delayed data" : "Up to date"}
          </Eyebrow>
          {note && <span className="hidden truncate text-[11px] text-muted sm:inline">· {note}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-x-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="hidden md:inline">{source}</span>
          <span>
            <span className="hidden sm:inline">Last bar </span>
            {formatDate(asOf)}
          </span>
          <span className="hidden min-w-[88px] text-right font-mono tabular-nums tracking-normal sm:inline">
            {now ? `${now} UTC` : " "}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      id="content"
      tabIndex={-1}
      className={cn("mx-auto w-full max-w-[1560px] px-4 pb-16 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-10", className)}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-5 gap-y-4 border-b border-hairline-strong pb-5 sm:mb-8">
      <div className="min-w-0">
        <Eyebrow className="mb-2">{eyebrow}</Eyebrow>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Footer({ source, downloadedAt }: { source: string; downloadedAt: string }) {
  return (
    <footer className="mt-16 border-t border-hairline-strong pt-6 sm:mt-20">
      <div className="flex flex-col gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>StreetLevel / market research</span>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>{source}</span>
          <span>Snapshot {formatDate(downloadedAt)}</span>
          <span>Demonstration data, not investment advice</span>
        </div>
      </div>
    </footer>
  );
}

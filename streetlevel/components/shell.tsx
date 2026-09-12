"use client";

/**
 * The application shell: masthead, primary navigation, status strip and
 * footer.
 *
 * The navigation is a single dark band at the top of every page. It is the one
 * place on the site that inverts, which gives the layout a fixed anchor and
 * keeps the working area entirely on paper.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";
import { formatDate } from "@/lib/analytics";

const NAV_ITEMS = [
  { href: "/", label: "Overview", match: (path: string) => path === "/" },
  { href: "/analytics", label: "Analytics", match: (path: string) => path.startsWith("/analytics") },
  { href: "/portfolio", label: "Portfolio", match: (path: string) => path.startsWith("/portfolio") },
  { href: "/signals", label: "Signals", match: (path: string) => path.startsWith("/signals") },
  { href: "/performance", label: "Performance", match: (path: string) => path.startsWith("/performance") },
];

export function TopNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Primary" className="sticky top-0 z-40 border-b border-ink/15 bg-ink text-surface">
      <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-4 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 pr-4 text-surface"
          aria-label="StreetLevel home"
        >
          <span className="flex h-7 w-7 items-center justify-center bg-surface font-mono text-[11px] font-bold text-ink">
            SL
          </span>
          <span className="hidden text-[12px] font-semibold tracking-[0.14em] uppercase sm:inline">StreetLevel</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-4 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                  active
                    ? "border-surface text-surface"
                    : "border-transparent text-surface/55 hover:border-surface/30 hover:text-surface",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/**
 * The status strip under the navigation.
 *
 * It states, in one line, what the data behind the page is and how old it is.
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
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "UTC",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("sl-live-dot h-1.5 w-1.5 rounded-full", stale ? "bg-warn" : "bg-accent")}
          />
          <Eyebrow>{stale ? "Delayed data" : "Research desk"}</Eyebrow>
          {note && <span className="text-[11px] text-muted">{note}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          <span>{source}</span>
          <span>Last bar {formatDate(asOf)}</span>
          <span className="font-mono tabular-nums">{now ? `${now} UTC` : " "}</span>
        </div>
      </div>
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1560px] px-4 pb-20 pt-8 sm:px-6 lg:px-10">{children}</main>
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
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-hairline-strong pb-5">
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
    <footer className="mt-20 border-t border-hairline-strong pt-6">
      <div className="mx-auto flex max-w-[1560px] flex-col gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint sm:flex-row sm:items-center sm:justify-between">
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

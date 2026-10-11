"use client";

/**
 * A strip of every covered symbol with its latest move, for hopping between
 * names without leaving the analytics page.
 *
 * It replaces a native select that listed "AAPL · Apple Inc." and nothing
 * else. The strip shows at a glance which names moved and which way, keeps the
 * current one highlighted, and pairs with `[` and `]` to step through the list
 * from the keyboard.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Delta } from "@/components/ui";
import type { DirectoryEntry } from "@/lib/symbol-directory";
import { cn, isTypingTarget } from "@/lib/utils";

export function SymbolSwitcher({ entries, current }: { entries: DirectoryEntry[]; current: string }) {
  const router = useRouter();
  const stripRef = useRef<HTMLDivElement | null>(null);
  const index = Math.max(0, entries.findIndex((entry) => entry.symbol === current));
  const previous = entries[(index - 1 + entries.length) % entries.length];
  const next = entries[(index + 1) % entries.length];

  // Bring the current chip into view horizontally without moving the page.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>("[aria-current=page]");
    if (!strip || !chip) return;
    const target = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
    strip.scrollLeft = Math.max(0, target);
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key === "[") router.push(`/analytics/${previous.symbol}`);
      if (event.key === "]") router.push(`/analytics/${next.symbol}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, previous.symbol, next.symbol]);

  return (
    <nav aria-label="Covered symbols" className="flex items-stretch border border-hairline bg-surface">
      <StepLink href={`/analytics/${previous.symbol}`} label={`Previous symbol, ${previous.symbol}`} shortcut="[">
        <ChevronLeft className="h-4 w-4" />
      </StepLink>
      <div ref={stripRef} className="scrollbar-none fade-end flex min-w-0 flex-1 overflow-x-auto">
        {entries.map((entry) => {
          const active = entry.symbol === current;
          return (
            <Link
              key={entry.symbol}
              href={`/analytics/${entry.symbol}`}
              aria-current={active ? "page" : undefined}
              title={entry.name}
              className={cn(
                "flex min-w-[76px] flex-1 shrink-0 flex-col justify-center border-r border-hairline px-3 py-1.5 transition-colors last:border-r-0",
                active ? "bg-ink text-surface" : "hover:bg-sunken",
              )}
            >
              <span className={cn("font-mono text-[11px] font-semibold", active ? "text-surface" : "text-ink")}>
                {entry.symbol}
              </span>
              <Delta
                value={entry.change}
                className={cn("text-[10px]", active && "text-surface/75")}
              />
            </Link>
          );
        })}
      </div>
      <StepLink href={`/analytics/${next.symbol}`} label={`Next symbol, ${next.symbol}`} shortcut="]">
        <ChevronRight className="h-4 w-4" />
      </StepLink>
    </nav>
  );
}

function StepLink({
  href,
  label,
  shortcut,
  children,
}: {
  href: string;
  label: string;
  shortcut: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={`${label} (${shortcut})`}
      aria-keyshortcuts={shortcut}
      className="flex w-9 shrink-0 items-center justify-center border-hairline text-muted transition-colors first:border-r last:border-l hover:bg-sunken hover:text-ink"
    >
      {children}
    </Link>
  );
}

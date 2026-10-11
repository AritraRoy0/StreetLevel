"use client";

/**
 * The command palette: jump to any covered symbol or page from anywhere.
 *
 * A research session is mostly moving between names, and before this the only
 * route to a symbol was back through the overview table or a native select on
 * the analytics page. The palette answers "take me to AMD" in three
 * keystrokes, and shows the latest price and move while it does, so it doubles
 * as a quick quote.
 *
 * It is a combobox over a listbox: focus stays in the input the whole time and
 * the arrow keys move a highlighted option, which is the pattern screen readers
 * announce correctly and the one people know from every editor.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CornerDownLeft, Moon, Search, Sun } from "lucide-react";
import { Delta, Kbd } from "@/components/ui";
import { formatPrice } from "@/lib/analytics";
import type { DirectoryEntry } from "@/lib/symbol-directory";
import { cn } from "@/lib/utils";
import { setThemePreference, useTheme } from "./theme";
import { NAV_ITEMS } from "./nav-items";

type Item =
  | { kind: "symbol"; id: string; entry: DirectoryEntry; href: string }
  | { kind: "page"; id: string; label: string; description: string; href: string }
  | { kind: "action"; id: string; label: string; description: string; icon: ReactNode; run: () => void };

const GROUP_LABEL: Record<Item["kind"], string> = {
  symbol: "Symbols",
  page: "Pages",
  action: "Settings",
};

/**
 * Ranks a symbol against the query. Lower is better; null drops it.
 * A ticker match beats a company-name match, which beats a sector match, so
 * typing "am" puts AMD and AMZN above anything merely containing the letters.
 */
function rankSymbol(entry: DirectoryEntry, query: string): number | null {
  if (!query) return 0;
  const symbol = entry.symbol.toLowerCase();
  const name = entry.name.toLowerCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.split(/[\s.,&]+/).some((word) => word.startsWith(query))) return 2;
  if (symbol.includes(query)) return 3;
  if (name.includes(query)) return 4;
  if (entry.sector.toLowerCase().includes(query)) return 5;
  return null;
}

/**
 * Mounted only while open, so every opening starts from an empty query with
 * the first result highlighted, without resetting state in an effect.
 */
export function CommandPalette({
  onClose,
  directory,
}: {
  onClose: () => void;
  directory: DirectoryEntry[];
}) {
  const router = useRouter();
  const { resolved } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();

    const symbols = directory
      .map((entry) => ({ entry, rank: rankSymbol(entry, q) }))
      .filter((candidate): candidate is { entry: DirectoryEntry; rank: number } => candidate.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.entry.symbol.localeCompare(b.entry.symbol))
      .map(({ entry }): Item => ({ kind: "symbol", id: `symbol-${entry.symbol}`, entry, href: `/analytics/${entry.symbol}` }));

    const pages = NAV_ITEMS.filter(
      (item) => !q || item.label.toLowerCase().includes(q) || item.keywords.some((keyword) => keyword.includes(q)),
    ).map((item): Item => ({ kind: "page", id: `page-${item.href}`, label: item.label, description: item.description, href: item.href }));

    const next = resolved === "dark" ? "light" : "dark";
    const themeAction: Item = {
      kind: "action",
      id: "action-theme",
      label: `Switch to ${next} theme`,
      description: "Remembered on this device",
      icon: next === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />,
      run: () => setThemePreference(next),
    };
    const actions = !q || ["theme", "dark", "light", "mode", "colour", "color"].some((word) => word.startsWith(q)) ? [themeAction] : [];

    return [...symbols, ...pages, ...actions];
  }, [directory, query, resolved]);

  // Lock the page behind the dialog, and hand focus back to whatever opened it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  // Keep the highlighted option in view as the arrow keys move it.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    if (item.kind === "action") item.run();
    else router.push(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (items.length === 0 ? 0 : (current + 1) % items.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (items.length === 0 ? 0 : (current - 1 + items.length) % items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const activeItem = items[active];

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div
        aria-hidden="true"
        className="sl-fade-in absolute inset-0 bg-[rgba(8,10,9,0.42)] backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search symbols and pages"
        className="sl-enter sl-float absolute inset-x-2 top-2 mx-auto flex max-h-[calc(100dvh-1rem)] max-w-xl flex-col border border-hairline-strong bg-surface sm:inset-x-4 sm:top-[12vh] sm:max-h-[70vh]"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItem ? `${listId}-${activeItem.id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search a ticker, company or page"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-ink"
          >
            <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            <span className="sm:hidden">Close</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-ink">Nothing matches &ldquo;{query}&rdquo;</p>
            <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-muted">
              Coverage is {directory.length - 1} names plus the SL10 composite. Try a ticker such as{" "}
              {directory.slice(0, 2).map((entry) => entry.symbol).join(" or ")}.
            </p>
          </div>
        ) : (
          <ul ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto py-1.5">
            {items.map((item, index) => {
              const showGroup = index === 0 || items[index - 1].kind !== item.kind;
              const selected = index === active;
              return (
                <li key={item.id} role="presentation">
                  {showGroup && (
                    <p
                      role="presentation"
                      className="px-4 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint"
                    >
                      {GROUP_LABEL[item.kind]}
                    </p>
                  )}
                  <div
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(item)}
                    className={cn(
                      "mx-1.5 flex cursor-pointer items-center gap-3 px-2.5 py-2",
                      selected ? "bg-sunken" : "bg-transparent",
                    )}
                  >
                    <PaletteRow item={item} />
                    <CornerDownLeft
                      aria-hidden="true"
                      className={cn("h-3.5 w-3.5 shrink-0 text-muted", selected ? "opacity-100" : "opacity-0")}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="hidden items-center gap-4 border-t border-hairline px-4 py-2 text-[11px] text-muted sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            to open
          </span>
          <span className="ml-auto">Prices as of the latest bar</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PaletteRow({ item }: { item: Item }) {
  if (item.kind === "symbol") {
    const { entry } = item;
    return (
      <>
        <span className="w-14 shrink-0 font-mono text-[12px] font-semibold text-ink">{entry.symbol}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink-soft">{entry.name}</span>
          <span className="block truncate text-[11px] text-faint sm:hidden">{entry.sector}</span>
        </span>
        <span className="hidden w-40 shrink-0 truncate text-[11px] text-faint sm:block">{entry.sector}</span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-[12px] tabular-nums text-ink-soft">
            {entry.symbol === "SL10" && entry.last !== null ? entry.last.toFixed(1) : formatPrice(entry.last)}
          </span>
          <Delta value={entry.change} className="text-[11px]" />
        </span>
      </>
    );
  }
  if (item.kind === "page") {
    return (
      <>
        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">{item.label}</span>
          <span className="block truncate text-[11px] text-muted">{item.description}</span>
        </span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="shrink-0 text-muted">
        {item.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{item.label}</span>
        <span className="block truncate text-[11px] text-muted">{item.description}</span>
      </span>
    </>
  );
}

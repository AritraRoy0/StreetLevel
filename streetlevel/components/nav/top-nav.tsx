"use client";

/**
 * The primary navigation.
 *
 * A single dark band at the top of every page. It is the one place on the site
 * that inverts, which gives the layout a fixed anchor and keeps the working
 * area entirely on paper. It is rendered once, by the root layout, so loading,
 * error and not-found states keep it too.
 *
 * Above the `md` breakpoint the sections sit in the bar with search and the
 * theme switch beside them. Below it they fold into a menu: five uppercase
 * links do not fit a phone, and the earlier sideways-scrolling row cut
 * "Signals" in half with nothing to say that more existed.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Menu, Monitor, Moon, Search, Sun, X } from "lucide-react";
import { cn, isTypingTarget } from "@/lib/utils";
import type { DirectoryEntry } from "@/lib/symbol-directory";
import { CommandPalette } from "./command-palette";
import { NAV_ITEMS } from "./nav-items";
import { setThemePreference, useTheme, type ThemePreference } from "./theme";

const noopSubscribe = () => () => {};

/** Whether to label the shortcut ⌘ or Ctrl. The server cannot know, so it says Ctrl. */
function useIsMac() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}

export function TopNav({ directory }: { directory: DirectoryEntry[] }) {
  const pathname = usePathname() ?? "/";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMac = useIsMac();
  const { resolved } = useTheme();

  const openPalette = useCallback(() => {
    setMenuOpen(false);
    setPaletteOpen(true);
  }, []);

  // ⌘K or Ctrl+K from anywhere, and "/" when the reader is not typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
        setMenuOpen(false);
      } else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        openPalette();
      } else if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="sticky top-0 z-40 border-b border-chrome-line bg-chrome text-chrome-ink"
      >
        <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 pr-2 text-chrome-ink md:pr-4"
            aria-label="StreetLevel home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex h-7 w-7 items-center justify-center bg-chrome-ink font-mono text-[11px] font-bold text-chrome">
              SL
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">StreetLevel</span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 shrink-0 items-center border-b-2 px-3 pt-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                    active
                      ? "border-chrome-ink text-chrome-ink"
                      : "border-transparent text-chrome-ink/60 hover:border-chrome-ink/30 hover:text-chrome-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Search symbols and pages"
              aria-keyshortcuts="Control+K Meta+K /"
              className="hidden h-8 w-56 items-center gap-2 border border-chrome-ink/15 bg-chrome-ink/[0.04] px-2.5 text-[12px] text-chrome-ink/60 transition-colors hover:border-chrome-ink/35 hover:text-chrome-ink lg:flex"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Search symbols</span>
              <kbd className="font-mono text-[10px] tracking-wide text-chrome-ink/50">{isMac ? "⌘K" : "Ctrl K"}</kbd>
            </button>
            <NavIconButton label="Search symbols and pages" onClick={openPalette} className="lg:hidden">
              <Search className="h-4 w-4" />
            </NavIconButton>
            <NavIconButton
              label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setThemePreference(resolved === "dark" ? "light" : "dark")}
              className="hidden md:flex"
            >
              {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </NavIconButton>
            <NavIconButton
              label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((current) => !current)}
              className="md:hidden"
              expanded={menuOpen}
              controls="mobile-menu"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </NavIconButton>
          </div>
        </div>

        {menuOpen && (
          <MobileMenu pathname={pathname} onNavigate={() => setMenuOpen(false)} />
        )}
      </nav>

      {menuOpen && (
        <div
          aria-hidden="true"
          className="sl-fade-in fixed inset-0 z-30 bg-[rgba(8,10,9,0.32)] md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {paletteOpen && <CommandPalette directory={directory} onClose={() => setPaletteOpen(false)} />}
    </>
  );
}

function NavIconButton({
  label,
  onClick,
  children,
  className,
  expanded,
  controls,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center text-chrome-ink/70 transition-colors hover:bg-chrome-ink/10 hover:text-chrome-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
  { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
];

function MobileMenu({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { preference } = useTheme();
  return (
    <div
      id="mobile-menu"
      className="sl-enter sl-float absolute inset-x-0 top-full border-b border-hairline bg-surface text-ink md:hidden"
    >
      <ul className="divide-y divide-hairline px-4">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-3 py-3"
              >
                <span
                  aria-hidden="true"
                  className={cn("h-4 w-0.5 shrink-0", active ? "bg-ink" : "bg-transparent")}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[13px] font-semibold", active ? "text-ink" : "text-ink-soft")}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{item.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Theme</span>
        <div role="group" aria-label="Theme" className="inline-flex border border-hairline">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preference === option.value}
              onClick={() => setThemePreference(option.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 border-r border-hairline px-2.5 text-[10px] font-semibold uppercase tracking-wider last:border-r-0",
                preference === option.value ? "bg-ink text-surface" : "text-muted",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

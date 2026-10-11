"use client";

/**
 * Theme preference.
 *
 * The preference is `light`, `dark`, or absent, which means "follow the
 * operating system". What the page actually wears is the resolved value, held
 * in `data-theme` on `<html>`. An inline script in the root layout sets that
 * attribute before first paint (see `THEME_SCRIPT`), so this module only has to
 * keep it in step afterwards.
 *
 * The attribute is the single source of truth. React reads it through
 * `useSyncExternalStore`, which renders the server's default during hydration
 * and then the real value, so a dark-mode visitor gets no hydration warning and
 * no flash.
 */

import { useSyncExternalStore } from "react";
import { DARK_QUERY, THEME_STORAGE_KEY as STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice still applies for this page view.
  }
  document.documentElement.setAttribute("data-theme", resolve(preference));
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // While following the system, an OS-level switch should carry straight through.
  const media = window.matchMedia(DARK_QUERY);
  const onMedia = () => {
    if (readPreference() === "system") {
      document.documentElement.setAttribute("data-theme", resolve("system"));
      emit();
    }
  };
  // Another tab changing the preference should update this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    document.documentElement.setAttribute("data-theme", resolve(readPreference()));
    emit();
  };
  media.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): string {
  const resolved = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  return `${readPreference()}:${resolved}`;
}

export function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme } {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:light");
  const [preference, resolved] = value.split(":") as [ThemePreference, ResolvedTheme];
  return { preference, resolved };
}

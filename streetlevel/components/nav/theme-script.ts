/**
 * The pre-paint theme script and the names it shares with the theme store.
 *
 * This module has no `"use client"` directive on purpose: the root layout is a
 * server component and needs the script as a plain string. Imported from a
 * client module instead, it would arrive as a client reference.
 */

export const THEME_STORAGE_KEY = "sl-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in `<head>` before the body is parsed, so the first paint is already in
 * the right theme. Kept tiny and dependency-free, and wrapped in try/catch
 * because storage access throws in some private browsing modes.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

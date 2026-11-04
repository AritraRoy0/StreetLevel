/**
 * Site identity and the public origin every absolute URL is built from.
 *
 * The origin matters more than it looks. Canonical links, the sitemap, Open
 * Graph tags and structured data all need fully qualified URLs, and a wrong
 * origin in any of them tells a search engine the page lives somewhere else.
 *
 * It resolves, in order, from:
 *
 * 1. `NEXT_PUBLIC_SITE_URL`, which should be set once a custom domain is attached.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets on every deployment to
 *    the project's production domain. Preview builds therefore point their
 *    canonicals at production rather than at a throwaway preview host.
 * 3. The local development server.
 *
 * Server-only in practice: the Vercel variables are not exposed to the browser,
 * so client components should not read `SITE_URL`.
 *
 * The module has no path-alias imports so the test runner can load it directly.
 */

export const SITE_NAME = "StreetLevel";

export const SITE_TAGLINE = "Research, made useful.";

/** The default description, used where a page does not state its own. */
export const SITE_DESCRIPTION =
  "Free stock analytics and backtesting: interactive charts with RSI, MACD, Bollinger Bands and moving averages, risk metrics such as volatility, drawdown, beta and Sharpe ratio, and a backtester that models costs and slippage.";

export const SITE_LOCALE = "en_US";

/** The public source repository, linked from the about page and the organization schema. */
export const SOURCE_REPOSITORY = "https://github.com/AritraRoy0/StreetLevel";

/** The date the editorial pages were last revised, for the sitemap and article metadata. */
export const CONTENT_UPDATED = "2026-11-03";

const LOCAL_ORIGIN = "http://localhost:3001";

/**
 * Turns a host or URL into a bare origin with no trailing slash, or `null`
 * when the value is missing or unparseable. A bare host such as
 * `streetlevel.app` is given `https://`, which is how Vercel reports domains.
 */
export function toOrigin(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

/** Resolves the public origin from an environment, following the order documented above. */
export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  return (
    toOrigin(env.NEXT_PUBLIC_SITE_URL) ??
    toOrigin(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    toOrigin(env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ??
    LOCAL_ORIGIN
  );
}

/**
 * Each variable is read by name rather than by passing `process.env` whole:
 * Next inlines `process.env.NEXT_PUBLIC_*` member reads at build time, so a
 * statically built page and one rendered per request resolve the same origin
 * even if the runtime environment lacks the variable.
 */
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
});

/** A fully qualified URL for a site-relative path. */
export function absoluteUrl(path = "/", origin = SITE_URL): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? origin : `${origin}${normalized}`;
}

/**
 * Whether this deployment should be indexed.
 *
 * Anything Vercel labels as other than production is a preview, and a preview
 * that gets indexed competes with the real site for its own queries. Off
 * Vercel, where `VERCEL_ENV` is unset, the build is assumed to be the real one.
 */
export function isIndexable(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "production";
}

/**
 * Shared plumbing for the analytics route handlers.
 *
 * Every route is wrapped so that rate limiting, caching, error mapping and
 * cache headers behave identically across endpoints. A handler body is then
 * only the part that differs: parse, fetch, return.
 */

import { NextResponse } from "next/server";
import { apiRateLimiter, clientKey, TtlCache } from "./analytics-cache";
import { AnalyticsError, toErrorResponse } from "./analytics-validation";

export interface RouteOptions<T> {
  /** Cache to consult, if the endpoint is cacheable. */
  cache?: TtlCache<T>;
  /** Key for the cache entry. Omitting it skips the cache for that request. */
  cacheKey?: (request: Request) => string | null;
  /** Seconds a shared cache may serve this response. */
  maxAge?: number;
}

/**
 * Runs a handler with rate limiting, caching and uniform error handling.
 *
 * A cached hit is returned before the handler runs, and only successful
 * responses are written back to the cache: caching an error would turn a
 * transient upstream failure into a minute of guaranteed failures.
 */
export async function handleRoute<T>(
  request: Request,
  options: RouteOptions<T>,
  handler: () => T | Promise<T>,
): Promise<NextResponse> {
  const limit = apiRateLimiter.check(clientKey(request));
  const rateHeaders: Record<string, string> = {
    "X-RateLimit-Remaining": String(limit.remaining),
    "X-RateLimit-Reset": new Date(limit.resetAt).toISOString(),
  };

  if (!limit.allowed) {
    const { status, body } = toErrorResponse(
      new AnalyticsError(
        "RATE_LIMITED",
        "Too many requests.",
        `Wait ${limit.retryAfterSeconds} seconds before retrying.`,
      ),
    );
    return NextResponse.json(body, {
      status,
      headers: { ...rateHeaders, "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  try {
    const key = options.cache && options.cacheKey ? options.cacheKey(request) : null;

    if (options.cache && key) {
      const cached = options.cache.get(key);
      if (cached !== undefined) {
        const age = options.cache.ageOf(key) ?? 0;
        return NextResponse.json(cached, {
          headers: {
            ...rateHeaders,
            "X-Cache": "HIT",
            Age: String(Math.floor(age / 1000)),
            "Cache-Control": `public, max-age=${options.maxAge ?? 60}`,
          },
        });
      }
    }

    const payload = await handler();

    if (options.cache && key) options.cache.set(key, payload);

    return NextResponse.json(payload, {
      headers: {
        ...rateHeaders,
        "X-Cache": options.cache && key ? "MISS" : "BYPASS",
        "Cache-Control": `public, max-age=${options.maxAge ?? 60}`,
      },
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    if (status >= 500) {
      // Surfacing the real cause in the log while returning a generic body.
      console.error("[analytics-api]", error);
    }
    return NextResponse.json(body, { status, headers: rateHeaders });
  }
}

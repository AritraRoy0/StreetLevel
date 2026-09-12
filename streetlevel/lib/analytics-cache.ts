/**
 * Caching and rate limiting for the analytics API.
 *
 * Both are deliberately in-process. This app serves a static bundled dataset
 * from a single Node process, so a shared store would add operational weight
 * without buying correctness. The interfaces are narrow enough that swapping
 * in Redis later touches only this file.
 *
 * The cache rule that matters: entries carry an explicit TTL and are evicted
 * on read when expired. Nothing here will serve a value it knows to be stale,
 * because a quietly outdated price is worse than a slow one.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  storedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

/**
 * A bounded time-to-live cache with least-recently-used eviction.
 *
 * `maxEntries` stops an endpoint that takes a free-form symbol from growing
 * the map without limit, which is the usual way a naive memo cache becomes a
 * memory leak.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(ttlMs: number, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      this.misses += 1;
      this.evictions += 1;
      return undefined;
    }
    // Refresh recency for the LRU ordering that Map insertion order gives us.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, { value, expiresAt: now + this.ttlMs, storedAt: now });
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) break;
      this.store.delete(oldest.value);
      this.evictions += 1;
    }
  }

  /** Age of a cached entry in milliseconds, for the `Age` response header. */
  ageOf(key: string, now = Date.now()): number | null {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt <= now) return null;
    return now - entry.storedAt;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  stats(): CacheStats {
    return { hits: this.hits, misses: this.misses, evictions: this.evictions, size: this.store.size };
  }
}

/**
 * Fixed-window rate limiter.
 *
 * A fixed window can let through up to twice the limit across a window
 * boundary. That is an accepted trade for this endpoint: the cost of a request
 * is a slice of an in-memory array, and the limiter exists to stop a runaway
 * client loop rather than to meter a paid quota.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): { allowed: boolean; remaining: number; resetAt: number; retryAfterSeconds: number } {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      this.sweep(now);
      return { allowed: true, remaining: this.limit - 1, resetAt, retryAfterSeconds: Math.ceil(this.windowMs / 1000) };
    }
    bucket.count += 1;
    const remaining = Math.max(0, this.limit - bucket.count);
    return {
      allowed: bucket.count <= this.limit,
      remaining,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  /** Drops expired buckets so an endpoint keyed by client address stays bounded. */
  private sweep(now: number): void {
    if (this.buckets.size < 1000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** History responses are cheap to rebuild but hot; a short TTL is enough. */
export const historyCache = new TtlCache<unknown>(60_000, 300);

/** Quotes change more often in a live deployment, so they expire faster. */
export const quoteCache = new TtlCache<unknown>(15_000, 500);

export const apiRateLimiter = new RateLimiter(120, 60_000);

/**
 * Identifies a caller for rate limiting.
 *
 * Falls back to a single shared bucket when no forwarding header is present,
 * which is the safe direction: an unidentifiable flood is still throttled.
 */
export function clientKey(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "anonymous";
}

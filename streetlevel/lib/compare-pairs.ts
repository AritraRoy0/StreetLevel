/**
 * Head-to-head comparison pairs and their URLs.
 *
 * One page exists per unordered pair, so "NVDA vs AMD" and "AMD vs NVDA" are
 * the same page rather than two near-duplicates splitting the same search
 * traffic. The canonical order puts the larger company first, which is the
 * order people tend to type, and the reversed slug redirects to it.
 *
 * Pure and alias-free so the test runner can load it directly.
 */

export interface ComparisonPair {
  /** The symbol listed first, the larger of the two by the caller's ordering. */
  first: string;
  second: string;
  /** Lowercase URL segment, `nvda-vs-amd`. */
  slug: string;
}

const SLUG_PATTERN = /^([a-z][a-z0-9.]{0,11})-vs-([a-z][a-z0-9.]{0,11})$/;

export function pairSlug(first: string, second: string): string {
  return `${first.toLowerCase()}-vs-${second.toLowerCase()}`;
}

/** Reads the two symbols out of a slug, uppercased, or `null` when it is not a pair slug. */
export function parsePairSlug(slug: string): { first: string; second: string } | null {
  const match = SLUG_PATTERN.exec(slug.toLowerCase());
  if (!match || match[1] === match[2]) return null;
  return { first: match[1].toUpperCase(), second: match[2].toUpperCase() };
}

/** Every unordered pair of `ordered`, each listed with the earlier symbol first. */
export function buildPairs(ordered: readonly string[]): ComparisonPair[] {
  const pairs: ComparisonPair[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      pairs.push({ first: ordered[i], second: ordered[j], slug: pairSlug(ordered[i], ordered[j]) });
    }
  }
  return pairs;
}

/**
 * The canonical pair for two symbols in either order, or `null` when either is
 * outside `ordered` or they are the same symbol.
 */
export function canonicalPair(a: string, b: string, ordered: readonly string[]): ComparisonPair | null {
  const left = ordered.indexOf(a.toUpperCase());
  const right = ordered.indexOf(b.toUpperCase());
  if (left === -1 || right === -1 || left === right) return null;
  const [first, second] = left < right ? [ordered[left], ordered[right]] : [ordered[right], ordered[left]];
  return { first, second, slug: pairSlug(first, second) };
}

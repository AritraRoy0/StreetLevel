import type { MetadataRoute } from "next";
import { COMPOSITE_SYMBOL, DATASET, SYMBOLS } from "@/lib/market-data";
import { COMPARISON_PAIRS } from "@/lib/comparisons";
import { GUIDE_CATALOG } from "@/lib/learn/catalog";
import { CONTENT_UPDATED, absoluteUrl } from "@/lib/site";

/**
 * `sitemap.xml`: every canonical, indexable URL and nothing else.
 *
 * Left out on purpose: `/analytics`, which only redirects to a symbol; the
 * reversed comparison slugs, which redirect to the canonical order; and
 * backtest links with query strings, which canonicalize to `/performance`.
 *
 * Pages built from market data change when the dataset does, so they carry
 * the snapshot date. Editorial pages carry the date they were last revised.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const data = new Date(DATASET.downloadedAt);
  const content = new Date(CONTENT_UPDATED);

  return [
    { url: absoluteUrl("/"), lastModified: data, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/performance"), lastModified: data, changeFrequency: "weekly", priority: 0.8 },
    ...[...SYMBOLS, COMPOSITE_SYMBOL].map((symbol) => ({
      url: absoluteUrl(`/analytics/${symbol}`),
      lastModified: data,
      changeFrequency: "daily" as const,
      priority: symbol === COMPOSITE_SYMBOL ? 0.6 : 0.9,
    })),
    { url: absoluteUrl("/compare"), lastModified: data, changeFrequency: "weekly", priority: 0.7 },
    ...COMPARISON_PAIRS.map((pair) => ({
      url: absoluteUrl(`/compare/${pair.slug}`),
      lastModified: data,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: absoluteUrl("/learn"), lastModified: content, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDE_CATALOG.map((guide) => ({
      url: absoluteUrl(`/learn/${guide.slug}`),
      lastModified: content,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/methodology"), lastModified: content, changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/about"), lastModified: content, changeFrequency: "yearly", priority: 0.3 },
  ];
}

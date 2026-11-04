import type { MetadataRoute } from "next";
import { absoluteUrl, isIndexable } from "@/lib/site";

/**
 * `robots.txt`.
 *
 * Production opens everything except the JSON API, which is data for the
 * pages rather than pages in its own right. Preview deployments close the
 * whole site so a throwaway build is never indexed in competition with the
 * real one.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable(process.env)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}

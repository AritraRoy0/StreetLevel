/**
 * Page metadata and structured data.
 *
 * Next merges metadata from a layout into its pages **shallowly**: a page that
 * sets `openGraph.title` replaces the layout's whole `openGraph` object, site
 * name and locale included. So every page builds its metadata through
 * `pageMetadata`, which always emits the complete set: canonical, Open Graph
 * and the Twitter card. Share images come from the `opengraph-image` file
 * convention beside each route, which Next merges in on top.
 *
 * The JSON-LD builders return plain schema.org nodes. A page collects the ones
 * it needs into a single `@graph` and renders it with `<JsonLd>`.
 */

import type { Metadata } from "next";
import { CONTENT_UPDATED, SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SOURCE_REPOSITORY, absoluteUrl } from "@/lib/site";

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  socialTitle,
  type = "website",
  publishedTime,
  modifiedTime,
}: {
  /** The page's own title; the layout's template appends the site name unless `absoluteTitle`. */
  title: string;
  description: string;
  /** Site-relative canonical path, such as `/analytics/NVDA`. */
  path: string;
  absoluteTitle?: boolean;
  /** A shorter title for share cards, where the site name is shown separately. */
  socialTitle?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
}): Metadata {
  const shareTitle = socialTitle ?? title;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url: path,
      title: shareTitle,
      description,
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* JSON-LD                                                                     */
/* -------------------------------------------------------------------------- */

export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

export function organizationNode(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    sameAs: [SOURCE_REPOSITORY],
  };
}

export function websiteNode(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** The application itself, so the home page can be understood as a free tool rather than an article. */
export function webApplicationNode(): JsonLdNode {
  return {
    "@type": "WebApplication",
    "@id": absoluteUrl("/#app"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript for interactive charts",
    description: SITE_DESCRIPTION,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function webPageNode({
  path,
  name,
  description,
  type = "WebPage",
  dateModified,
  about,
  breadcrumbId,
}: {
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "CollectionPage" | "AboutPage";
  dateModified?: string;
  about?: JsonLdNode;
  breadcrumbId?: string;
}): JsonLdNode {
  return {
    "@type": type,
    "@id": `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name,
    description,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    ...(dateModified ? { dateModified } : {}),
    ...(about ? { about } : {}),
    ...(breadcrumbId ? { breadcrumb: { "@id": breadcrumbId } } : {}),
  };
}

export function articleNode({
  path,
  headline,
  description,
  datePublished = CONTENT_UPDATED,
  dateModified = CONTENT_UPDATED,
  about,
}: {
  path: string;
  headline: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  about?: string;
}): JsonLdNode {
  return {
    "@type": "TechArticle",
    "@id": `${absoluteUrl(path)}#article`,
    headline,
    description,
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    datePublished,
    dateModified,
    inLanguage: "en",
    image: absoluteUrl(`${path}/opengraph-image`),
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    ...(about ? { about: { "@type": "DefinedTerm", name: about } } : {}),
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbNode(path: string, crumbs: readonly Crumb[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * A FAQ block. Only for questions that are visible on the page in the same
 * words: structured data describing content the reader cannot see is against
 * the search engines' guidelines.
 */
export function faqNode(path: string, faqs: readonly { question: string; answer: string }[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

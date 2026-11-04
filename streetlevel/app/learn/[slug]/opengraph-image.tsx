import { renderOg } from "@/lib/og";
import { GUIDE_CATALOG, guideEntry } from "@/lib/learn/catalog";
import { GUIDES } from "@/lib/learn/guides";

export const alt = "StreetLevel guide: the formula, how to read it and live readings across ten stocks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Rendered once per guide at build time. */
export function generateStaticParams() {
  return GUIDE_CATALOG.map((guide) => ({ slug: guide.slug }));
}

export const dynamicParams = false;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = guideEntry(slug);
  const body = GUIDES[slug];
  if (!entry || !body) return new Response("Not found", { status: 404 });

  return renderOg({
    eyebrow: `${entry.category} guide`,
    title: entry.title,
    subtitle: body.formula ? body.lede.split(". ")[0].replace(/\.$/, "") + "." : entry.description,
    // Geist Mono has no superscript minus; the card spells the inverse out rather than drop the glyph.
    code: body.formula?.lines.map((line) => line.replace(/⁻¹/g, "^-1")),
    footnote: "Formula, edge cases and live readings across ten large-cap stocks",
  });
}

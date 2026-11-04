/**
 * Structured data for search engines, as one JSON-LD script.
 *
 * `JSON.stringify` does not escape `<`, so a string containing `</script>`
 * would close the tag early and let the rest run as markup. Every `<` is
 * written as its unicode escape instead, which JSON parsers read back as the
 * same character.
 */

import type { JsonLdNode } from "@/lib/seo";

export function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

import { renderOg } from "@/lib/og";
import { SITE_TAGLINE } from "@/lib/site";

export const alt = "About StreetLevel, a free and open-source market research workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOg({
    eyebrow: "About",
    title: SITE_TAGLINE,
    subtitle: "A free, open-source market research workspace: stock analytics, indicators, comparisons and backtesting.",
  });
}

import { redirect } from "next/navigation";
import { SYMBOLS } from "@/lib/market-data";

/**
 * `/analytics` has no symbol of its own, so it forwards to the first covered
 * name. Every analytics URL therefore names the symbol it shows, which makes
 * the page linkable and the browser history meaningful.
 */
export default function AnalyticsIndexPage() {
  redirect(`/analytics/${SYMBOLS[0]}`);
}

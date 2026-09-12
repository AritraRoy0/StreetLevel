import { handleRoute } from "@/lib/analytics-api";
import { quoteCache } from "@/lib/analytics-cache";
import { getQuote } from "@/lib/analytics-data";
import { validateSymbol } from "@/lib/analytics-validation";

/** `GET /api/analytics/:symbol/quote` returns the latest bar as a quote. */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await params;

  return handleRoute(
    request,
    { cache: quoteCache, cacheKey: () => rawSymbol.toUpperCase(), maxAge: 15 },
    () => getQuote(validateSymbol(rawSymbol)),
  );
}

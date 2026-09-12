import { handleRoute } from "@/lib/analytics-api";
import { quoteCache } from "@/lib/analytics-cache";
import { getQuote } from "@/lib/analytics-data";
import { validateSymbolList } from "@/lib/analytics-validation";
import { hasSymbol } from "@/lib/market-data";

/**
 * `GET /api/analytics/quotes?symbols=AAPL,MSFT`
 *
 * A batch request succeeds partially: symbols with no coverage are listed
 * under `missing` rather than failing the whole call, so one bad ticker in a
 * watchlist does not blank the row for every other holding.
 */
export async function GET(request: Request) {
  return handleRoute(
    request,
    {
      cache: quoteCache,
      cacheKey: (req) => `batch:${(new URL(req.url).searchParams.get("symbols") ?? "").toUpperCase()}`,
      maxAge: 15,
    },
    () => {
      const symbols = validateSymbolList(new URL(request.url).searchParams.get("symbols"));
      const covered = symbols.filter(hasSymbol);
      const missing = symbols.filter((symbol) => !hasSymbol(symbol));

      return {
        data: covered.map(getQuote),
        missing,
        requested: symbols.length,
      };
    },
  );
}

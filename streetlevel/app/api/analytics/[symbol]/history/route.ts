import { handleRoute } from "@/lib/analytics-api";
import { historyCache } from "@/lib/analytics-cache";
import { getHistory } from "@/lib/analytics-data";
import {
  requireAvailableInterval,
  validateDateRange,
  validateInterval,
  validateRange,
  validateSymbol,
} from "@/lib/analytics-validation";

/**
 * `GET /api/analytics/:symbol/history`
 *
 * Query parameters:
 * - `interval` one of `1d`, `1w`, `1mo` (default `1d`)
 * - `range` one of the named presets (default `1Y`), used when no explicit
 *   window is given
 * - `start` and `end` ISO-8601 UTC timestamps; both are required together and
 *   take precedence over `range`
 */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await params;

  return handleRoute(
    request,
    {
      cache: historyCache,
      cacheKey: (req) => {
        const query = new URL(req.url).searchParams;
        return [
          rawSymbol.toUpperCase(),
          query.get("interval") ?? "1d",
          query.get("range") ?? "1Y",
          query.get("start") ?? "",
          query.get("end") ?? "",
        ].join("|");
      },
      maxAge: 60,
    },
    () => {
      const symbol = validateSymbol(rawSymbol);
      const query = new URL(request.url).searchParams;
      const interval = requireAvailableInterval(validateInterval(query.get("interval")));

      const startValue = query.get("start");
      const endValue = query.get("end");

      if (startValue && endValue) {
        const { start, end } = validateDateRange(startValue, endValue, interval);
        return getHistory(symbol, { interval, start, end });
      }

      return getHistory(symbol, { interval, range: validateRange(query.get("range")) });
    },
  );
}

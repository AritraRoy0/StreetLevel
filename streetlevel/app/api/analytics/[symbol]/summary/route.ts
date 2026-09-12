import { handleRoute } from "@/lib/analytics-api";
import { historyCache } from "@/lib/analytics-cache";
import { getSummary } from "@/lib/analytics-data";
import {
  requireAvailableInterval,
  validateInterval,
  validateRange,
  validateSymbol,
} from "@/lib/analytics-validation";

/**
 * `GET /api/analytics/:symbol/summary?range=1Y&interval=1d`
 *
 * Returns the same snapshot object the analytics page renders from. The bar
 * array is omitted: a client that wants the series should call `/history`, and
 * shipping 250 bars inside every metrics request wastes most of the payload.
 */
export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = await params;

  return handleRoute(
    request,
    {
      cache: historyCache,
      cacheKey: (req) => {
        const query = new URL(req.url).searchParams;
        return `summary:${rawSymbol.toUpperCase()}|${query.get("range") ?? "1Y"}|${query.get("interval") ?? "1d"}`;
      },
      maxAge: 60,
    },
    () => {
      const symbol = validateSymbol(rawSymbol);
      const query = new URL(request.url).searchParams;
      const range = validateRange(query.get("range"));
      const interval = requireAvailableInterval(validateInterval(query.get("interval")));

      const { bars, indicators, daily, weekly, monthly, drawdown, ...rest } = getSummary(symbol, range, interval);

      return {
        ...rest,
        drawdown: {
          maxDrawdown: drawdown.maxDrawdown,
          currentDrawdown: drawdown.currentDrawdown,
          peakTimestamp: drawdown.peakTimestamp,
          troughTimestamp: drawdown.troughTimestamp,
          recoveryTimestamp: drawdown.recoveryTimestamp,
          drawdownDays: drawdown.drawdownDays,
          recoveryDays: drawdown.recoveryDays,
        },
        counts: {
          bars: bars.length,
          daily: daily.length,
          weekly: weekly.length,
          monthly: monthly.length,
          indicatorSeries: Object.keys(indicators).length,
        },
      };
    },
  );
}

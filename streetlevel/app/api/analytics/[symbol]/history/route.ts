import { NextResponse } from "next/server";
import { analyticsErrorResponse } from "@/lib/analytics-api";
import { getDatasetBounds, getHistoricalRows, hasSymbol } from "@/lib/analytics-data";
import { INTERVAL_CONFIG, validateDateRange, validateInterval, validateSymbol } from "@/lib/analytics-validation";
import type { HistoricalSeriesResponse } from "@/lib/types";

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = validateSymbol((await params).symbol);
    if (!hasSymbol(symbol)) return NextResponse.json({ error: { code: "NOT_FOUND", message: `Unsupported symbol: ${symbol}.` } }, { status: 404 });
    const query = new URL(request.url).searchParams;
    const interval = validateInterval(query.get("interval"));
    if (!INTERVAL_CONFIG[interval].providerAvailable && !INTERVAL_CONFIG[interval].databaseAvailable) {
      return NextResponse.json({ error: { code: "INVALID_INTERVAL", message: `${interval} data is not available.` } }, { status: 400 });
    }
    const bounds = getDatasetBounds(symbol);
    if (!bounds.start || !bounds.end) return NextResponse.json({ error: { code: "NOT_FOUND", message: "No historical data available." } }, { status: 404 });
    const startValue = query.get("start") ?? bounds.start.toISOString();
    const endValue = query.get("end") ?? bounds.end.toISOString();
    const { start, end } = validateDateRange(startValue, endValue, interval);
    const data = getHistoricalRows(symbol, start, end);
    const response: HistoricalSeriesResponse = {
      symbol,
      interval,
      start: start.toISOString(),
      end: end.toISOString(),
      timezone: "UTC",
      data,
      metadata: { source: "provider", cached: true, pointCount: data.length },
    };
    return NextResponse.json(response);
  } catch (error) {
    return analyticsErrorResponse(error, NextResponse.json);
  }
}
import { NextResponse } from "next/server";
import { analyticsErrorResponse } from "@/lib/analytics-api";
import { getLatestQuote, hasSymbol } from "@/lib/analytics-data";
import { validateSymbol } from "@/lib/analytics-validation";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const symbol = validateSymbol((await params).symbol);
    if (!hasSymbol(symbol)) return NextResponse.json({ error: { code: "NOT_FOUND", message: `Unsupported symbol: ${symbol}.` } }, { status: 404 });
    return NextResponse.json(getLatestQuote(symbol));
  } catch (error) {
    return analyticsErrorResponse(error, NextResponse.json);
  }
}
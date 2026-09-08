import { NextResponse } from "next/server";
import { analyticsErrorResponse } from "@/lib/analytics-api";
import { getLatestQuote, hasSymbol } from "@/lib/analytics-data";
import { validateSymbol } from "@/lib/analytics-validation";

export async function GET(request: Request) {
  try {
    const values = new URL(request.url).searchParams.get("symbols")?.split(",") ?? [];
    if (!values.length) return NextResponse.json({ error: { code: "INVALID_SYMBOL", message: "symbols must contain at least one symbol." } }, { status: 400 });
    const symbols = values.map(validateSymbol);
    const unsupported = symbols.find((symbol) => !hasSymbol(symbol));
    if (unsupported) return NextResponse.json({ error: { code: "NOT_FOUND", message: `Unsupported symbol: ${unsupported}.` } }, { status: 404 });
    return NextResponse.json({ data: symbols.map((symbol) => getLatestQuote(symbol)) });
  } catch (error) {
    return analyticsErrorResponse(error, NextResponse.json);
  }
}
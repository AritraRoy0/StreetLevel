import type { NextResponse } from "next/server";
import { AnalyticsValidationError } from "./analytics-validation";

export function analyticsErrorResponse(error: unknown, json: (body: unknown, init?: ResponseInit) => NextResponse) {
  if (error instanceof AnalyticsValidationError) {
    return json({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  return json({ error: { code: "INTERNAL_ERROR", message: "Unable to load analytics data." } }, { status: 500 });
}
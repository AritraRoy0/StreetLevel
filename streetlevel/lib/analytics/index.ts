/**
 * Public surface of the analytics engine.
 *
 * Application code imports from here rather than reaching into individual
 * modules, so the internal file layout can change without touching pages.
 * Note the explicit `.ts` extensions: they let Node's test runner resolve the
 * graph directly with type stripping, so the suite runs with no build step and
 * no extra dependency.
 */

export * from "./types.ts";
export * from "./math.ts";
export * from "./series.ts";
export * from "./indicators.ts";
export * from "./returns.ts";
export * from "./compare.ts";
export * from "./portfolio.ts";
export * from "./summary.ts";
export * from "./format.ts";
export * from "./news.ts";

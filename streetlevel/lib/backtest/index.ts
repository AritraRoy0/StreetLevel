/**
 * Public surface of the backtest engine.
 *
 * As with `lib/analytics`, the internal modules import each other with explicit
 * `.ts` specifiers so Node's test runner can resolve the graph directly under
 * type stripping, with no build step.
 */

export * from "./types.ts";
export * from "./signals.ts";
export * from "./simulator.ts";
export * from "./statistics.ts";
export * from "./benchmark.ts";
export * from "./sweep.ts";
export * from "./portfolio-backtest.ts";
export * from "./runner.ts";

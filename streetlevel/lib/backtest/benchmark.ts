/**
 * Comparing a backtest run against its benchmarks.
 *
 * A strategy is measured against two things, and they answer different
 * questions. Buy-and-hold on the same symbol asks whether the *rule* added
 * anything, holding the asset choice constant. The composite asks whether the
 * whole position, rule and asset together, beat simply owning the market.
 * Reporting only one of them lets a good stock pick masquerade as a good rule.
 */

import { compareToBenchmark } from "../analytics/compare.ts";
import type { ComparisonResult } from "../analytics/compare.ts";
import { finite } from "../analytics/math.ts";
import type { Bar, Maybe } from "../analytics/types.ts";
import { equityToBars } from "./statistics.ts";
import type { BacktestResult } from "./types.ts";

export interface BenchmarkReport {
  /** The rule against holding the same symbol for the whole window. */
  versusBuyAndHold: ComparisonResult;
  /** The rule against the house composite, when one is supplied. */
  versusComposite: ComparisonResult | null;
  /** Strategy return less buy-and-hold return, as a fraction. */
  ruleEdge: Maybe;
  /** Return given up to transaction costs, as a fraction. Negative is a drag. */
  costDrag: Maybe;
  /** Return with every cost switched off. */
  frictionlessReturn: Maybe;
  /** Commission and friction paid, in currency. */
  commissionPaid: number;
  frictionPaid: number;
  warnings: string[];
}

/**
 * Builds the benchmark report for a completed run.
 *
 * `frictionless` is the same run with costs zeroed, supplied by the caller so
 * the second simulation is not hidden inside a function that looks cheap.
 */
export function buildBenchmarkReport(
  result: BacktestResult,
  frictionless: BacktestResult,
  compositeBars?: readonly Bar[],
): BenchmarkReport {
  const strategyCurve = equityToBars(result.equity);
  const holdCurve = equityToBars(result.benchmarkEquity);

  const versusBuyAndHold = compareToBenchmark(strategyCurve, holdCurve, {
    baseSymbol: "Strategy",
    benchmarkSymbol: `${result.symbol} hold`,
  });

  const versusComposite =
    compositeBars && compositeBars.length > 0
      ? compareToBenchmark(strategyCurve, compositeBars, {
          baseSymbol: "Strategy",
          benchmarkSymbol: "SL10",
        })
      : null;

  const ruleEdge =
    result.totalReturn === null || result.benchmarkTotalReturn === null
      ? null
      : finite(result.totalReturn - result.benchmarkTotalReturn);

  const costDrag =
    result.totalReturn === null || frictionless.totalReturn === null
      ? null
      : finite(result.totalReturn - frictionless.totalReturn);

  const warnings: string[] = [];
  if (versusBuyAndHold.warnings.length > 0) warnings.push(...versusBuyAndHold.warnings);
  if (ruleEdge !== null && Math.abs(ruleEdge) < 0.01) {
    warnings.push("The rule lands within a percentage point of simply holding, which is inside the noise of one year.");
  }
  if (costDrag !== null && result.totalReturn !== null && frictionless.totalReturn !== null) {
    if (frictionless.totalReturn > 0 && result.totalReturn <= 0) {
      warnings.push("The rule is profitable before costs and unprofitable after them.");
    }
  }

  return {
    versusBuyAndHold,
    versusComposite,
    ruleEdge,
    costDrag,
    frictionlessReturn: frictionless.totalReturn,
    commissionPaid: result.statistics.totalCommission,
    frictionPaid: result.statistics.totalFriction,
    warnings,
  };
}

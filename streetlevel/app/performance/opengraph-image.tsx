import { renderOg } from "@/lib/og";
import { SYMBOLS } from "@/lib/market-data";

export const alt = "StreetLevel backtester: test trading rules with costs, slippage, stops and walk-forward analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOg({
    eyebrow: "Free stock backtester",
    title: "Test a trading rule before you trust it.",
    subtitle:
      "SMA and EMA crossovers, RSI, MACD, Bollinger and Donchian rules, with costs, gap fills and stops modelled, parameter sweeps and walk-forward analysis.",
    metrics: [
      { label: "Trading rules", value: "8" },
      { label: "Stocks", value: String(SYMBOLS.length) },
      { label: "Costs modelled", value: "Yes" },
      { label: "Sign-up", value: "None" },
    ],
  });
}

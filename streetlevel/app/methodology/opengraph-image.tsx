import { renderOg } from "@/lib/og";

export const alt = "StreetLevel methodology: how every figure is calculated";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOg({
    eyebrow: "Methodology",
    title: "How every figure is calculated.",
    subtitle: "Data validation, adjusted versus raw prices, the formula behind each metric and indicator, and the backtest execution model.",
    code: ["σ_annual = σ(r) · √252", "DD_t = C_t / max(C_0…C_t) − 1", "β = cov(r_a, r_b) / var(r_b)", "Sharpe = (r̄·P − r_f) / (σ·√P)"],
  });
}

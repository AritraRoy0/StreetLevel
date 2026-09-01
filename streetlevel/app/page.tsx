import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  FileText,
  GitBranch,
  LineChart,
  Newspaper,
  Radio,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const watchlist = [
  { symbol: "NVDA", name: "NVIDIA Corp", price: "128.44", change: 2.14, spark: [118, 121, 119, 124, 126, 123, 128] },
  { symbol: "AAPL", name: "Apple Inc.", price: "231.09", change: -0.42, spark: [233, 232, 234, 231, 230, 232, 231] },
  { symbol: "TSLA", name: "Tesla Inc.", price: "256.77", change: 1.03, spark: [249, 251, 253, 250, 254, 255, 257] },
  { symbol: "MSFT", name: "Microsoft Corp", price: "441.20", change: 0.18, spark: [438, 440, 439, 441, 440, 442, 441] },
];

const tickerStrip = [
  { symbol: "AAPL", change: 0.4 },
  { symbol: "NVDA", change: 2.1 },
  { symbol: "TSLA", change: 1.0 },
  { symbol: "MSFT", change: 0.2 },
  { symbol: "AMZN", change: -1.3 },
  { symbol: "GOOGL", change: 0.6 },
  { symbol: "META", change: -0.3 },
  { symbol: "AMD", change: 1.8 },
];

const techFacts = [
  { value: "3", label: "layers — ingestion, storage, and analytics" },
  { value: "6", label: "indicators & signals, from SMA to anomaly detection" },
  { value: "≤15 min", label: "quote refresh during market hours" },
];

const features = [
  {
    icon: Radio,
    title: "Real-time quotes",
    description: "Firestore-backed pricing streams straight to your watchlist — no refresh, no polling.",
  },
  {
    icon: LineChart,
    title: "Technical indicators",
    description: "SMA, EMA, RSI, and Bollinger Bands, computed on ingest and ready the moment you open a ticker.",
  },
  {
    icon: Bell,
    title: "Smart alerts",
    description: "Set a price or RSI threshold once. StreetLevel checks it every ingest cycle and tells you the moment it's crossed.",
  },
  {
    icon: Newspaper,
    title: "Headline tracking",
    description: "Deduplicated news pulled alongside price data, so context and price action live in one place.",
  },
];

const steps = [
  { number: "01", title: "Add your tickers", description: "Build a watchlist from any symbol. StreetLevel starts pulling OHLCV data on the next ingest cycle." },
  { number: "02", title: "We track & analyze", description: "Every cycle computes indicators, checks for anomalies, and rolls up history so nothing gets lost." },
  { number: "03", title: "You get alerts", description: "Cross a threshold you've set — price, RSI, or a volume spike — and you'll know within one cycle." },
];

const indicatorRows = [
  { label: "RSI (14)", value: 68, hint: "Approaching overbought", tone: "warn" as const },
  { label: "SMA (50) spread", value: 82, hint: "+4.8% above average", tone: "good" as const },
  { label: "Bollinger position", value: 88, hint: "Near upper band", tone: "warn" as const },
  { label: "Volume z-score", value: 91, hint: "2.3σ (flagged)", tone: "flag" as const },
];

const toneColors: Record<"good" | "warn" | "flag", string> = {
  good: "#3ECF8E",
  warn: "#E8B34E",
  flag: "#E5484D",
};

const caseStudyLinks = [
  { label: "Source code", href: "https://github.com/AritraRoy0/StreetLevel", icon: GitBranch },
  { label: "Architecture diagram", href: "https://github.com/AritraRoy0/StreetLevel#architecture", icon: Workflow },
  { label: "Design decisions", href: "https://github.com/AritraRoy0/StreetLevel#design-decisions", icon: FileText },
];

function sparklinePath(values: number[]) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = 64 / (values.length - 1);
  return values
    .map((v, i) => {
      const x = (i * step).toFixed(1);
      const y = (22 - ((v - min) / range) * 20).toFixed(1);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#1E2536] bg-[#0B0F1A]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2A3348] font-mono text-sm font-semibold text-[#E8B34E]">
              SL
            </span>
            <span className="font-mono text-sm font-medium tracking-tight text-[#EDEFF3]">StreetLevel</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-[#8B93A7] md:flex">
            <a href="#features" className="transition hover:text-[#EDEFF3]">Features</a>
            <a href="#how-it-works" className="transition hover:text-[#EDEFF3]">How it works</a>
            <a href="#architecture" className="transition hover:text-[#EDEFF3]">Architecture</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-[#8B93A7] transition hover:text-[#EDEFF3] sm:block">
              Sign in
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E8B34E] px-4 py-2 text-sm font-semibold text-[#0B0F1A] transition hover:bg-[#F0C36B]"
            >
              View live demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section id="top" className="mx-auto max-w-6xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 text-sm text-[#8B93A7]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ECF8E] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3ECF8E]" />
                </span>
                Live market data, refreshed every ingest cycle
              </div>

              <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-[#EDEFF3] sm:text-5xl lg:text-6xl">
                Your watchlist, explained in real time.
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-[#8B93A7]">
                StreetLevel streams live quotes, computes the indicators that matter, and tells you the moment something changes — no dashboard-hopping required.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/demo"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8B34E] px-6 py-3 text-sm font-semibold text-[#0B0F1A] transition hover:bg-[#F0C36B]"
                >
                  View live demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://github.com/AritraRoy0/StreetLevel"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2A3348] px-6 py-3 text-sm font-semibold text-[#EDEFF3] transition hover:border-[#3A4560] hover:bg-[#121826]"
                >
                  <GitBranch className="h-4 w-4" />
                  See the code
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-[#1E2536] bg-[#121826] p-5 shadow-2xl shadow-black/20">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#8B93A7]">Watchlist</p>
                  <p className="mt-1 font-mono text-sm text-[#EDEFF3]">4 tickers</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#2A3348] bg-[#0B0F1A] px-2.5 py-1 text-xs text-[#3ECF8E]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3ECF8E]" />
                  Live
                </div>
              </div>

              <div className="divide-y divide-[#1E2536]">
                {watchlist.map((row) => (
                  <div key={row.symbol} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[#EDEFF3]">{row.symbol}</p>
                      <p className="text-xs text-[#8B93A7]">{row.name}</p>
                    </div>
                    <svg viewBox="0 0 64 24" className="h-6 w-16 shrink-0">
                      <path
                        d={sparklinePath(row.spark)}
                        fill="none"
                        stroke={row.change >= 0 ? "#3ECF8E" : "#E5484D"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="text-right">
                      <p className="font-mono text-sm text-[#EDEFF3]">${row.price}</p>
                      <p
                        className={cn(
                          "flex items-center justify-end gap-0.5 font-mono text-xs",
                          row.change >= 0 ? "text-[#3ECF8E]" : "text-[#E5484D]"
                        )}
                      >
                        {row.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(row.change).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#1E2536] bg-[#0D1220]">
          <div className="mx-auto max-w-6xl overflow-x-auto px-6 py-4">
            <div className="flex w-max items-center gap-6">
              {tickerStrip.map((t) => (
                <div key={t.symbol} className="flex items-center gap-2 font-mono text-sm">
                  <span className="text-[#8B93A7]">{t.symbol}</span>
                  <span className={t.change >= 0 ? "text-[#3ECF8E]" : "text-[#E5484D]"}>
                    {t.change >= 0 ? "+" : ""}
                    {t.change.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {techFacts.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-[#1E2536] bg-[#121826] p-6">
                <p className="font-mono text-3xl font-semibold text-[#EDEFF3]">{fact.value}</p>
                <p className="mt-2 text-sm text-[#8B93A7]">{fact.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-[#EDEFF3] sm:text-4xl">
            Built to help you understand the move, not just see it.
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#1E2536] bg-[#1E2536] sm:grid-cols-2">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-[#0B0F1A] p-6 sm:p-8">
                <Icon className="h-5 w-5 text-[#E8B34E]" />
                <h3 className="mt-4 text-lg font-semibold text-[#EDEFF3]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8B93A7]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[#EDEFF3] sm:text-4xl">
                Three steps from symbol to signal.
              </h2>

              <div className="mt-10 space-y-8 border-l border-[#1E2536] pl-6">
                {steps.map((step) => (
                  <div key={step.number} className="relative">
                    <span className="absolute -left-[29px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-[#2A3348] bg-[#0B0F1A] font-mono text-[11px] text-[#8B93A7]">
                      {step.number}
                    </span>
                    <h3 className="text-base font-semibold text-[#EDEFF3]">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#8B93A7]">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#1E2536] bg-[#121826] p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#8B93A7]">Ticker snapshot</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-[#EDEFF3]">NVDA</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#2A3348] px-2.5 py-1 text-xs text-[#8B93A7]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3ECF8E]" />
                  Updated 12s ago
                </div>
              </div>

              <div className="mt-8 space-y-5">
                {indicatorRows.map((row) => {
                  const toneColor = toneColors[row.tone];
                  return (
                    <div key={row.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-[#8B93A7]">{row.label}</span>
                        <span className="font-mono text-xs" style={{ color: toneColor }}>
                          {row.hint}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#1E2536]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.value}%`, backgroundColor: toneColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="architecture" className="border-t border-[#1E2536]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[#EDEFF3] sm:text-4xl">
                  Why this project exists
                </h2>
                <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#8B93A7]">
                  I built StreetLevel to work through a real ingestion-to-alerting pipeline end to end — rate-limited API polling, a MySQL/Firestore split for historical versus live data, and indicator math that&apos;s easy to get subtly wrong. The write-ups below cover the tradeoffs.
                </p>
              </div>

              <div className="space-y-3">
                {caseStudyLinks.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-[#1E2536] bg-[#121826] px-5 py-4 transition hover:border-[#2A3348]"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-[#EDEFF3]">
                      <Icon className="h-4 w-4 text-[#E8B34E]" />
                      {label}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[#8B93A7]" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border border-[#1E2536] bg-[#121826] p-8 sm:p-10 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-[#EDEFF3] sm:text-4xl">
                Add your first ticker.
              </h2>
              <p className="mt-3 max-w-sm text-[#8B93A7]">
                Try it with a seeded demo account — no signup needed to look around.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8B34E] px-6 py-3 text-sm font-semibold text-[#0B0F1A] transition hover:bg-[#F0C36B]"
              >
                View live demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2A3348] px-6 py-3 text-sm font-semibold text-[#EDEFF3] transition hover:border-[#3A4560]"
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1E2536]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-[#8B93A7] sm:flex-row sm:items-center">
          <p className="font-mono">StreetLevel</p>
          <div className="flex flex-wrap gap-6">
            <a
              href="https://github.com/AritraRoy0/StreetLevel"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-[#EDEFF3]"
            >
              GitHub
            </a>
            <a href="#" className="transition hover:text-[#EDEFF3]">LinkedIn</a>
            <a href="#" className="transition hover:text-[#EDEFF3]">Resume</a>
            <a href="#" className="transition hover:text-[#EDEFF3]">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}

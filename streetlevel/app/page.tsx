import {
  ArrowRight,
  BadgeCheck,
  Compass,
  MapPinned,
  PlayCircle,
  Quote,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const trustPills = ["Downtown", "Riverside", "Old Town", "Midtown", "Harbor", "Arts District"];

const metrics = [
  { value: "63", label: "districts tracked" },
  { value: "96%", label: "match confidence" },
  { value: "4.9/5", label: "resident rating" },
];

const features = [
  {
    icon: Compass,
    title: "Context-rich discovery",
    description: "See the real feel of each neighborhood before you commit to a move, visit, or stop.",
  },
  {
    icon: Route,
    title: "Smart trip planning",
    description: "Build neighborhood-aware routes that balance walkability, amenities, and daily rhythm.",
  },
  {
    icon: TrendingUp,
    title: "Live neighborhood pulse",
    description: "Track foot traffic, trends, and signals that reveal what is rising, stable, or fading.",
  },
];

const steps = [
  { number: "01", title: "Pin your priorities", description: "Set mood, budget, pace, and lifestyle preferences." },
  { number: "02", title: "Explore live signals", description: "Compare blocks with trust scores, safety trends, and what people care about." },
  { number: "03", title: "Move with confidence", description: "Turn neighborhood insight into better decisions and smarter plans." },
];

const testimonials = [
  {
    quote:
      "StreetLevel makes neighborhood research feel effortless. We found a perfect area in half the time and with far more confidence.",
    name: "Ava Chen",
    role: "Relocation strategist",
  },
  {
    quote:
      "The signals are incredibly useful. It balances local vibe with practical considerations in a way that feels premium and honest.",
    name: "Marcus Hall",
    role: "Creative director",
  },
];

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-7rem] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(96,165,250,0.26),_transparent_55%)] blur-3xl" />
        <div className="absolute right-[-8rem] top-52 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.16),_transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-6rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(74,222,128,0.18),_transparent_60%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl">
        <header className="mb-14 rounded-full border border-white/60 bg-white/65 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/20">
                S
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.26em] text-slate-500 uppercase">StreetLevel</p>
              </div>
            </div>

            <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <a href="#features" className="transition hover:text-slate-950">Features</a>
              <a href="#insights" className="transition hover:text-slate-950">Insights</a>
              <a href="#stories" className="transition hover:text-slate-950">Stories</a>
            </nav>

            <div className="flex items-center gap-3">
              <button className="hidden rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white sm:inline-flex">
                Log in
              </button>
              <button className={cn("inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800") }>
                Get started
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <section className="grid items-center gap-12 pb-16 pt-8 lg:grid-cols-[1.08fr_0.92fr] lg:pt-10">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm shadow-blue-100">
              <Sparkles className="h-4 w-4" />
              Smarter city decisions, beautifully delivered
            </div>

            <div className="space-y-6">
              <h1 className="max-w-xl text-5xl font-semibold tracking-[-0.08em] text-slate-950 sm:text-6xl lg:text-7xl">
                Discover the places people actually love.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                StreetLevel gives you sharper neighborhood insight so you can move, explore, and plan with more clarity than guesswork ever allowed.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800">
                Start exploring
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white">
                <PlayCircle className="h-4 w-4" />
                Watch demo
              </button>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-600">
              {[
                "Live neighborhood insight",
                "Trusted local data",
                "Tailored recommendations",
              ].map((item) => (
                <div key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/75 px-3 py-2 shadow-sm backdrop-blur-sm">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-8 top-5 h-28 w-28 rounded-full bg-sky-200/60 blur-3xl" />
            <div className="absolute bottom-6 right-4 h-28 w-28 rounded-full bg-emerald-200/60 blur-3xl" />

            <div className="relative rounded-[2rem] border border-white/80 bg-white/70 p-3 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
              <div className="rounded-[1.6rem] bg-slate-950 p-5 text-white sm:p-6">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Neighborhood pulse</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Downtown East</h2>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    +12.4%
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                      <span>Live activity</span>
                      <span>Today</span>
                    </div>
                    <div className="flex items-end gap-2">
                      {[32, 48, 42, 60, 72, 66, 94].map((height, idx) => (
                        <div
                          key={height + idx}
                          className="flex-1 rounded-t-xl bg-gradient-to-t from-blue-400 via-cyan-300 to-sky-200"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center gap-2 text-slate-300">
                        <MapPinned className="h-4 w-4 text-blue-300" />
                        Walkability
                      </div>
                      <div className="text-2xl font-semibold">92</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex items-center gap-2 text-slate-300">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        Safety
                      </div>
                      <div className="text-2xl font-semibold">97</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-[0_20px_36px_rgba(251,191,36,0.24)]">
              <div className="flex items-center gap-2 text-amber-700">
                <Star className="h-4 w-4 fill-amber-400" />
                <span className="text-sm font-semibold">Top-rated area</span>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-8 pt-3">
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            {trustPills.map((item) => (
              <div key={item} className="rounded-full border border-slate-200 bg-white/70 px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur-sm">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="insights" className="pt-8">
          <div className="grid gap-5 md:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-[1.75rem] border border-slate-200/80 bg-white/75 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950">{metric.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Why it works</p>
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Built to help you choose better places.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="group rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(15,23,42,0.08)]">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 pb-24 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-5 rounded-[2rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">How it works</p>
            <h3 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">Turn insight into action in three quick steps.</h3>
            <div className="space-y-5 pt-3">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {step.number}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{step.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.22)] sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live overview</p>
                <h3 className="mt-2 text-2xl font-semibold">Area quality index</h3>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-sky-200">
                Updated 4 min ago
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {[
                { label: "Lifestyle fit", value: 92 },
                { label: "Transit access", value: 85 },
                { label: "Amenities", value: 89 },
                { label: "Safety score", value: 97 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                    <span>{item.label}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-300">Local sentiment</p>
                  <p className="text-lg font-semibold">Highly recommended</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-300">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="stories" className="pb-24">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">Customer stories</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-slate-950">People choose better neighborhoods with better context.</h2>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map(({ quote, name, role }) => (
              <article key={name} className="rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] backdrop-blur-xl">
                <Quote className="h-8 w-8 text-sky-500" />
                <p className="mt-5 text-lg leading-8 text-slate-700">“{quote}”</p>
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <p className="font-semibold text-slate-950">{name}</p>
                  <p className="text-sm text-slate-500">{role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="pb-24">
          <div className="rounded-[2.25rem] border border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-sm font-medium tracking-[0.2em] text-sky-200 uppercase">Ready to move smarter?</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl">
                  See where the next best move actually is.
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                  Talk to sales
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

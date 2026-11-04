/**
 * Share-card rendering for the `opengraph-image` routes.
 *
 * Every card uses one layout in the site's own language: the dark navigation
 * band with the mark, then a paper body on the measured grid, a title, and
 * optionally a chart or a formula beside it and a row of figures beneath.
 * A link that unfurls as this card in a feed or a chat is recognisably the
 * site before anyone reads it.
 *
 * Rendered with `ImageResponse`, which supports flexbox and a subset of CSS:
 * every element with more than one child must be `display: flex`. Charts are
 * drawn as SVG strings and embedded as data URIs, which renders identically
 * everywhere. Fonts are the Geist files in `assets/fonts`, read once.
 *
 * Server-only.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

const INK = "#0e100f";
const INK_SOFT = "#3c413e";
const MUTED = "#5c625e";
const PAPER = "#fbfbfa";
const SURFACE = "#ffffff";
const HAIRLINE = "#e5e6e3";
const HAIRLINE_STRONG = "#c8ccc6";
const ACCENT = "#166f4e";
const POS = "#15704e";
const NEG = "#9c2b1c";
const SECOND_SERIES = "#8a6116";

type Tone = "pos" | "neg" | "ink";

const TONE_COLOR: Record<Tone, string> = { pos: POS, neg: NEG, ink: INK };

export interface OgMetric {
  label: string;
  value: string;
  tone?: Tone;
}

export interface OgCard {
  eyebrow: string;
  title: string;
  /** Set the title in the monospace face, for tickers. */
  mono?: boolean;
  subtitle?: string;
  /** One or two price series drawn on a shared scale. */
  chart?: { series: Array<{ values: number[]; label?: string }>; tone?: Tone };
  /** Formula lines shown in a box beside the title. */
  code?: string[];
  metrics?: OgMetric[];
  /** Small print at the foot of the card. */
  footnote?: string;
}

let fontCache: Promise<Array<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" }>> | null = null;

function fonts() {
  fontCache ??= Promise.all(
    ["Geist-Regular.ttf", "Geist-SemiBold.ttf", "GeistMono-SemiBold.ttf"].map((file) =>
      readFile(join(process.cwd(), "assets/fonts", file)),
    ),
  ).then(([regular, semibold, mono]) => [
    { name: "Geist", data: regular, weight: 400, style: "normal" },
    { name: "Geist", data: semibold, weight: 600, style: "normal" },
    { name: "Geist Mono", data: mono, weight: 600, style: "normal" },
  ]);
  return fontCache;
}

function dataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The faint 44-pixel grid the overview masthead sits on. */
function gridSvg(width: number, height: number) {
  const lines: string[] = [];
  for (let x = 0; x <= width; x += 44) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`);
  for (let y = 0; y <= height; y += 44) lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g stroke="${HAIRLINE}" stroke-width="1">${lines.join("")}</g></svg>`;
}

/** Thins a series to about `points` values spread across its whole span. */
export function thin(values: readonly number[], points = 120): number[] {
  if (values.length <= points) return [...values];
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, index) => values[Math.round(index * step)]);
}

function chartSvg(series: Array<{ values: number[] }>, tone: Tone | undefined, width: number, height: number) {
  const all = series.flatMap((item) => item.values).filter(Number.isFinite);
  if (all.length < 2) return null;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 10;
  const y = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);

  const paths = series.map((item, index) => {
    const step = width / Math.max(1, item.values.length - 1);
    const d = item.values.map((value, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const single = series.length === 1;
    const rising = item.values[item.values.length - 1] >= item.values[0];
    const colour = single ? TONE_COLOR[tone ?? (rising ? "pos" : "neg")] : index === 0 ? INK : SECOND_SERIES;
    const area = single ? `<path d="${d} L${width},${height} L0,${height} Z" fill="${colour}" fill-opacity="0.08"/>` : "";
    return `${area}<path d="${d}" fill="none" stroke="${colour}" stroke-width="${single ? 3 : 2.5}" stroke-linejoin="round"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join("")}</svg>`;
}

function host() {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return SITE_NAME.toLowerCase();
  }
}

export async function renderOg(card: OgCard): Promise<ImageResponse> {
  const { width, height } = OG_SIZE;
  const bandHeight = 84;
  const chartWidth = 470;
  const chartHeight = 230;
  const chart = card.chart ? chartSvg(card.chart.series, card.chart.tone, chartWidth, chartHeight) : null;
  const subtitle = card.subtitle && card.subtitle.length > 150 ? `${card.subtitle.slice(0, 147).trimEnd()}…` : card.subtitle;
  // A title beside a chart and above a row of figures has the least room, so it steps down first.
  const crowded = Boolean(chart || card.code) && Boolean(card.metrics?.length);
  const titleSize = card.mono
    ? card.title.length <= 6
      ? 96
      : 64
    : crowded
      ? 52
      : card.title.length > 48
        ? 50
        : card.title.length > 28
          ? 58
          : 68;
  const subtitleSize = crowded ? 23 : 26;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: PAPER, fontFamily: "Geist" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: bandHeight,
            padding: "0 64px",
            background: INK,
            color: SURFACE,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                background: SURFACE,
                color: INK,
                fontFamily: "Geist Mono",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              SL
            </div>
            <div style={{ display: "flex", marginLeft: 16, fontSize: 18, fontWeight: 600, letterSpacing: 3.5 }}>
              {SITE_NAME.toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 16, color: "#9aa19c", letterSpacing: 2.5, fontWeight: 600 }}>
            {host().toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", position: "relative", flex: 1, padding: "52px 64px 40px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
          <img
            alt=""
            src={dataUri(gridSvg(width, height - bandHeight))}
            width={width}
            height={height - bandHeight}
            style={{ position: "absolute", top: 0, left: 0, opacity: 0.7 }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: chart || card.code ? 560 : 1040 }}>
              <div style={{ display: "flex", fontSize: 18, fontWeight: 600, letterSpacing: 3, color: ACCENT }}>
                {card.eyebrow.toUpperCase()}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: titleSize,
                  lineHeight: 1.05,
                  fontWeight: 600,
                  letterSpacing: card.mono ? -2 : -1.5,
                  color: INK,
                  fontFamily: card.mono ? "Geist Mono" : "Geist",
                }}
              >
                {card.title}
              </div>
              {subtitle && (
                <div style={{ display: "flex", marginTop: 18, fontSize: subtitleSize, lineHeight: 1.35, color: MUTED }}>
                  {subtitle}
                </div>
              )}
            </div>

            {chart && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    background: SURFACE,
                    border: `1px solid ${HAIRLINE_STRONG}`,
                    padding: 14,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
                  <img alt="" src={dataUri(chart)} width={chartWidth} height={chartHeight} />
                </div>
                {card.chart && card.chart.series.length > 1 && (
                  <div style={{ display: "flex", marginTop: 12, fontSize: 18, color: INK_SOFT }}>
                    {card.chart.series.map((item, index) => (
                      <div key={item.label ?? index} style={{ display: "flex", alignItems: "center", marginLeft: 24 }}>
                        <div style={{ display: "flex", width: 22, height: 4, background: index === 0 ? INK : SECOND_SERIES, marginRight: 8 }} />
                        <div style={{ display: "flex", fontFamily: "Geist Mono", fontWeight: 600 }}>{item.label ?? ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!chart && card.code && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: 500,
                  background: SURFACE,
                  border: `1px solid ${HAIRLINE_STRONG}`,
                  padding: "22px 24px",
                }}
              >
                {card.code.slice(0, 5).map((line) => (
                  <div key={line} style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 19, lineHeight: 1.7, color: INK }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {card.metrics && card.metrics.length > 0 && (
            <div
              style={{
                display: "flex",
                marginTop: "auto",
                background: SURFACE,
                border: `1px solid ${HAIRLINE}`,
              }}
            >
              {card.metrics.slice(0, 5).map((metric, index) => (
                <div
                  key={metric.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    padding: "16px 20px",
                    borderLeft: index === 0 ? "none" : `1px solid ${HAIRLINE}`,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 14, fontWeight: 600, letterSpacing: 2.5, color: MUTED }}>
                    {metric.label.toUpperCase()}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 8,
                      fontSize: 34,
                      fontFamily: "Geist Mono",
                      fontWeight: 600,
                      color: TONE_COLOR[metric.tone ?? "ink"],
                    }}
                  >
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {card.footnote && (
            <div
              style={{
                display: "flex",
                marginTop: card.metrics && card.metrics.length > 0 ? 16 : "auto",
                fontSize: 16,
                color: MUTED,
              }}
            >
              {card.footnote}
            </div>
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

/** Tone for a signed figure. */
export function toneOf(value: number | null | undefined): Tone {
  if (value === null || value === undefined || value === 0) return "ink";
  return value > 0 ? "pos" : "neg";
}

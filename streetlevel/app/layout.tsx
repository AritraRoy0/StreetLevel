import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/nav/top-nav";
import { THEME_SCRIPT } from "@/components/nav/theme-script";
import { SYMBOL_DIRECTORY } from "@/lib/symbol-directory";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "StreetLevel",
    template: "%s / StreetLevel",
  },
  description:
    "A market research workspace: price analytics, technical indicators, benchmark comparison and portfolio attribution.",
};

/** The browser chrome matches the navigation band, which is dark in both themes. */
export const viewport: Viewport = {
  themeColor: "#0e100f",
};

/**
 * The root layout.
 *
 * `data-theme="light"` is only the server's default. The inline script in
 * `<head>` swaps it for the reader's stored or system preference before the
 * first paint, which is why `<html>` suppresses the hydration warning: the
 * attribute is meant to differ from what the server sent.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-paper text-ink">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:bg-surface focus:px-3 focus:py-2 focus:text-[12px] focus:font-semibold focus:text-ink focus:outline focus:outline-2 focus:outline-accent"
        >
          Skip to content
        </a>
        <TopNav directory={SYMBOL_DIRECTORY} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}

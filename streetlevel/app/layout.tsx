import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TopNav } from "@/components/nav/top-nav";
import { THEME_SCRIPT } from "@/components/nav/theme-script";
import { SiteFooter } from "@/components/site-footer";
import { SYMBOL_DIRECTORY } from "@/lib/symbol-directory";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_URL, isIndexable } from "@/lib/site";
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

/**
 * Search-console ownership tokens, read from the environment so they can be
 * added on the hosting dashboard without a code change.
 */
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.BING_SITE_VERIFICATION;

/**
 * Site-wide metadata defaults.
 *
 * Pages build their own title, description, canonical and share tags through
 * `pageMetadata` in `lib/seo.ts`; what is set here is what every page shares.
 * `metadataBase` lets those pages give relative URLs. The robots policy opens
 * full-size image previews and unlimited snippets, which is what makes a page
 * eligible for large cards in Discover and for long result snippets, and it
 * closes the whole site on preview deployments so they never compete with
 * production in search. It does not state `index, follow`, which is the
 * default anyway: stating it would contradict the `noindex` Next adds to 404s.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: Free Stock Analytics, Technical Indicators and Backtesting`,
    template: `%s / ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "finance",
  // Prices and volumes such as 123-456 would otherwise become phone links on iOS.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: isIndexable(process.env)
    ? { googleBot: { "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
    : { index: false, follow: false },
  appleWebApp: { title: SITE_NAME },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
  },
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
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}

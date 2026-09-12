/**
 * Sample news feed.
 *
 * These headlines are illustrative fixtures written for this demo, not real
 * reporting, and the UI labels the panel as sample coverage wherever it
 * appears. They exist to exercise the parts of the pipeline that matter:
 * symbol association, timestamp handling, sentiment tagging, event markers on
 * the time series, and de-duplication of a story that several outlets carried.
 *
 * Timestamps fall inside the bundled price window so event markers land on
 * real sessions. A few entries are deliberate near-duplicates of one another
 * so the de-duplication path is exercised by the running app and not only by
 * the test suite.
 */

import { dedupeNews } from "@/lib/analytics";
import type { NewsArticle } from "@/lib/analytics";

const RAW_NEWS: NewsArticle[] = [
  {
    id: "n-001",
    title: "Accelerator demand stays ahead of supply into the second half",
    source: "Market Wire",
    publishedAt: "2026-08-28T13:10:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["NVDA", "AVGO"],
    summary: "Lead times on the newest parts remain extended, with allocation still decided by contract size.",
  },
  {
    id: "n-002",
    title: "Accelerator demand stays ahead of supply into the second half",
    source: "Desk Notes",
    publishedAt: "2026-08-28T16:45:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["NVDA"],
    summary: "Syndicated copy of the same wire story, carried by a second outlet.",
  },
  {
    id: "n-003",
    title: "Hyperscaler capital spending guidance raised again",
    source: "Capital Brief",
    publishedAt: "2026-08-25T11:00:00.000Z",
    category: "Cloud",
    sentiment: "positive",
    symbols: ["MSFT", "AMZN", "GOOGL"],
    summary: "Three of the largest buyers lifted planned outlays, most of it earmarked for compute and power.",
  },
  {
    id: "n-004",
    title: "Services revenue mix continues to shift the margin profile",
    source: "Market Wire",
    publishedAt: "2026-08-19T14:20:00.000Z",
    category: "Consumer Electronics",
    sentiment: "positive",
    symbols: ["AAPL"],
    summary: "Subscription lines grew faster than hardware for a fourth consecutive quarter.",
  },
  {
    id: "n-005",
    title: "Regulator opens review of app distribution terms",
    source: "Policy Desk",
    publishedAt: "2026-07-30T09:05:00.000Z",
    category: "Regulation",
    sentiment: "negative",
    symbols: ["AAPL", "GOOGL"],
    summary: "The review covers commission structures and default placement agreements.",
  },
  {
    id: "n-006",
    title: "Delivery figures come in below the published consensus",
    source: "Auto Monitor",
    publishedAt: "2026-07-02T21:30:00.000Z",
    category: "Automotive",
    sentiment: "negative",
    symbols: ["TSLA"],
    summary: "Quarterly volumes missed estimates, with mix weighted toward the lower-priced trim.",
  },
  {
    id: "n-007",
    title: "Energy storage backlog reaches a record",
    source: "Auto Monitor",
    publishedAt: "2026-06-18T12:00:00.000Z",
    category: "Clean Energy",
    sentiment: "positive",
    symbols: ["TSLA"],
    summary: "Grid-scale orders now extend beyond the next four quarters of nameplate capacity.",
  },
  {
    id: "n-008",
    title: "Advertising demand steadies after a soft opening quarter",
    source: "Capital Brief",
    publishedAt: "2026-06-05T15:40:00.000Z",
    category: "Internet",
    sentiment: "neutral",
    symbols: ["META", "GOOGL"],
    summary: "Pricing recovered while impression growth stayed roughly flat.",
  },
  {
    id: "n-009",
    title: "Ranking model upgrade lifts engagement in early markets",
    source: "Market Wire",
    publishedAt: "2026-05-21T10:15:00.000Z",
    category: "Internet",
    sentiment: "positive",
    symbols: ["META"],
    summary: "Time spent rose in the regions where the new model shipped first.",
  },
  {
    id: "n-010",
    title: "Data-centre GPU share shifts at the margin",
    source: "Silicon Report",
    publishedAt: "2026-05-08T13:25:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["AMD", "NVDA"],
    summary: "A second source won places in several large training clusters.",
  },
  {
    id: "n-011",
    title: "Foundry pricing pressure narrows gross margin guidance",
    source: "Silicon Report",
    publishedAt: "2026-04-23T17:50:00.000Z",
    category: "Semiconductors",
    sentiment: "negative",
    symbols: ["AMD"],
    summary: "Input costs at the leading node rose faster than the company had planned for.",
  },
  {
    id: "n-012",
    title: "Government contract renewals extend through the next fiscal year",
    source: "Policy Desk",
    publishedAt: "2026-04-09T14:00:00.000Z",
    category: "Software",
    sentiment: "positive",
    symbols: ["PLTR"],
    summary: "Several multi-year agreements were exercised rather than rebid.",
  },
  {
    id: "n-013",
    title: "Commercial bookings growth decelerates from the prior quarter",
    source: "Capital Brief",
    publishedAt: "2026-03-26T20:10:00.000Z",
    category: "Software",
    sentiment: "negative",
    symbols: ["PLTR"],
    summary: "New logo additions slowed while net retention held.",
  },
  {
    id: "n-014",
    title: "Custom silicon programme adds a second large customer",
    source: "Silicon Report",
    publishedAt: "2026-03-12T11:35:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["AVGO"],
    summary: "The design win covers networking as well as the accelerator itself.",
  },
  {
    id: "n-015",
    title: "Infrastructure software renewals land at the high end of the range",
    source: "Market Wire",
    publishedAt: "2026-02-26T16:05:00.000Z",
    category: "Software",
    sentiment: "positive",
    symbols: ["AVGO"],
  },
  {
    id: "n-016",
    title: "Retail margin expands as fulfilment costs fall",
    source: "Capital Brief",
    publishedAt: "2026-02-11T13:45:00.000Z",
    category: "E-Commerce",
    sentiment: "positive",
    symbols: ["AMZN"],
    summary: "Regionalised warehousing continued to lower cost per unit shipped.",
  },
  {
    id: "n-017",
    title: "Cloud backlog conversion slows on capacity constraints",
    source: "Desk Notes",
    publishedAt: "2026-01-29T18:20:00.000Z",
    category: "Cloud",
    sentiment: "neutral",
    symbols: ["AMZN", "MSFT"],
    summary: "Contracted revenue is being recognised more slowly than signed.",
  },
  {
    id: "n-018",
    title: "Search monetisation holds up against assistant substitution",
    source: "Market Wire",
    publishedAt: "2026-01-15T12:30:00.000Z",
    category: "Internet",
    sentiment: "neutral",
    symbols: ["GOOGL"],
  },
  {
    id: "n-019",
    title: "Enterprise seat growth reaccelerates on bundled AI features",
    source: "Capital Brief",
    publishedAt: "2025-12-18T15:10:00.000Z",
    category: "Software",
    sentiment: "positive",
    symbols: ["MSFT"],
  },
  {
    id: "n-020",
    title: "Supply chain checks point to a stable build plan",
    source: "Desk Notes",
    publishedAt: "2025-11-20T10:40:00.000Z",
    category: "Consumer Electronics",
    sentiment: "neutral",
    symbols: ["AAPL"],
  },
  {
    id: "n-021",
    title: "UPDATE 1 - Accelerator roadmap pulled forward by one quarter",
    source: "Market Wire",
    publishedAt: "2025-10-30T14:55:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["NVDA"],
  },
  {
    id: "n-022",
    title: "Accelerator roadmap pulled forward by one quarter",
    source: "Silicon Report",
    publishedAt: "2025-10-30T09:20:00.000Z",
    category: "Semiconductors",
    sentiment: "positive",
    symbols: ["NVDA"],
    summary: "The original report, later carried under an update headline by a second outlet.",
  },
  {
    id: "n-023",
    title: "Autonomy software review extended by the safety regulator",
    source: "Policy Desk",
    publishedAt: "2025-10-08T19:00:00.000Z",
    category: "Regulation",
    sentiment: "negative",
    symbols: ["TSLA"],
  },
  {
    id: "n-024",
    title: "Ad platform privacy changes reduce measurable conversions",
    source: "Policy Desk",
    publishedAt: "2025-09-24T13:15:00.000Z",
    category: "Regulation",
    sentiment: "negative",
    symbols: ["META"],
  },
];

/** The feed after de-duplication, newest first. This is what the UI renders. */
export const NEWS_FEED = dedupeNews(RAW_NEWS);

/** Count of stories collapsed by de-duplication, shown in the panel footer. */
export const NEWS_DEDUPE_COUNT = RAW_NEWS.length - NEWS_FEED.length;

export const NEWS_SOURCE_NOTE =
  "Sample coverage written for this demonstration. Not real reporting.";

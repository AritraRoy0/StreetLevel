/**
 * Sample portfolio transaction log.
 *
 * Modelled as a transaction log rather than a holdings snapshot so the
 * portfolio analytics have something real to work with: cost basis, realized
 * profit, cash, external flows and a daily value series all fall out of the
 * replay.
 *
 * The log is arranged to exercise the awkward cases rather than only the happy
 * path. It contains a partial sale, a full exit, two lots of the same name at
 * different prices, a mid-period deposit, a withdrawal, two dividends, and one
 * holding in a symbol the price book does not cover.
 *
 * Execution prices sit within a few cents of the actual close on the trade
 * date in the bundled dataset, so the resulting profit figures are realistic
 * rather than arbitrary.
 */

import type { Transaction } from "@/lib/analytics";

export const TRANSACTIONS: Transaction[] = [
  { id: "t-001", date: "2025-09-02", type: "deposit", amount: 300_000 },

  { id: "t-002", date: "2025-09-03", type: "buy", symbol: "NVDA", shares: 150, price: 170.85, fees: 4.95 },
  { id: "t-003", date: "2025-09-03", type: "buy", symbol: "AAPL", shares: 200, price: 238.6, fees: 4.95 },
  { id: "t-004", date: "2025-09-04", type: "buy", symbol: "MSFT", shares: 60, price: 507.8, fees: 4.95 },
  { id: "t-005", date: "2025-09-08", type: "buy", symbol: "GOOGL", shares: 180, price: 233.9, fees: 4.95 },
  { id: "t-006", date: "2025-09-15", type: "buy", symbol: "AMZN", shares: 90, price: 231.2, fees: 4.95 },

  // A second, higher-priced lot in the same name, so FIFO has something to do.
  { id: "t-007", date: "2025-11-12", type: "buy", symbol: "NVDA", shares: 60, price: 193.55, fees: 4.95 },

  { id: "t-008", date: "2025-12-01", type: "buy", symbol: "META", shares: 45, price: 640.55, fees: 4.95 },
  { id: "t-009", date: "2026-01-07", type: "buy", symbol: "AVGO", shares: 120, price: 343.3, fees: 4.95 },

  // A holding the bundled price book does not cover, to prove an unpriced
  // position is named and excluded from totals rather than valued at zero.
  { id: "t-010", date: "2026-01-20", type: "buy", symbol: "SPY", shares: 20, price: 612.4, fees: 4.95 },

  { id: "t-011", date: "2026-02-02", type: "deposit", amount: 25_000 },
  { id: "t-012", date: "2026-02-03", type: "buy", symbol: "PLTR", shares: 260, price: 157.95, fees: 4.95 },

  // Partial sale: trims the position, banking profit on the oldest lot first.
  { id: "t-013", date: "2026-03-17", type: "sell", symbol: "AAPL", shares: 80, price: 254.1, fees: 4.95 },

  { id: "t-014", date: "2026-04-14", type: "dividend", symbol: "MSFT", amount: 49.8 },
  { id: "t-015", date: "2026-04-28", type: "buy", symbol: "AMD", shares: 100, price: 323.05, fees: 4.95 },

  // Full exit: the position disappears and its profit becomes realized.
  { id: "t-016", date: "2026-05-19", type: "sell", symbol: "GOOGL", shares: 180, price: 387.4, fees: 4.95 },

  { id: "t-017", date: "2026-06-09", type: "withdraw", amount: 15_000 },
  { id: "t-018", date: "2026-06-23", type: "buy", symbol: "TSLA", shares: 70, price: 381.4, fees: 4.95 },
  { id: "t-019", date: "2026-07-21", type: "dividend", symbol: "AAPL", amount: 30 },
  { id: "t-020", date: "2026-08-11", type: "buy", symbol: "NVDA", shares: 25, price: 217.62, fees: 4.95 },
];

export const PORTFOLIO_NOTE =
  "Sample transaction log for demonstration. Replace it with a brokerage export to see your own figures.";

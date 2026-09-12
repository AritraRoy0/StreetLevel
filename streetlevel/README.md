# StreetLevel

A market research workspace built with Next.js. Price analytics, technical
indicators, benchmark comparison and portfolio attribution, all computed from
one validated bar series.

```bash
npm run dev        # development server on http://localhost:3000
npm run build      # production build
npm test           # analytics test suite
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Layout

| Path | Purpose |
| --- | --- |
| `lib/analytics/` | The engine. Pure functions, no React, no network. |
| `lib/market-data.ts` | Data access. Loads and validates the bundled dataset. |
| `lib/analytics-validation.ts` | Request validation and the error contract. |
| `lib/analytics-cache.ts` | In-process TTL cache and rate limiter. |
| `components/charts/` | SVG charts, with geometry split out as pure functions. |
| `components/ui.tsx` | The primitive set: metrics, panels, controls, tables. |
| `docs/analytics.md` | Formulas, edge cases, rounding and null behaviour. |
| `tests/` | 354 tests over the engine, the charts and the API. |

## Pages

- `/` coverage, market aggregates and the news wire
- `/analytics/[symbol]` the single-symbol workspace
- `/portfolio` position and portfolio attribution
- `/signals` rule conditions currently met across the coverage list
- `/performance` every name measured against the SL10 composite

## Data

The bundled dataset is a daily Yahoo Finance download in
`lib/data/historical-prices.json`: ten symbols, 252 sessions, 2 September 2025
to 1 September 2026. Everything the app renders passes through `normalizeBars`
first, so a malformed row is treated exactly as one from a live provider would
be: rejected, counted, and reported in the data-quality banner rather than
allowed to poison a metric.

Because the snapshot is fixed, the app will report itself as behind whenever the
real date has moved on. That is the staleness path working, not a defect.

Intraday intervals are not in the dataset. The interval picker shows them
disabled with the reason, rather than hiding them, and the API returns 422 with
an explanation. Weekly and monthly bars are aggregated from the daily series.

No index series ships with the data, so the house benchmark `SL10` is an
equal-weight composite of the ten covered names, rebased to 100 at inception. It
is labelled as that, not as a proxy for a published index.

The news feed and the portfolio transaction log are illustrative fixtures
written for this demonstration, labelled as such in the UI. Swap
`lib/news-data.ts` and `lib/portfolio-data.ts` for real sources; nothing else
needs to change.

## Analytics API

- `GET /api/analytics/:symbol/history?interval=1d&range=1Y`
- `GET /api/analytics/:symbol/history?start=…&end=…` (ISO-8601 UTC)
- `GET /api/analytics/:symbol/quote`
- `GET /api/analytics/:symbol/summary?range=1Y&interval=1d`
- `GET /api/analytics/quotes?symbols=AAPL,MSFT`

Errors are `{ error: { code, message, action? } }` with a fixed status per code.
See `docs/analytics.md` for the full contract.

## Tests

The suite runs on Node's built-in test runner with type stripping, so it needs
no test framework and no build step:

```bash
npm test
```

This is why the modules inside `lib/analytics` import each other with explicit
`.ts` specifiers, and why `allowImportingTsExtensions` is set in `tsconfig.json`.

RSI and EMA are verified against published reference values and against second
implementations transcribed separately from the formulas. The integration tests
re-derive the headline figures from the raw JSON with inline arithmetic, so the
engine is checked against something other than itself.

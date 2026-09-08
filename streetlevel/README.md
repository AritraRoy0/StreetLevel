This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Analytics API

The analytics routes use the checked-in daily Yahoo Finance dataset in `lib/data/historical-prices.json`. They are Next.js route handlers; this repository does not currently configure MySQL, Firestore, authentication, or a runtime market-data provider.

- `GET /api/analytics/:symbol/history?start=2026-01-01T00:00:00Z&end=2026-09-01T00:00:00Z&interval=1d`
- `GET /api/analytics/:symbol/quote`
- `GET /api/analytics/quotes?symbols=AAPL,MSFT,NVDA`

History responses use UTC timestamps and the normalized `{ timestamp, open, high, low, close, volume }` point shape. Supported intervals are `1m`, `5m`, `15m`, `30m`, `1h`, `1d`, and `1w`; only `1d` is currently backed by the bundled dataset. Invalid symbols, dates, ranges, and intervals return `{ "error": { "code": "...", "message": "..." } }` with HTTP 400.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

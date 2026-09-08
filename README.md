# StreetLevel

**StreetLevel** is a market research and analytics platform designed to turn financial-market noise into a focused view of **signals, context, and decisions worth making**.

The project is being built as a full-stack market analytics application. The current repository contains the Next.js frontend and a local historical-market-data layer, with backend data services and production ingestion planned as the platform evolves.

> **Status:** Active development — frontend and analytics experience are being implemented incrementally.

## Overview

StreetLevel is intended to provide investors and researchers with a single workspace for:

- Market and stock monitoring
- Historical price analysis
- Technical indicators and quantitative signals
- Portfolio and performance analysis
- Configurable alerts and signal rules
- Market/news context
- Normalized market-data APIs
- Eventually, scheduled market-data and news ingestion

The product philosophy is simple:

> **Research, made useful.**

## Current Features

### Market Overview

The main dashboard provides a high-level operating view of the market, including:

- Market pulse and session context
- Portfolio summary
- Active signals and alerts
- Stock leaders and daily movement
- Market/news context
- Signal-board previews
- Interactive stock detail views

### Analytics

The analytics workspace currently supports:

- Sector filtering
- Stock selection
- Historical price series
- Price vs. SMA 20 visualization
- RSI/momentum visualization
- Volatility and drawdown visualization
- Sector-level change
- Average RSI
- 52-week price positioning
- Z-score analysis
- Historical session counts

### Signals

The signals workspace provides a foundation for rule-based market monitoring:

- Bullish / Neutral / Bearish filtering
- Signal rule listings
- Active/paused rule states
- Price and moving-average conditions
- Rule creation UI

### Performance

The performance workspace provides portfolio and market-risk views, including:

- Bullish-name counts
- Average RSI
- Sector performance
- Beta
- Value at Risk (VaR)
- Sharpe ratio
- Maximum drawdown
- Correlation
- Sortino ratio
- Risk-budget and signal-lifetime concepts

## Architecture

StreetLevel is designed around a layered architecture that separates the user interface from market-data storage, ingestion, and analytics.

### Current application

```
Next.js / React
      |
      +-- App Router pages
      |
      +-- Reusable market components
      |
      +-- TypeScript domain types
      |
      +-- Historical market-data layer
```

### Target production architecture

```
                         +----------------------+
                         |   Next.js / React    |
                         |      Frontend        |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         |    Express / Node    |
                         |      REST API        |
                         +----------+-----------+
                                    |
                 +------------------+------------------+
                 |                                     |
                 v                                     v
       +----------------------+              +----------------------+
       |        MySQL        |              |       Firestore      |
       | Historical OHLCV    |              | Latest quote / live  |
       | relational storage  |              | market state         |
       +----------------------+              +----------------------+
                 ^
                 |
       +---------+----------+
       | AWS Lambda /       |
       | EventBridge        |
       | scheduled ingestion|
       +---------+----------+
                 |
                 v
       +----------------------+
       | Market / News        |
       | Data Providers       |
       +----------------------+
```

The target architecture is intended to support historical data, latest quotes, normalized time-series responses, scheduled ingestion, caching, validation, rate-limit protection, and analytics calculations without coupling the frontend directly to external providers.

## Technology Stack

### Frontend

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **Lucide React**
- **Vercel Analytics**

### Planned backend and infrastructure

- **Node.js / Express**
- **MySQL** — historical market data
- **Firestore** — latest-quote / real-time market state
- **AWS Lambda** — scheduled/background ingestion
- **AWS EventBridge** — scheduled jobs
- External market-data and news providers

## Project Structure

The application currently lives under the `streetlevel/` directory.

```
streetlevel/
├── app/
│   ├── analytics/
│   │   └── page.tsx
│   ├── performance/
│   │   └── page.tsx
│   ├── signals/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── footer.tsx
│   ├── market-ui.tsx
│   ├── nav.tsx
│   ├── overview-view.tsx
│   └── stock-detail-modal.tsx
│
├── lib/
│   ├── data/
│   │   └── historical-prices.json
│   ├── market-data.ts
│   ├── mock-data.ts
│   ├── types.ts
│   └── utils.ts
│
├── public/
├── AGENTS.md
├── next.config.ts
├── package.json
├── postcss.config.mjs
└── tsconfig.json
```

## Market Data

The current frontend uses a local historical-price dataset:

- Historical OHLCV observations are stored in `lib/data/historical-prices.json`.
- `lib/market-data.ts` normalizes the raw records into application-level `StockItem` and `HistoricalPoint` objects.
- Technical metrics are currently calculated locally from the historical series.

The current analytics layer derives metrics such as:

- Daily percentage change
- SMA 20
- SMA 50
- RSI
- Annualized volatility
- Drawdown
- Z-score
- Bollinger-band position
- Basic sentiment classification

The production data layer will replace or supplement this local dataset with validated provider data and persistent storage.

## Shared Data Types

Core domain types are defined in `lib/types.ts`.

Important interfaces include:

- `StockItem`
- `HistoricalPoint`
- `NewsItem`
- `PortfolioPosition`
- `AlertRule`

Keeping these types centralized allows the frontend and future API layer to share a consistent representation of market data.

## Getting Started

### Prerequisites

- Node.js 20+ recommended
- npm

### Install dependencies

From the `streetlevel/` directory:

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

### Available routes

| Route | Description |
|---|---|
| `/` | Market overview |
| `/analytics` | Historical and technical analytics |
| `/signals` | Signal rules and market signals |
| `/performance` | Performance and risk analysis |

## Available Scripts

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

## Development

### TypeScript

StreetLevel uses TypeScript throughout the application. Shared interfaces should be added to `lib/types.ts` when they represent application-level domain objects.

### Components

Reusable UI elements belong in `components/`. Pages under `app/` should primarily compose these reusable components rather than duplicating UI logic.

### Market calculations

Market calculations should remain deterministic and testable. As the backend data layer is introduced, provider-specific response formats should be normalized before data reaches the frontend.

## Data-Layer Roadmap

The next major stage of development is moving from local/mock data toward a production-ready market-data service.

Planned capabilities include:

1. **API endpoints**
   - Historical OHLCV
   - Latest quotes
   - Normalized time-series responses
   - Symbol metadata

2. **Validation**
   - Symbol validation
   - Date-range validation
   - Interval validation
   - Request limits
   - Consistent error responses

3. **Historical storage**
   - MySQL OHLCV tables
   - Indexed symbol/date queries
   - Deduplication and upsert behavior

4. **Latest quotes**
   - Firestore-backed latest market state
   - Fast reads for dashboard experiences
   - Clear quote freshness metadata

5. **Time-series processing**
   - Interval normalization
   - Aggregation
   - Downsampling for large chart ranges
   - Consistent timestamp handling
   - UTC/internal normalization with market-session awareness

6. **Reliability**
   - Server-side caching
   - Provider rate-limit protection
   - Retry/backoff behavior
   - Empty, loading, and error states
   - Stale-data detection

7. **Analytics**
   - Returns
   - Volatility
   - RSI
   - Moving averages
   - CAGR
   - Drawdown
   - Additional portfolio and risk metrics

## Provider Strategy

StreetLevel is designed to avoid unnecessary direct provider calls from the browser.

The intended flow is:

```
Browser
   |
   v
StreetLevel API
   |
   +--> Cache
   |
   +--> MySQL
   |
   +--> Firestore
   |
   +--> External provider (when necessary)
```

This approach provides a single normalized contract to the frontend while reducing provider usage, improving latency, and making rate-limit management possible in one place.

## Testing

Testing is part of the implementation roadmap and should cover both isolated components and end-to-end data flows.

Planned coverage includes:

- Unit tests for market calculations
- Unit tests for validation and normalization
- API integration tests
- Database integration tests
- Provider failure/rate-limit tests
- Component tests
- Analytics page integration tests
- Loading, empty, and error-state tests

## Deployment

The frontend is structured as a Next.js application and can be deployed to a Next.js-compatible hosting platform such as Vercel.

Production deployment will additionally require configuration for:

- Market-data provider credentials
- News provider credentials
- MySQL connection details
- Firestore credentials/configuration
- AWS Lambda/EventBridge jobs
- Application environment variables
- Cache configuration

**Never commit API keys, service-account credentials, database passwords, or other secrets to the repository.**

## Environment Variables

The production application will use environment variables for external services. The exact variable names should be documented as each integration is implemented.

A local environment file can be used for development:

```bash
.env.local
```

Keep secrets out of source control.

## Design Principles

StreetLevel follows a few core engineering principles:

- **Data should be normalized at the boundary.**
- **The frontend should not depend on provider-specific response formats.**
- **Historical and latest-market data have different storage/read requirements.**
- **Provider usage should be rate-limit aware.**
- **Timestamps should be explicit and timezone-safe.**
- **Analytics calculations should be deterministic and testable.**
- **Loading, empty, stale, and error states are first-class product states.**
- **Shared TypeScript types should define the contract between layers.**
- **UI components should remain reusable and composable.**

## Disclaimer

StreetLevel is a software project for market research and analytics. Information displayed by the application is for informational and research purposes and is **not financial, investment, tax, or legal advice**.

Market data may be delayed, incomplete, inaccurate, or subject to provider limitations. Users should independently verify information before making financial decisions.

## License

License information has not yet been finalized for this project.

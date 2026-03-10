# CashFlow

A local-first personal finance app built with Next.js and SQLite. All your data stays on your machine — no cloud accounts, no subscriptions, no third-party access to your financial data.

## Features

### Core
- **Transaction Management** — Import CSV bank statements with auto-detection of column formats, bulk editing, and deduplication
- **Accounts & Categories** — Multi-account support (checking, savings, credit, investment) with hierarchical categories and budgets
- **Merchant Aliases** — Map messy bank descriptions to clean names with fuzzy matching, auto-applied on import
- **Categorization Rules** — Conditional rules engine for auto-categorizing transactions by description, amount, or account with regex support

### Budgeting & Bills
- **Budgets** — Set monthly/weekly/annual budgets per category with historical spending averages to guide your targets
- **Recurring Detection** — Automatically identifies subscriptions and recurring charges from your transaction history
- **Scheduled Bills** — Track upcoming bills with paid/overdue status detection by matching against actual transactions

### Analysis
- **Dashboard** — Spending overview with category breakdown charts, recent transactions, and bills widget
- **Reports** — Spending by category, monthly trends, income vs. expenses, net worth over time, and year-over-year comparison
- **AI Insights** — Natural language queries, anomaly detection, spending forecasts, and budget suggestions powered by Claude CLI
- **Bank Reconciliation** — Match your records against bank statements

### Organization
- **Tags** — Flexible labels for cross-cutting concerns (e.g. tax-deductible, reimbursable)
- **Split Transactions** — Split a single transaction across multiple categories with balance validation
- **CSV Export** — Export filtered transactions to CSV
- **Duplicate Detection** — Find and review potential duplicate transactions

## Tech Stack

- **Next.js 15** (App Router, Turbopack)
- **SQLite** via better-sqlite3 (WAL mode, local file)
- **TypeScript**
- **Tailwind CSS v4** (dark theme)
- **Recharts** for visualizations
- **Radix UI** primitives
- **Vitest** for testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or another package manager
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (optional, for AI features)

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database (`cashflow.db`) is created automatically in the project root on first run with default categories seeded.

### Build

```bash
npm run build
npm start
```

### Test

```bash
npm test            # run once
npm run test:watch  # watch mode
```

102 tests covering CSV parsing, export, duplicate detection, recurring detection, split validation, bill logic, rules engine, and YoY reporting.

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── accounts/
│   │   ├── ai/           # Claude-powered insights
│   │   ├── aliases/
│   │   ├── bills/
│   │   ├── budgets/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   ├── import/
│   │   ├── reconciliation/
│   │   ├── reports/
│   │   ├── rules/
│   │   ├── tags/
│   │   └── transactions/
│   ├── budgets/
│   ├── dashboard/
│   ├── import/
│   ├── insights/
│   ├── reconcile/
│   ├── reports/
│   ├── settings/
│   ├── subscriptions/
│   └── transactions/
├── components/
│   ├── sidebar.tsx
│   └── ui/               # Reusable UI components
└── lib/
    ├── ai.ts             # Claude CLI integration
    ├── alias-engine.ts   # Merchant matching
    ├── csv-export.ts
    ├── csv-parser.ts
    ├── db.ts             # SQLite schema & connection
    ├── duplicate-detector.ts
    ├── recurring-detector.ts
    ├── rules-engine.ts
    ├── utils.ts
    └── __tests__/        # Vitest test files
```

## Data Privacy

CashFlow stores everything in a local SQLite file. Nothing is sent to external servers. The optional AI features use the Claude CLI running locally on your machine — your data is sent to Anthropic's API only when you explicitly use AI features (insights page).

## License

MIT

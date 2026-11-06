<div align="center">
<img width="150" height="150" alt="N (6)" src="https://github.com/user-attachments/assets/05bf21c1-922b-4a95-8423-ab0964946029" />



<h1>Stoic Budget</h1>

<p align="center">
  :globe_with_meridians: <a href="https://github.com/stoic-budget/stoic-budget/releases/latest">Download</a> · :book: <a href="https://stoic-budget.github.io/stoic-budget/">Documentation</a>
</p>

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](.github/CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20%7C%206.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Release](https://img.shields.io/github/v/release/stoic-budget/stoic-budget?style=for-the-badge)](https://github.com/stoic-budget/stoic-budget/releases/latest)

**Open-source financial data platform for importing, processing, and analyzing bank statements**


[Quick Start](#quick-start) • [Docs](https://stoic-budget.github.io/stoic-budget/) • [Features](#features) • [Supported Banks](#supported-banks) • [Architecture](https://stoic-budget.github.io/stoic-budget/docs/architecture/overview) • [Contributing](.github/CONTRIBUTING.md)

</div>

<div align="center">

<img width="1890" height="887" alt="Overview dashboard: month budgets, income, spending, net and savings rate, top categories and recent transactions" src="https://github.com/user-attachments/assets/2f7fec9e-83da-4ebd-b80d-c6f2c8ae3c46" />


<br /><br />

<table>
<tr>
<td width="50%"><img width="1892" height="886" alt="Documents list: receipts with merchant, category, amount and approval status" src="https://github.com/user-attachments/assets/256ae873-93b5-47e8-bdbc-eb2f53f0799e" />
</td>
<td width="50%"><img width="1889" height="888" alt="Crypto portfolio: balance chart, holdings with profit and connected Ethereum and Tron wallets" src="https://github.com/user-attachments/assets/6d1130c6-b33e-4326-ac12-1eaf7408230c" />
</td>
</tr>
<tr>
<td width="50%"><img width="1891" height="882" alt="Cash-flow forecast: runway, lowest point and shortfall over the next 90 days" src="https://github.com/user-attachments/assets/b655215b-989f-483d-91bc-72ac457658c9" />
</td>
<td width="50%"><img width="1887" height="884" alt="Custom table of invoices with typed columns, paid checkboxes and statuses" src="https://github.com/user-attachments/assets/746cca0a-4c0e-43c5-8003-10cf251d13b2" />
</td>
</tr>
<tr>
<td colspan="2" align="center"><img width="1893" height="886" alt="Budgets with the Stoic balance: planned versus actual spending across necessity, work, virtue and leisure" src="https://github.com/user-attachments/assets/6b834d00-8a9b-43e3-b144-fb1262696984" />

</td>
</tr>
</table>

</div>


---

[![Maintainability](https://qlty.sh/gh/symonbaikov/projects/seneca/maintainability.svg)](https://qlty.sh/gh/symonbaikov/projects/seneca)
[![Code Coverage](https://qlty.sh/gh/symonbaikov/projects/seneca/coverage.svg)](https://qlty.sh/gh/symonbaikov/projects/seneca)
[![GitHub Stars](https://img.shields.io/github/stars/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/stoic-budget/stoic-budget?style=flat-square&logo=github)](https://github.com/stoic-budget/stoic-budget/issues)

---

> **TL;DR**
>
> - Upload bank statements (PDF / CSV / XLSX / OFX / QIF / MT940 / CAMT.053 / image) → auto-parse → deduplicate → categorize → review
> - Private by default: your data stays on your machine or server, no bank login required, and the server never sends your data to an external AI model
> - Workspaces for yourself, your household or your team — roles, private transactions, audit log and one-click rollback
> - Full stack running locally in one command: `npm run setup:dev`
>
> Built for people who want to understand their money without handing their bank data to someone else's cloud — and for freelancers, small businesses, accountants and developers who need the same control. Self-hosted, open source, no proprietary SaaS lock-in.

---

## 📢 Wanted: real bank statements for parser development

Stoic Budget's parsers are only as good as the statements they were tested on. **I'm looking for people willing to share bank statements** — any bank, any country, any format (PDF, CSV, XLSX, OFX, MT940, CAMT.053, a phone screenshot) — so I can write and test parsers for them.

- **Redact what you like.** Names, account numbers, addresses and counterparties can be blacked out or replaced; the parser needs the layout, the columns and the way dates and amounts are written, not your data. A statement with a handful of rows is enough.
- **Your files stay private.** They are used only to build and test the parser. The originals are never committed to this repository — test fixtures that land in the repo are anonymized first.
- **Even one statement helps**, especially from banks that are not yet in [Supported Banks](#supported-banks).

📧 Send them to **[peterbaikov12@proton.me](mailto:peterbaikov12@proton.me)** — please mention the bank, the country and how you exported the file.

---
<p align="center">
  <a href="https://bank.gov.ua/en/news/all/natsionalniy-bank-vidkriv-rahunok-dlya-gumanitarnoyi-dopomogi-ukrayintsyam-postrajdalim-vid-rosiyskoyi-agresiyi" target="_blank">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg"
      alt="Ukraine Flag"
      width="520"
      height="120"
    /><br/>
    <strong>Humanitarian Aid for Ukraine</strong><br/>
    Support humanitarian relief via the official National Bank of Ukraine account.
  </a>
</p>


---

## Features

Stoic Budget is a full-stack platform for importing, categorizing and analyzing bank statement data — on your own for personal finances, or together with a partner, an accountant or a team.

### Get your data in

- **Any statement file** — PDF, CSV, XLSX / XLS, DOCX, OFX / QFX, QIF, MT940, CAMT.053, or a photo of a statement (OCR). Native PDF parsers for 36 banks, CSV presets for 20+ banks and fintechs, and a generic table reader for any other PDF — see [Supported Banks](#supported-banks).
- **Teach the parser** — when a PDF layout is not recognised, mark its columns on the page once; the next statement from that bank is read by itself.
- **No double imports** — the same file is recognised by its hash, and rows repeated across overlapping statements are flagged as duplicates to merge or dismiss.
- **Format-change checks** — when a bank changes its statement layout, the import says so instead of quietly reading it wrong.
- **Bank sync with your own provider account** — SimpleFIN Bridge (US, Canada) or Enable Banking (EU / EEA); pulled rows go through the same import as an uploaded file.
- **Receipts** — from a mailbox (IMAP), a phone photo, Telegram or by hand; merchant, amount, tax and line items are read and matched to the bank row that paid them.

### Sort it out

- **Review queue** — every new row waits until you confirm it; only confirmed rows count in reports, budgets and the ledger. A statement folds into one line, and a payee's rows can be filed in one go.
- **Categorization without AI** — your rules first, then the category the payee was filed under before. Nothing is ever sent to an external AI model.
- **Rules** — an ordered list of conditions on payee, amount, account and direction, with suggestions drawn from your history.
- **Accounts, categories and tags** — bank accounts and wallets with balances linked to their statements, nested categories, and tags across everything.

### Understand your money

- **Dashboard** — this month's budgets, income, spending, net and savings rate, top categories, cash flow as a chart, calendar or flow, recent transactions and upcoming charges; pick which sections show.
- **Reports** — cash flow, trends, spend flow, tax year and your own report templates, on a schedule if you like; export to CSV, XLSX or PDF.
- **Budgets** — monthly limits per category in any currency, plus the Stoic balance: planned versus actual spending across necessity, work, virtue and leisure.
- **Subscriptions and bills** — recurring charges found automatically, what is paid and still due this month, bills to pay and money to receive.
- **Forecast** — the next 90 days from paydays, bills, subscriptions and receivables: runway, lowest point and safe-to-spend, with a note when history is too short to trust it.
- **Goals and net worth** — savings goals fed by real transactions, and net worth across accounts, investments, precious metals and crypto.
- **Crypto and investments** — wallets on Ethereum, Base, Arbitrum, Optimism, Polygon, Tron, Bitcoin and Solana kept in sync, investment accounts, metal lots and a returns page.
- **Advice** — observations and suggestions computed from your own numbers.

### Taxes and small business

- **Invoicing** — clients, itemized invoices with tax per line, PDFs, recurring invoices and credit notes; e-invoices in XRechnung, Peppol BIS and ZUGFeRD / Factur-X, sent and received over Peppol.
- **Payables and receivables** — matched against statement rows, with ageing and payment reminders.
- **VAT** — rates, rules and returns, EU VAT numbers checked against VIES, reminders before deadlines.
- **Income tax drafts** — Germany (Anlage EÜR), Spain (Modelo 100), Poland (PIT-36L / PIT-28 / PIT-36) and a generic summary elsewhere, built only from the mappings you confirm.
- **For your accountant** — a tax pack with the year's rows and every receipt behind them, and a DATEV export for Germany and Austria.
- **Double-entry ledger** (opt-in) — every transaction posted as a balanced entry; trial balance, profit and loss, balance sheet and reconciliation against statements.

### Work together

- **Workspaces** — for yourself, a household or a team, with invitations and roles: owner, admin, member, viewer and accountant (reads everything, changes nothing).
- **History you can undo** — an audit log with one-click rollback, and nightly versions of the workspace you can open read-only or restore as a new one.

### Your server, your rules

- **Self-hosted** — Docker Compose in one command, encrypted scheduled backups, file storage with folders and S3 / WebDAV sync.
- **Secure accounts** — two-factor authentication, per-device sessions, private transactions.
- **Connect your tools** — API keys, webhooks, an MCP server for AI agents and a Telegram bot for reports, quick expenses and receipt photos.
- **Comfortable to use** — 35 languages, light and dark themes, a privacy mode that hides amounts on screen, a command palette with keyboard shortcuts, and an installable app that keeps working offline.

---

## What Stoic Budget is NOT

Setting expectations upfront:

- **Not a bank integration** — Stoic Budget holds no bank integration of its own: it parses statement files you export from your bank. If you hold your own account with a data provider (SimpleFIN Bridge for the US and Canada, Enable Banking for the EU/EEA), you can connect it under Integrations and Stoic Budget pulls your statements through the same import; Stoic Budget itself never talks to a bank and holds no provider contract. That arrangement is also the only one in which this is free: every provider's free tier covers the accounts the person who linked them can see, which is why a workspace may hold one connection per person. A wallet's feed can be moved to another provider without losing its history.
- **Not an accrual accounting suite** — The ledger records what your statements and manual entries say. There is no automatic accrual, depreciation schedule, or period-end closing workflow.
- **Not a filing service or tax adviser** — Stoic Budget computes tax figures and drafts VAT and income tax documents, but it does not submit anything to a tax authority on your behalf. An income tax draft is not tax advice — check it before you file.
- **Not a replacement for accounting software** — Stoic Budget keeps double-entry books of your bank activity and issues invoices, but it does not run payroll or file statutory reports. Use it next to QuickBooks, Xero, or 1C rather than instead of them.

---

## Supported Banks

| Country | Native PDF parser | CSV preset |
|---|---|---|
| 🇺🇸 United States | Ally Bank, Associated Bank, BECU, BMO, Capital One, Cash App, Charles Schwab, Chase, Chime, Citizens, Comerica, Commerce Bank, Credit One, DCU | Chase, Bank of America, Capital One, American Express, Wells Fargo |
| 🇬🇧 United Kingdom | Barclays, Bank of Scotland | Monzo, Starling, Santander UK, Barclays, HSBC, Lloyds |
| 🇩🇪 Germany | | N26, Sparkasse / DKB, Commerzbank |
| 🇳🇱 Netherlands | | ING, Rabobank |
| 🇸🇪 🇩🇰 🇳🇴 🇫🇮 Nordics | | Nordea |
| 🇫🇷 France | Crédit Agricole | |
| 🇵🇱 Poland | BNP Paribas Bank Polska | |
| 🇨🇦 Canada | ATB Financial, CIBC, Coast Capital | |
| 🇦🇺 Australia | ANZ, Bendigo Bank, BOQ, CommBank | |
| 🇿🇦 South Africa | Absa, Capitec | |
| 🇮🇳 India | Axis Bank, Citibank | |
| 🇧🇷 Brazil | Banco do Brasil | |
| 🇭🇰 Hong Kong | Bank of China (Hong Kong) | |
| 🇵🇭 Philippines | BPI | |
| 🇱🇰 Sri Lanka | Commercial Bank of Ceylon | |
| 🇮🇱 Israel | Bank Hapoalim / Isracard (Hebrew) | |
| 🇰🇿 Kazakhstan | Kaspi Bank, Bereke Bank (new and legacy formats) | |
| 🌍 International | | Revolut, Wise, PayPal |
| — | | T-Bank (Tinkoff) |

**Any other bank:** CSV with delimiter detection, XLSX / XLS, DOCX tables, OFX / QFX, QIF, MT940, CAMT.053, any PDF through the generic table reader, and images (PNG / JPG) through OCR.

Your bank is missing or parses badly? See [Wanted: real bank statements](#-wanted-real-bank-statements-for-parser-development).

---

## Quick Start

You need Node.js 22.18+ and Docker with Compose. Ports `3000` and `3001` must be free.

```bash
git clone https://github.com/stoic-budget/stoic-budget.git
cd stoic-budget
npm run setup:dev
```

`npm run setup:dev` asks which development mode you want, then prepares env files, starts PostgreSQL and Redis, runs database migrations, seeds a demo user, and starts the app. Once it is up:

- **App:** http://localhost:3000
- **Demo login:** `demo@seneca.dev` / `demo123`

No Docker? See [Local Development](https://stoic-budget.github.io/stoic-budget/docs/getting-started/local-development). Before exposing it beyond localhost, read [Configuration](https://stoic-budget.github.io/stoic-budget/docs/getting-started/configuration).

### Run prebuilt images (no local build)

CD publishes `ghcr.io/stoic-budget/stoic-budget-backend` and `ghcr.io/stoic-budget/stoic-budget-frontend` for every release. To start the production stack without building anything locally:

```bash
npm run setup:env
docker compose pull
docker compose up -d
```

`IMAGE_TAG` in `.env` pins a specific release (defaults to the newest one). To update later, run `make upgrade`; see [Upgrading](https://stoic-budget.github.io/stoic-budget/docs/deployment/docker#upgrading).

---

## Documentation

| Document | Description |
|---|---|
| [stoic-budget.github.io/stoic-budget](https://stoic-budget.github.io/stoic-budget/) | Documentation site, built from `website/` |
| [Quick Start](https://stoic-budget.github.io/stoic-budget/docs/getting-started/quick-start), [Local Development](https://stoic-budget.github.io/stoic-budget/docs/getting-started/local-development) | Every way to run it, startup troubleshooting |
| [Configuration](https://stoic-budget.github.io/stoic-budget/docs/getting-started/configuration) | Environment variables, product name, admin user |
| [Makefile Commands](https://stoic-budget.github.io/stoic-budget/docs/reference/makefile) | Every `make` target |
| [Security posture](https://stoic-budget.github.io/stoic-budget/docs/guides/security-posture) | Threat model, sessions, what is encrypted, what leaves your server |
| [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) | How to contribute — workflow, code style, PR process |
| [.github/SECURITY.md](.github/SECURITY.md) | Security policy, vulnerability reporting, disclosure process |
| [.github/CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md) | Community guidelines |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [docs/ui-principles.md](docs/ui-principles.md) | UI stability principles the product follows |
| [website/docs/](website/docs/) | Documentation site: getting started, guides, architecture, API and deployment reference |
| [docs/plans/](docs/plans/) | Feature design and implementation plan documents |
| [docs/CI/](docs/CI/) | CI/CD pipeline documentation |
| [docs/security/](docs/security/) | CVE allowlists and license exceptions |

Interactive API documentation: http://localhost:3001/api/docs (when backend is running).

---

## Contributing

We welcome contributions from the community: bug reports, feature requests, documentation fixes, pull requests, [new bank parsers](https://stoic-budget.github.io/stoic-budget/docs/contributing/adding-a-bank-parser), [a bank statement to test against](#-wanted-real-bank-statements-for-parser-development), and translations of the 35 UI locales (`*.content.ts` dictionaries).

Start with [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md), then see [Development Workflow](https://stoic-budget.github.io/stoic-budget/docs/contributing/development-workflow), [Testing](https://stoic-budget.github.io/stoic-budget/docs/contributing/testing) and [Coding Standards](https://stoic-budget.github.io/stoic-budget/docs/contributing/coding-standards).

---

## Community

- **GitHub Discussions** — ask questions, share ideas, get help
- **GitHub Issues** — report bugs or request features
- **Star this repo** — helps others discover the project

---

## Security

Security is a top priority. Please read [.github/SECURITY.md](.github/SECURITY.md) for supported versions, the vulnerability disclosure process, and security best practices.

**Found a security issue?** Report it privately through [GitHub Security Advisories](../../security/advisories/new), not in public issues.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built on great open-source foundations:

[NestJS](https://nestjs.com/) · [Next.js](https://nextjs.org/) · [PostgreSQL](https://www.postgresql.org/) · [TypeORM](https://typeorm.io/) · [Redis](https://redis.io/) · [MUI](https://mui.com/) · [Emotion](https://emotion.sh/) · [TanStack Table](https://tanstack.com/table) · [ECharts](https://echarts.apache.org/) · [Recharts](https://recharts.org/) · [Tesseract.js](https://tesseract.projectnaptha.com/) · [Socket.IO](https://socket.io/) · [Intlayer](https://intlayer.org/) · [driver.js](https://driverjs.com/) · [Biome](https://biomejs.dev/) · and many more.

The cash flow, net worth, category and ROI charts follow the chart design of [Aurum](https://github.com/ZProger/Aurum) by [ZProger](https://github.com/ZProger). They were reimplemented for Stoic Budget; no Aurum source code is included (Aurum is licensed under PolyForm Noncommercial 1.0.0).

---

<div align="center">

**[back to top](#stoic-budget)**

Made with care by the Stoic Budget community

</div>

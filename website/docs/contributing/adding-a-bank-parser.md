---
title: Adding a Bank Parser
description: Extend the parsing pipeline with a new bank format
---

A bank's parser lives in `backend/src/modules/parsing/parsers`, extends `GenericPdfParser` and keeps only what is that
bank's alone: how to recognise it, payee clean-up, splitting accounts. Anything another bank could print the same way
(a date or amount shape, a header wording, a layout or OCR quirk, a currency hint) goes into the generic helpers under
`backend/src/modules/parsing/helpers` with a unit test, so every new bank leaves the generic parser better.

For a CSV export, add a column preset to `parsers/csv-presets.ts`; it needs no parser class.

## 1. Inspect the input

- Collect multiple statement samples
- Identify stable headers and line item formats
- Note currency, date, and locale differences
- Run the golden suite (`npm --prefix backend run test:golden`), so you know it is green before you start

## 2. Add a parser class

Create `backend/src/modules/parsing/parsers/<bank>.parser.ts`. `absa.parser.ts` is a short example:

- Extend `GenericPdfParser`
- Implement `canParse(bankName, fileType, filePath, cachedText?)`: claim only this bank's own PDF, when `bankName` is
  this bank or `BankName.OTHER`
- Override `parse(filePath, cachedText?)` only to add what the generic reading cannot know: call `super.parse`, then
  fill in what the bank's header tells, such as the account number
- Log volumes and outcomes only — never transaction contents

## 3. Register the parser

- Add a value to the `BankName` enum in `backend/src/entities/bank-name.ts`
- The column is the Postgres enum `bank_name_enum`, so add a migration that extends it — see
  `backend/src/migrations/1787850000000-AddCommBankBankName.ts`:
  `ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS '<bank>'`
- Add the parser to `createParsers()` and `FALLBACK_CLAIMS` in `parsing/services/parser-registry.ts`
- Add the name the bank prints to `parsing/helpers/pdf-layout-fingerprint.helper.ts`
- Add the display name to `backend/src/modules/dashboard/bank-display-names.ts`,
  `frontend/app/(main)/accounts/account-types.ts` and `frontend/app/settings/profile/components/SyncSection.tsx`, and
  a logo to `frontend/app/bank-logos/index.ts` if you have one

## 4. Add tests and fixtures

- The parser's spec goes in `backend/@tests/unit/modules/parsing/parsers/<bank>.parser.spec.ts`; also add the parser to
  the list in `backend/@tests/unit/modules/parsing/services/parser-factory.service.spec.ts`
- Golden samples live in `backend/golden/<bank>/` as an input file next to its `.expected.json`. They are anonymized
  copies: `backend/scripts/anonymize_statement_pdf.py` rewrites a PDF's text and keeps its layout (its header explains
  the options), and the real statement stays in the git-ignored `backend/golden-private/`
- Record the expected output:

```bash
cd backend
npm run golden:record -- golden/<bank>/sample1.pdf
```

## 5. Verify

```bash
npm --prefix backend run test:golden    # the whole suite: every bank stays green
npm --prefix backend run test:parsing   # parsing regression spec
```

Then import a sample file through the UI.

## 6. Document the support

Add the bank to [Supported Banks](../reference/supported-banks) and to the table in the README.

## Debugging scripts

```bash
cd backend

# Print what the parsers read from a file
npm run parse:debug -- /path/to/statement.pdf

# Dump the raw PDF table structure, useful for a new bank format
# (writes <file>.tables.json unless you pass an output path)
npm run parse:tables -- /path/to/statement.pdf

# Compare the parsing output of a file with an expected result
npm run parse:diff -- /path/to/statement.pdf /path/to/expected.json
```

Next: [Deployment](../deployment/docker)

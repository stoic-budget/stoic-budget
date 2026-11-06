---
title: Adding a Bank Parser
description: Extend the parsing pipeline with a new bank format
---

Bank-specific parsers live in `backend/src/modules/parsing/parsers`. Add a new parser when you want first-class
support for a PDF layout or CSV export.

## 1. Inspect the input

- Collect multiple statement samples
- Identify stable headers and line item formats
- Note currency, date, and locale differences

## 2. Add a parser class

Create `backend/src/modules/parsing/parsers/<bank>.parser.ts`:

- Extend `BaseParser`, which implements `IParser`
- Implement `canParse(bankName, fileType, filePath, cachedText?)` and `parse(filePath, cachedText?)`; `parse`
  returns a `ParsedStatement`
- Use the number normalization helpers on `BaseParser`
- Log volumes and outcomes only — never transaction contents

## 3. Register the parser

- Add a value to the `BankName` enum in `backend/src/entities/statement.entity.ts`
- The column is the Postgres enum `bank_name_enum`, so add a migration that extends it — see
  `backend/src/migrations/1764700000000-AddHapoalimBankName.ts`:
  `ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS '<bank>'`
- Add the parser to the list in `ParserFactoryService` (`parsing/services/parser-factory.service.ts`)
- Extend bank detection in the same service (`detectBankByName` / `detectBankByBic`)

## 4. Add tests and fixtures

- Specs live under `backend/@tests` as `*.spec.ts`; see `backend/@tests/integration/hapoalim-parser-test.spec.ts`
- Parser fixtures go in `backend/@tests/fixtures/parsing`; keep them small and anonymized
- Golden samples live in `backend/golden/<bank>/` as an input file next to its `.expected.json`; record the
  expected output with `npm --prefix backend run golden:record`
- Real statement examples for manual checks are in `docs/statements-examples`

## 5. Verify

```bash
npm --prefix backend run test:golden    # sets GOLDEN_ENABLED=1
npm --prefix backend run test:parsing   # parsing regression spec
```

Then import a sample file through the UI.

## 6. Document the support

Add the bank to [Supported Banks](../reference/supported-banks).

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

---
title: Importing Statements
description: Uploads, supported formats, and validation
---

Stoic Budget accepts multiple statement formats and standardizes them into a consistent transaction model.

## Supported inputs

- PDF — native parsers for supported banks, and a generic table parser for the rest
- CSV, XLSX and XLS exports
- DOCX files with statement tables
- Images (JPG, PNG, TIFF, BMP, WEBP) via OCR

Each file may be up to 10 MB, and one upload request takes up to 5 files. See
[Supported Banks](../reference/supported-banks) for the native parsers.

Files can also come in without a manual upload: S3-compatible and WebDAV storage sync, an IMAP inbox
for receipts and invoice attachments. CSV and Excel files can also be imported into a custom table.
See [Integrations](integrations).

## Import flow

1. Upload a file from the Statements page.
2. Stoic Budget checks the file hash, then parses the file in a background queue, picking a parser by
   bank and file type.
3. The import preview shows the parsed rows and any conflicts.
4. Resolve each conflict — skip it, import it anyway, or mark it as a duplicate.
5. Commit to write the transactions to the workspace.

## Validation and dedup

- A SHA-256 hash identifies a statement file that was already uploaded.
- Each transaction gets a fingerprint built from the account, date, amount, currency and direction;
  rows that match existing transactions are flagged as conflicts.
- Conflicts are resolved manually in the preview.

## Broker statements (Revolut)

A Revolut account statement (stocks) or profit and loss statement is no bank
statement: uploading one as a statement is refused. Import it as trades
instead: on **Net worth**, under Holdings → Investments and retirement, **Import trades** and pick the PDF.

- The account statement gives the buys, sells and splits (the ratio read from
  the holdings at the end) and a cash holding per currency ("USD cash"): the
  statement's opening cash, then every top-up, withdrawal, buy, sale, dividend
  and fee. Importing next month's statement adds only what changed.
- The profit and loss statement gives the dividends, gross, with the tax
  withheld as their fee. The account statement's dividend lines move cash only,
  so importing both does not count a dividend twice.
- Units held before the statement are not imported (their cost is not in it):
  the preview says how many, and an earlier statement fills them in.
- Import statements oldest first. A statement older than one already imported
  leaves the cash as it is: the newer statement's opening cash already counts
  what it moved.
- A cash holding you made yourself keeps its asset class and price: set it to
  cash, at 1, or let the import create "USD cash".

## Tips

- Use the same export date range for consistent results.
- Upload one account per file when possible.
- If a bank is unsupported, use a CSV/XLSX export or let the generic PDF parser try.

![An imported statement: balances checked against the bank, rows grouped by payee with their categories](/img/screenshots/statement-review.png)

Next: [Workspaces and RBAC](workspaces-and-rbac)

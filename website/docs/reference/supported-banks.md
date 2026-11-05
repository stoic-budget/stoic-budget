---
title: Supported Banks
description: Statement format support matrix
---

Stoic Budget includes bank-specific parsers plus generic fallbacks.

## Native PDF support

- **Australia:** ANZ, Bendigo Bank, BOQ, CommBank
- **Brazil:** Banco do Brasil
- **Canada:** ATB Financial, CIBC, Coast Capital
- **France:** Crédit Agricole
- **Hong Kong:** Bank of China (Hong Kong)
- **India:** Axis Bank, Citibank
- **Israel:** Bank Hapoalim / Isracard (Hebrew)
- **Kazakhstan:** Kaspi Bank; Bereke Bank, old and new PDF layouts
- **Philippines:** BPI
- **Poland:** BNP Paribas Bank Polska
- **South Africa:** Absa, Capitec
- **Sri Lanka:** Commercial Bank of Ceylon
- **United Kingdom:** Barclays, Bank of Scotland
- **United States:** Ally Bank, Associated Bank, BECU, BMO, Capital One, Cash App, Charles Schwab, Chase, Chime,
  Citizens, Comerica, Commerce Bank, Credit One, DCU

## CSV presets

Column layouts matched by the file's header row:

- **International:** Revolut, Wise, PayPal
- **Germany:** N26, Sparkasse / DKB, Commerzbank
- **Netherlands:** ING, Rabobank
- **Nordics:** Nordea
- **United Kingdom:** Monzo, Starling, Santander UK, Barclays, HSBC, Lloyds
- **United States:** Chase, Bank of America, Capital One, American Express, Wells Fargo
- T-Bank (Tinkoff)

## Generic support

- CSV exports (delimiter detection)
- XLSX / XLS exports
- DOCX tables
- OFX / QFX, QIF, MT940 and CAMT.053 files
- Images and scanned documents through OCR
- Any other PDF through the generic table parser, which reads transaction tables from the PDF text layer

## Adding a new bank

See [Adding a Bank Parser](../contributing/adding-a-bank-parser) for the recommended workflow.

If you have sample statements, open a GitHub issue with anonymized files to help maintainers add support.

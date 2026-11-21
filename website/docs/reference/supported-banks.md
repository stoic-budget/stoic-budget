---
title: Supported Banks
description: Statement format support matrix
---

Stoic Budget includes bank-specific parsers plus generic fallbacks.

## Native PDF support

- **Australia:** ANZ, Bendigo Bank, BOQ, CommBank, Great Southern Bank, Heritage Bank, ING, NAB, Suncorp Bank
- **Belgium:** KBC
- **Brazil:** Banco do Brasil
- **Canada:** ATB Financial, CIBC, Coast Capital, Desjardins, EQ Bank, Laurentian Bank, RBC Royal Bank, Scotiabank, Simplii Financial, Tangerine, TD Bank
- **France:** Crédit Agricole, Société Générale, Sogexia
- **Germany:** Deutsche Bank, N26
- **Hong Kong:** Bank of China (Hong Kong)
- **India:** Axis Bank, Citibank, HDFC Bank, ICICI Bank, State Bank of India
- **International:** Payoneer, PayPal, Revolut, Skrill, Standard Chartered
- **Israel:** Bank Hapoalim / Isracard (Hebrew)
- **Kazakhstan:** Kaspi Bank; Bereke Bank, old and new PDF layouts
- **Kenya:** NCBA Bank
- **Nigeria:** Fidelity Bank
- **Philippines:** BPI, GoTyme Bank
- **Poland:** BNP Paribas Bank Polska
- **Qatar:** QNB
- **Romania:** Raiffeisen Bank
- **South Africa:** Absa, Capitec, FNB
- **Sri Lanka:** Commercial Bank of Ceylon
- **United Kingdom:** Bank of Scotland, Barclays, first direct, Halifax, Handelsbanken, HSBC, iFAST Global Bank, Kroo, Lloyds Bank, Metro Bank, Monzo, Nationwide, NatWest, Royal Bank of Scotland, Santander UK, Starling Bank, The Co-operative Bank
- **United States:** Ally Bank, Associated Bank, Bank of America, BECU, BMO, Capital One, Cash App, Charles Schwab, Chase, Chime, Citizens, Comerica, Commerce Bank, Credit One, DCU, Discover, Fifth Third, First Citizens, Found, Frost Bank, GO2bank, Green Dot, HSA Bank, Huntington, IBC Bank, KeyBank, M&T Bank, Marcus by Goldman Sachs, Merrick Bank, Navy Federal Credit Union, Netspend, Optum Bank, PNC Bank, Prosperity Bank, Regions Bank, SoFi, Synchrony Bank, Synovus, Truist

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

# Fio banka — synthetic statements

No real Fio statement was available, and Fio publishes no specimen. These two
files are **made up**: every name, account, amount and reference is invented.
They follow the layout that the Fio parser of
[zumfi-finance](https://github.com/Simmak7/zumfi-finance) (MIT, commit
`a5b8a09`) describes and was written against: a block per row, the booking
date, operation, counterparty account and amount on the first line, the
payment's date and the merchant under it, the operation id with its payment
symbols, and the original amount of a payment abroad.

- `sample1.pdf`: Czech, CZK, two pages; a card payment abroad in PLN.
- `sample2.pdf`: Slovak branch, EUR, two pages; an IBAN counterparty, a cash
  withdrawal abroad with its amount wrapped onto the next line, a same-currency
  amount line to ignore, a 0,00 fee row, and all three payment symbols.

- `sample3.pdf`: Czech, CZK, two pages; the bank's name in capitals, the
  operation id on the payee's line, a payment message that reads like a code
  and a figure ("FAK 2026001"), the court-register footer under the last row of
  page 1 and a fee summary after the table.

- `not-fio.pdf`: a made-up "ACME Bank plc" statement (English) whose first row is a transfer from a Fio account, printing Fio's BIC and name: it must **not** be read as Fio's (the generic reading reads it).

The three Fio files were checked row by row against zumfi's own parser on the same file; the
ways the two differ on purpose are listed in the pull request that added them.
Column positions are a guess. Replace these with an anonymized real statement
(`golden-private/` and `scripts/anonymize_statement_pdf.py`) when one turns up.

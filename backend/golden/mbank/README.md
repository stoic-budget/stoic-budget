# mBank (Czech and Slovak branches) — synthetic statements

No real mBank statement was available, and mBank publishes no specimen with
transactions. These files are **made up**: every name, account and amount is
invented. They follow the layout that the mBank parser of
[zumfi-finance](https://github.com/Simmak7/zumfi-finance) (MIT, commit
`a5b8a09`) describes and was written against: a ruled table, words of the
description glued together as mBank prints them ("PLATBAKARTOU", "NájemACME",
"DATUMPROVEDENÍTRANSAKCE:2026-03-01") with the counterparty's account.

- `sample1.pdf`: the Czech branch, CZK, booking and transaction dates (rows
  are dated by the transaction's, as zumfi does), the running balance under a
  heading printed on two lines ("Účetní" over "zůstatek"), and the
  "Kreditní / Debetní položky" totals (a count of items, then their sum).
- `sample2.pdf`: the Slovak branch's EUR "Zoznam operácií": ISO dates, the
  account and category columns (the counterparty's account read from its own
  column), amounts glued to "EUR".
- `sample3.pdf`: a savings account (mSPOŘENÍ): an account without a prefix
  ("2200000001/6210"), "eSHOP McDONALDS" (no glue to undo), the execution date
  wrapped onto its own line, totals under 1 000 beside their count, and the
  closing balance printed under the table (no part of the last row).
- `not-mbank.pdf`: a made-up "ACME Banka" statement (account …/0600) whose
  first rows pay an mBank account and print its BIC: it must **not** be read
  as mBank's (zumfi takes it for mBank and reads no rows).

The three statements were checked row by row against zumfi's own parser on the same file.
Column positions are a guess. Replace these with an anonymized real statement
(`golden-private/` and `scripts/anonymize_statement_pdf.py`) when one turns up.

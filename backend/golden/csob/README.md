# ČSOB — synthetic statements

No real ČSOB statement was available, and ČSOB publishes no specimen with
transactions. These files are **made up**: every name, account, amount and
reference is invented. They follow the layout that the ČSOB parser of
[zumfi-finance](https://github.com/Simmak7/zumfi-finance) (MIT, commit
`a5b8a09`) describes and was written against: two-line rows, the day and month,
the kind of payment, the counterparty, the bank's id, the amount and the running
balance on the first line; the counterparty's account and the payment symbols
(VS, KS, SS) under it; the year from the period.

- `sample1.pdf`: CZK, two pages with the bank's footer on each (zumfi stops
  reading at the first footer and loses the second page).
- `sample2.pdf`: EUR, a period from 15 December to 14 January (zumfi dates the
  December rows a year late), an IBAN counterparty, a constant symbol without a
  variable one.

- `sample3.pdf`: the payment symbols' headings stacked under "Identifikace", so
  the bank's own id on the first line sits where the variable symbol sits on
  the second.
- `sample4.pdf`: no period printed, only "Rok/č. výpisu: 2025/3": the rows take
  that year.

- `not-csob.pdf`: a made-up "ACME Banka" statement (account …/0100) that prints "Rok/č. výpisu" and names ČSOB, its full name and BIC in a row: it must **not** be read as ČSOB's.

The ČSOB files were checked row by row against zumfi's own parser on the same file.
Column positions are a guess. Replace these with an anonymized real statement
(`golden-private/` and `scripts/anonymize_statement_pdf.py`) when one turns up.

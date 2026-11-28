# Raiffeisenbank (Czech Republic) — synthetic statements

No real Raiffeisenbank CZ account statement was available; the bank publishes
annotated guides only for its card and fee statements. These files are **made
up**: every name, account, amount and code is invented. They follow the layout
that the Raiffeisenbank parser of
[zumfi-finance](https://github.com/Simmak7/zumfi-finance) (MIT, commit
`a5b8a09`) describes and was written against: a block of two to four lines per
row (booking date, category, kind and amount; value date, counterparty account
and an original amount abroad; transaction code with the name, or the card and
the rate; the merchant and its town).

- `sample1.pdf`: current account, CZK, two pages; an incoming payment, card
  payments (one abroad, 3,00 EUR at 25,10), a standing order, a card payment at
  a café whose name holds "vklad" (zumfi takes it for income) and interest.
- `sample2.pdf`: savings account printing amounts without a currency; a tax on
  interest ("Daň z úroku", which zumfi takes for income).

- `sample3.pdf`: savings account, two pages; a transfer from abroad whose
  original amount follows the payer's IBAN (199,20 EUR at 25,10), and a card
  payment whose block is cut by the page break (zumfi glues the IBAN's and the
  year's digits to both amounts).
- `sample4.pdf`: an EUR account (rows and balances in EUR) with a card payment
  in USD; zumfi reads no row of it.
- `not-rb.pdf`: a made-up "ACME Banka" statement (account …/0600) with a short
  header whose first rows pay a Raiffeisenbank account and print its BIC: it
  must **not** be read as Raiffeisenbank's.

All were checked row by row against zumfi's own parser on the same file.
Column positions are a guess. Replace these with an anonymized real statement
(`golden-private/` and `scripts/anonymize_statement_pdf.py`) when one turns up.

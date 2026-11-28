# UniCredit Bank Czech Republic — synthetic statements

No real UniCredit CZ statement was available, and the bank publishes no
specimen with transactions. These files are **made up**: every name, account,
card and amount is invented. They follow the layout that the UniCredit parser
of [zumfi-finance](https://github.com/Simmak7/zumfi-finance) (MIT, commit
`a5b8a09`) describes and was written against: columns Datum, Valuta,
Transakce, Příjmy, Výdaje; a block per row with the details under the first
line (card, holder, original amount and rate, "CODE, merchant", town;
"Příjemce:", "Plátce:", "Popis:", the account and the symbols).

- `sample1.pdf`: two pages; a card payment, a transfer within the bank, a
  mobile payment whose message holds "Příjmy" (zumfi drops such a line), a
  card payment in EUR with its rate, a cash withdrawal.
- `sample2.pdf`: the opening and closing balance rows inside the table, a
  mobile payment with only a message holding "ID 1" (zumfi drops it too), a
  card payment without its merchant line, interest.
- `sample3.pdf`: a CZK account whose card payments abroad print "EUR" more
  often than "CZK" (the account stays CZK); a transfer cut by the page break,
  with a footer under it and the header, own account included, repeated above
  its continuation; payments whose message is only a variable symbol.
- `not-uc.pdf`: a made-up "ACME Banka" statement (account …/0100) whose first
  row repays a UniCredit loan and prints its account and BIC: it must **not**
  be read as UniCredit's.

The samples were checked row by row against zumfi's own parser on the same file.
Column positions are a guess. Replace these with an anonymized real statement
(`golden-private/` and `scripts/anonymize_statement_pdf.py`) when one turns up.

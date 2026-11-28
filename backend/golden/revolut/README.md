# Revolut — statements

- `sample1.pdf`: a Revolut (UK) account statement.
- `sample2.pdf`: a **made-up** Revolut Bank UAB multi-currency statement in the
  layout zumfi-finance's Revolut parser (MIT, commit `a5b8a09`) describes: an
  "EUR Statement" and a "CZK Statement" section, each with its balance
  summary ("Account (Current Account)" opening, money out, money in,
  closing); amounts with a symbol before them ("€12.49") or a code after them
  ("245.00 CZK"); money in printed net of its fee ("Fee: 12.50 CZK 1,262.50
  CZK": booked gross, the fee apart) and a fee inside money out ("Fee: 20.00
  CZK 580.00 CZK": left in it). Both sections print the same IBAN (two accounts: one IBAN, two currencies).
  Every name and amount is invented. Checked row by row against zumfi's own
  parser.
- `sample3.pdf`: the same layout with an EUR section that holds a balance but
  no rows: the statement is the CZK section's, in CZK, with its balances.

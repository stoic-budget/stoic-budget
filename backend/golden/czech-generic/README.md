# Czech statement of a bank without its own parser — synthetic

A **made-up** statement of an invented "ACME Banka": every name, account and
amount is invented. It holds the shapes Czech and Slovak banks print that the
generic layout reading learned with the zumfi-finance port: column headings
("Datum zaúčtování" over "Datum transakce", "Popis", "Částka", "Zůstatek"),
dates spaced as "2. 3. 2026", amounts followed by "Kč", the payment's own date
on the line under the booking date, and "Počáteční / Konečný zůstatek".

- `sample2.pdf`: the shape zumfi's universal parser describes for Komerční
  banka's statements, under an invented bank: money in and out in columns of
  their own ("Připsáno", "Odepsáno") and "Označení operace" as the row's text.
  zumfi's universal parser books the standing order (in "Odepsáno") as income.
- `sample3.pdf`: a Slovak statement: "Výpis za obdobie", "Starý / Nový
  zostatok", columns Dátum, Popis transakcie, Suma, Zostatok, an EUR account.
  zumfi hands it to its Raiffeisenbank parser and books the balances as CZK
  amounts.

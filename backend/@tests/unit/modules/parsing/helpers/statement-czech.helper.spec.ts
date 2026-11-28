import {
  isAmountPart,
  parseStatementAmount,
} from '@/modules/parsing/helpers/statement-amount.helper';
import {
  findFullDates,
  parseDateParts,
  resolveDate,
} from '@/modules/parsing/helpers/statement-date.helper';
import { findForeignAmount } from '@/modules/parsing/helpers/statement-foreign-amount.helper';
import {
  detectStatementCurrency,
  findAccountNumber,
  findStatementBalances,
  findStatementTotals,
  isBalanceLabel,
} from '@/modules/parsing/helpers/statement-metadata.helper';

/** A Czech statement's header, as Fio and ČSOB print theirs; numbers made up. */
const HEADER = [
  'Výpis z účtu',
  'Číslo účtu: 1234567890/2010',
  'Měna účtu CZK',
  'Výpis za období 1.3.2026-31.3.2026',
  'Počáteční zůstatek 12 345,67',
  'Součet příjmů 840,00',
  'Součet výdajů -1 380,00',
  'Konečný zůstatek 11 805,67',
].join('\n');

describe('Czech and Slovak statements', () => {
  it.each([
    ['1 234,56 Kč', 1234.56],
    ['-245,90 Kč', -245.9],
    ['100,00Kč', 100],
    ['-3,40EUR', -3.4],
  ])('reads the amount %s', (text, expected) => {
    expect(parseStatementAmount(text)).toBe(expected);
  });

  it('takes "Kč" printed as a word of its own for part of the amount', () => {
    expect(isAmountPart('Kč')).toBe(true);
    expect(isAmountPart('Kčs')).toBe(false);
  });

  it('does not read a word after the figure as the koruna', () => {
    expect(parseStatementAmount('12,00 Kčs')).toBeNull();
  });

  it.each(['44,91LIU', '34,91CRF', '21.19UHR', '2.00PCS'])(
    'does not read %s, a word glued to the figure, as an amount',
    text => {
      expect(parseStatementAmount(text)).toBeNull();
    },
  );

  it.each([
    ['20. 06. 2023', { day: 20, month: 6, year: 2023 }],
    ['3.3.', { day: 3, month: 3 }],
    ['3. 3.', { day: 3, month: 3 }],
  ])('reads the date %s', (text, expected) => {
    expect(parseDateParts(text, 'dmy')).toEqual(expected);
  });

  it('does not read a date across a line break', () => {
    expect(findFullDates('See article 12.\n05. 2024', 'dmy')).toEqual([]);
  });

  it('finds spaced dates in free text', () => {
    const [found] = findFullDates('Datum transakce 20. 06. 2023 MALL', 'dmy');
    expect(found?.date).toEqual(new Date(2023, 5, 20));
  });

  it('puts a December row without a year in the year before a January statement', () => {
    const december = parseDateParts('30.12.', 'dmy');
    expect(december && resolveDate(december, new Date(2026, 0, 31))).toEqual(
      new Date(2025, 11, 30),
    );
  });

  it('reads the opening and closing balances and the printed totals', () => {
    expect(findStatementBalances(HEADER, 'dmy')).toEqual({ start: 12345.67, end: 11805.67 });
    expect(findStatementTotals(HEADER, 'dmy')).toEqual({ credits: 840, debits: 1380 });
  });

  it('reads the Slovak labels', () => {
    const slovak = 'Starý zostatok 353,74\nSuma príjmov 1 000,00\nSuma výdavkov -11,67\nNový zostatok 1 342,07';
    expect(findStatementBalances(slovak, 'dmy')).toEqual({ start: 353.74, end: 1342.07 });
    expect(findStatementTotals(slovak, 'dmy')).toEqual({ credits: 1000, debits: 11.67 });
    expect(findStatementTotals('Příjmy celkem: 32 012,34 CZK\nVýdaje celkem: -12 380,20 CZK', 'dmy')).toEqual({
      credits: 32012.34,
      debits: 12380.2,
    });
  });

  it('takes a balance row for a balance, not a payment', () => {
    expect(isBalanceLabel('Počáteční zůstatek')).toBe(true);
    expect(isBalanceLabel('Nový zostatok')).toBe(true);
  });

  it.each([
    ['IBAN CZ65 0800 0000 1920 0014 5399 Počáteční zůstatek 1,00', 'CZ6508000000192000145399'],
    ['IBAN: GB29 NWBK 6016 1331 9268 19Kontoinhaber', 'GB29NWBK60161331926819'],
    ['IBAN: FR76 3000 6000 0112 3456 7890 189Date', 'FR7630006000011234567890189'],
    ['IBAN GB29NWBK60161331926819Sort code', 'GB29NWBK60161331926819'],
    ['IBAN: NL91ABNA0417164300_', 'NL91ABNA0417164300'],
  ])('reads the IBAN in %s without the word beside it', (text, iban) => {
    expect(findAccountNumber(text)).toBe(iban);
  });

  it('takes no "Účet:" or "Protiúčet:" line for the account: a row prints them (ČSOB reads its own)', () => {
    expect(findAccountNumber('Výpis z účtu\n05.03. Příchozí platba Protiúčet: 2900000001/0800')).toBeNull();
    expect(findAccountNumber('Account number: 12345678\nÚčet: 2900000001/0800')).toBe('12345678');
    expect(findAccountNumber('Account number: 12345678\nNote: převod na účet: 123456/0800')).toBe('12345678');
  });

  it('keeps a slash and four digits only after the Czech label', () => {
    expect(findAccountNumber('Account No: 12345678/2024')).toBe('12345678');
  });

  it('keeps the bank code of the account number', () => {
    expect(findAccountNumber(HEADER)).toBe('1234567890/2010');
    expect(findAccountNumber('Cislo uctu: 19-1234567890/0100')).toBe('19-1234567890/0100');
  });

  it('knows the koruna by its sign when no code is printed', () => {
    expect(detectStatementCurrency('Zůstatek 1 234,56 Kč\nPlatba -12,00 Kč')).toBe('CZK');
  });
});

describe('findForeignAmount', () => {
  it('reads the amount after "částka", wrapped or not', () => {
    expect(findForeignAmount('Nákup: ACME, dne 6.3.2026,\nčástka 50.00 PLN', 'CZK', -295.5)).toEqual(
      { amount: 50, currency: 'PLN', rate: 5.91 },
    );
  });

  it('takes the printed rate over a worked-out one', () => {
    expect(findForeignAmount('RYANAIR DUBLIN\n40,00 EUR kurz: 25,100 CZK/EUR', 'CZK', -1004)).toEqual({
      amount: 40,
      currency: 'EUR',
      rate: 25.1,
    });
  });

  it('reads a card detail line and a line of code and figure', () => {
    expect(findForeignAmount('3,00 EUR;ACME FUEL 731;Svit;SVK', 'CZK')).toEqual({
      amount: 3,
      currency: 'EUR',
    });
    expect(findForeignAmount('Platba u obchodníka\nEUR 12,50\nACME, Wien', 'CZK')).toEqual({
      amount: 12.5,
      currency: 'EUR',
    });
  });

  it.each([
    ['Platba kartou, částka 200 dne 5.3.2026'],
    ['dne 10.3.2026, částka 840.00 czk'],
    ['Výběr z bankomatu\nATM 500\nPraha'],
    ['Terminal\nPOS 1234\n'],
    ['Úhrada\nFAK 2026001'],
  ])('reads no foreign amount in %j', text => {
    expect(findForeignAmount(text, 'CZK', -1000)).toBeNull();
  });

  it('reads a line of a figure and its code, with a rate printed as "25,10 CZK/EUR"', () => {
    expect(findForeignAmount('3,00 EUR\n8436776103 PK: 516844XXXXXX4400 25,10 CZK/EUR', 'CZK', -75.3)).toEqual({
      amount: 3,
      currency: 'EUR',
      rate: 25.1,
    });
  });

  it('reads the figure and its code ending a line after an account', () => {
    expect(findForeignAmount('DE89370400440532013000 100,00 EUR\n8436776301 ACME GmbH 25,10 CZK/EUR', 'CZK', 2510)).toEqual({
      amount: 100,
      currency: 'EUR',
      rate: 25.1,
    });
  });

  it('turns over a rate printed the other way, and holds it to the booked amount', () => {
    expect(findForeignAmount('3,00 EUR\n0,0398 EUR/CZK', 'CZK', -75.3)).toEqual({ amount: 3, currency: 'EUR', rate: 25.125628 });
    // A rate that fits neither way is worked out from the two amounts.
    expect(findForeignAmount('3,00 EUR\n22,00 CZK/EUR', 'CZK', -75.3)).toEqual({ amount: 3, currency: 'EUR', rate: 25.1 });
  });

  it('takes no rate from lower-case words ("0,10 CZK/min")', () => {
    expect(findForeignAmount('částka 50.00 PLN\n2,50 kwh/den', 'CZK')).toEqual({ amount: 50, currency: 'PLN' });
  });

  it("ignores an amount in the account's own currency", () => {
    expect(findForeignAmount('dne 10.3.2026, částka 840.00 EUR', 'EUR')).toBeNull();
  });

  it('finds nothing in a plain description', () => {
    expect(findForeignAmount('Příchozí platba ACME s.r.o.\nVS 2026031', 'CZK')).toBeNull();
  });
});

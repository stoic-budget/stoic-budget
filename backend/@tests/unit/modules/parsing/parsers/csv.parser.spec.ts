import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CsvParser } from '@/modules/parsing/parsers/csv.parser';

describe('CsvParser', () => {
  let dir: string;
  const parser = new CsvParser();

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-parser-'));
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const parse = (name: string, lines: string[]) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return parser.parse(filePath);
  };

  const day = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

  /** Writes raw bytes, for files saved in another encoding than UTF-8. */
  const parseBytes = (name: string, bytes: Uint8Array) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, bytes);
    return parser.parse(filePath);
  };
  const cp1251 = (text: string) =>
    Uint8Array.from(
      [...text].map(char => {
        const code = char.charCodeAt(0);
        // А..я are 0xC0..0xFF in Windows-1251.
        return code >= 0x410 && code <= 0x44f ? code - 0x410 + 0xc0 : code;
      }),
    );

  it('reads Windows-1251, Latin-1 and UTF-16 exports (#637)', async () => {
    const lines = ['Дата;Контрагент;Сумма', '02.03.2026;Магазин Пример;-10,00'];
    const cyrillic = await parseBytes('cp1251.csv', cp1251(lines.join('\n')));
    expect(cyrillic.transactions.map(t => [t.counterpartyName, t.debit])).toEqual([
      ['Магазин Пример', 10],
    ]);

    const latin = await parseBytes(
      'latin1.csv',
      Buffer.from('Date,Payee,Amount\n02.03.2026,Müller,-12.00', 'latin1'),
    );
    expect(latin.transactions[0].counterpartyName).toBe('Müller');

    const wide = await parseBytes(
      'utf16.csv',
      Uint8Array.from([0xff, 0xfe, ...Buffer.from('Date\tPayee\tAmount\n02.03.2026\tMüller\t-12.00', 'utf16le')]),
    );
    expect(wide.transactions.map(t => [t.counterpartyName, t.debit])).toEqual([['Müller', 12]]);
  });

  it('reads every date in a file with one day/month order', async () => {
    // 01/13 can only be month-first, so 01/05 in the same export is January 5th.
    const result = await parse('chase.csv', [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '01/05/2026,01/06/2026,STARBUCKS,Food & Drink,Sale,-5.40,',
      '01/13/2026,01/14/2026,AMAZON,Shopping,Sale,-20.00,',
    ]);

    expect(result.transactions.map(t => day(t.transactionDate))).toEqual([
      [2026, 1, 5],
      [2026, 1, 13],
    ]);
  });

  it("falls back to the preset's order when every date reads both ways", async () => {
    const result = await parse('chase-ambiguous.csv', [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '01/02/2026,01/03/2026,SHELL,Gas,Sale,-30.00,',
    ]);

    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 1, 2]);
  });

  it('keeps day-first as the default for ambiguous files without a hint', async () => {
    const result = await parse('generic-ambiguous.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '01/02/2026,Shop,10.00,,Groceries',
    ]);

    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 2, 1]);
  });

  it('reads a plain "Date, Description, Amount" file as no bank, with its own currency', async () => {
    const result = await parse('plain.csv', [
      'Date,Description,Amount,Currency',
      '03/04/2026,ACME Store,-25.00,EUR',
    ]);

    expect(result.metadata.institution).toBeUndefined();
    expect(result.metadata.currency).toBe('EUR');
    expect(result.transactions[0].currency).toBe('EUR');
    expect(result.transactions[0].counterpartyName).toBe('ACME Store');
    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 4, 3]);
  });

  it('does not read a currency out of an ordinary word in a description', async () => {
    const result = await parse('plain-try.csv', [
      'Date,Description,Amount',
      '03/04/2026,Try Again Cafe,-25.00',
    ]);

    expect(result.metadata.currency).not.toBe('TRY');
    expect(result.transactions[0].currency).not.toBe('TRY');
  });

  it("lets a file's Currency column beat a bank preset's hint", async () => {
    const result = await parse('santander-eur.csv', [
      'Date,Description,Money In,Money Out,Currency',
      '03/04/2026,ACME Store,,25.00,EUR',
    ]);

    expect(result.metadata.institution).toBe('Santander UK');
    expect(result.metadata.currency).toBe('EUR');
    expect(result.transactions[0].currency).toBe('EUR');
  });

  it('skips account details printed above the transaction table', async () => {
    const result = await parse('preamble.csv', [
      '﻿Account statement',
      'Account;DE00 1234 5678',
      'Period;01.01.2026 - 31.01.2026',
      '',
      'Date;Counterparty;Debit;Credit;Description',
      '05.01.2026;REWE;12,34;;Groceries',
      '13.01.2026;Employer;;2500,00;Salary',
    ]);

    expect(result.transactions).toEqual([
      expect.objectContaining({ counterpartyName: 'REWE', debit: 12.34 }),
      expect.objectContaining({ counterpartyName: 'Employer', credit: 2500 }),
    ]);
  });

  it('finds a known bank layout below a preamble', async () => {
    const result = await parse('sparkasse.csv', [
      'Kontoumsaetze;Girokonto',
      '',
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Betrag";"Waehrung"',
      '"DE11";"05.01.26";"05.01.26";"LASTSCHRIFT";"Strom Januar";"Stadtwerke";"-61,50";"EUR"',
    ]);

    expect(result.metadata.institution).toBe('Sparkasse / DKB (CAMT-CSV)');
    expect(result.transactions).toEqual([
      expect.objectContaining({ counterpartyName: 'Stadtwerke', debit: 61.5, currency: 'EUR' }),
    ]);
    expect(day(result.transactions[0].transactionDate)).toEqual([2026, 1, 5]);
  });

  it('takes the statement period from the rows instead of today', async () => {
    const result = await parse('period.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '20.03.2024,B,5.00,,x',
      '15.03.2024,A,10.00,,x',
    ]);

    expect(day(result.metadata.dateFrom)).toEqual([2024, 3, 15]);
    expect(day(result.metadata.dateTo)).toEqual([2024, 3, 20]);
  });

  it('does not drop a first row whose text merely contains "date"', async () => {
    const result = await parse('update.csv', [
      'Date,Counterparty,Debit,Credit,Description',
      '15.03.2024,App Store,9.99,,Subscription update',
    ]);

    expect(result.transactions).toHaveLength(1);
  });

  it('reads no currency from a word in a row, and leaves it to the wallet and workspace (#675)', async () => {
    const parsed = await parse('no-currency.csv', [
      'Date,Description,Amount',
      '05/01/2026,Try Fitness,-30.00',
      '06/01/2026,TRY FITNESS CLUB - ACME Store refund of 12 USD,-12.50',
    ]);

    expect(parsed.metadata.currency).toBe('');
    expect(parsed.transactions.map(row => row.currency)).toEqual(['', '']);
  });

  it('takes a currency the file states above its table', async () => {
    const parsed = await parse('stated.csv', [
      'Account statement,EUR',
      'Date,Description,Amount',
      '05/01/2026,Try Fitness,-30.00',
    ]);

    expect(parsed.metadata.currency).toBe('EUR');
    expect(parsed.transactions[0].currency).toBe('EUR');
  });
});

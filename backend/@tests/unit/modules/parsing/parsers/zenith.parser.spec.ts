import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  ZenithParser,
  isZenithStatement,
  withoutNotice,
  zenithAccount,
  zenithEntry,
} from '@/modules/parsing/parsers/zenith.parser';

const STATEMENT = [
  'ZENITH BANK PLC',
  'Account Number: SA 1000000001',
  'Failing receipt by the bank within 15DAYS from the date despatch of this statement of Notice of disagreement with the entries,',
].join('\n');

const line = (y: number, words: string[]): PdfTextRow => ({
  page: 3,
  y,
  text: words.join(' '),
  items: words.map((text, index) => ({ text, x: 20 + index * 30, y, width: 25, height: 8 })),
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2023, 7, 11),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'NGN',
  ...amount,
});

describe('ZenithParser', () => {
  it('knows its statement by its name and the line on disagreeing with the entries', () => {
    expect(isZenithStatement(STATEMENT)).toBe(true);
    expect(isZenithStatement('TRF TO ZENITH BANK PLC')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new ZenithParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.ZENITH)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NCBA)).resolves.toBe(false);
    await expect(claims(BankName.ZENITH, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the account number after its kind', () => {
    expect(zenithAccount(STATEMENT)).toBe('1000000001');
  });

  it('takes the page notice off the last row and drops the lines under it', () => {
    const rows = withoutNotice([
      line(753, ['07/05/2024', 'TRF', 'TO', 'PLEASE', 'ACME', 'EXAMINE', 'THIS', 'STATEMENT', 'AT', 'ONCE', '206,000.00']),
      line(763, ['Failing', 'receipt', 'by', 'the', 'bank', 'within', '15DAYS']),
      line(773, ['it', 'will', 'be', 'assumed', 'that', 'the', 'statement', 'rendered', 'is', 'correct']),
    ]);
    expect(rows.map(kept => kept.text)).toEqual(['07/05/2024 TRF TO ACME 206,000.00']);
  });

  it.each([
    ['TRF TO ACME TOYS LTD', { debit: 230000 }, 'ACME TOYS LTD', 'bank_transfer_out'],
    ['NIP/GTB/MEMBER ONE/USSD NIP Transfer', { credit: 62000 }, 'MEMBER ONE', 'bank_transfer_in'],
    ['MC Loc ATM Wdl-000000001000--327/329 SAMPLETOWN', { debit: 2000 }, 'MC Loc ATM Wdl-000000001000--327/329 SAMPLETOWN', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(zenithEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});

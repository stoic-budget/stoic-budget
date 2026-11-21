import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { QnbParser, isQnbStatement, qnbEntry, withWholeAmounts } from '@/modules/parsing/parsers/qnb.parser';

const IBAN = 'QA00QNBA000000000171100000001';
const STATEMENT = ['Bank Statement Qatar National Bank (Q.P.S.C.)', `(${IBAN})`, 'QATARI RIYAL'].join('\n');

const line = (page: number, y: number, words: [string, number][]): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 6, 12),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'QAR',
  ...amount,
});

describe('QnbParser', () => {
  it('knows its statement by its name and IBAN', () => {
    expect(isQnbStatement(STATEMENT)).toBe(true);
    expect(isQnbStatement('Transfer to Qatar National Bank')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new QnbParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.QNB)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HSBC)).resolves.toBe(false);
    await expect(claims(BankName.QNB, FileType.CSV)).resolves.toBe(false);
  });

  it('gives whole amounts on dated rows under the money headings their decimals, the next page too', () => {
    const rows = withWholeAmounts([
      line(1, 222, [['Date', 46], ['Description', 136], ['Debit', 296], ['Credit', 376], ['Balance', 463]]),
      line(1, 318, [['03/07/2024', 51], ['FUND', 118], ['TRANSFER', 143], ['11670', 392], ['11677.49', 475]]),
      line(1, 412, [['20000000001', 118], ['30000001', 238]]),
      line(2, 254, [['08/07/2024', 51], ['CASH', 118], ['-9500', 307], ['557.49', 481]]),
    ]);
    expect(rows.map(kept => kept.text)).toEqual([
      'Date Description Debit Credit Balance',
      '03/07/2024 FUND TRANSFER 11670.00 11677.49',
      '20000000001 30000001',
      '08/07/2024 CASH -9500.00 557.49',
    ]);
  });

  it.each([
    ['POS-PURCHASE 000100XXXXXX0001 POS ACME STORE - SAMPLETOWN P.O.BOX 1', { debit: 74.25 }, 'ACME STORE - SAMPLETOWN', 'card'],
    ['ATM CASH 000100XXXXXX0001 ATM VEHICLE ATM 11', { debit: 5000 }, 'ATM CASH 000100XXXXXX0001 ATM VEHICLE ATM 11', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(qnbEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});

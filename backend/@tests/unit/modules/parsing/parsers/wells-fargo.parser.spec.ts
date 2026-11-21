import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { WellsFargoParser, isWellsFargoStatement, upToTotals, wellsFargoEntry } from '@/modules/parsing/parsers/wells-fargo.parser';

const STATEMENT = ['Wells Fargo Everyday Checking', '1-800-TO-WELLS (1-800-869-3557)', 'Write: Wells Fargo Bank, N.A. (808)'].join('\n');

const line = (y: number, text: string): PdfTextRow => ({ page: 2, y, text, items: [] });

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 11, 8),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('WellsFargoParser', () => {
  it('knows its statement by its legal name and phone line', () => {
    expect(isWellsFargoStatement(STATEMENT)).toBe(true);
    expect(isWellsFargoStatement('Payment to Wells Fargo Bank, N.A.')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new WellsFargoParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.WELLS_FARGO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.FIRST_CITIZENS)).resolves.toBe(false);
    await expect(claims(BankName.WELLS_FARGO, FileType.CSV)).resolves.toBe(false);
  });

  it('stops at the history\'s totals', () => {
    const rows = upToTotals([
      line(10, '1/9 Monthly Service Fee 10.00 -9.95'),
      line(20, 'Totals $3,133.93 $3,323.12'),
      line(40, '1/5 ACME Web Pmts Member One Reference # 1000 1,485.84'),
    ]);
    expect(rows.map(kept => kept.text)).toEqual(['1/9 Monthly Service Fee 10.00 -9.95', 'Totals $3,133.93 $3,323.12']);
  });

  it('reads a card purchase\'s shop', () => {
    expect(
      wellsFargoEntry(row('Purchase authorized on 12/07 ACME Store Sampletown TX P300000000000000 Card 1001', { debit: 27.31 })),
    ).toMatchObject({ counterpartyName: 'ACME Store Sampletown TX', paymentType: 'card' });
  });
});

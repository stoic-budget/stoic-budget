import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SkrillParser, isSkrillStatement, skrillEntry, withNamedSigns } from '@/modules/parsing/parsers/skrill.parser';

const STATEMENT = ['Paysafe Payment Solutions Limited', 'Bank Statement', 'PRIVATE AND CONFIDENTIAL | www.skrill.com'].join('\n');

const header = (words: [string, number][]): PdfTextRow => ({
  page: 1,
  y: 300,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y: 300, width: text.length * 5, height: 8, page: 1 })),
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 4, 9),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'USD',
  ...amount,
});

describe('SkrillParser', () => {
  it('knows its statement by its issuer and web address', () => {
    expect(isSkrillStatement(STATEMENT)).toBe(true);
    expect(isSkrillStatement('Payment to www.skrill.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SkrillParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SKRILL)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.PAYONEER)).resolves.toBe(false);
    await expect(claims(BankName.SKRILL, FileType.CSV)).resolves.toBe(false);
  });

  it('names the signed money headings', () => {
    const [named] = withNamedSigns([
      header([['SKRILL', 38], ['ID', 65], ['Date', 123], ['(+)', 353], ['USD', 365], ['(-)', 408], ['USD', 418], ['Balance', 746]]),
    ]);
    expect(named.text).toBe('SKRILL ID Date Credit Debit Balance');
  });

  it('joins the type its column wrapped', () => {
    expect(skrillEntry(row('CURRENCY_EXCHA USD/EUR NGE', { debit: 17.75 }))).toMatchObject({
      paymentPurpose: 'CURRENCY_EXCHANGE USD/EUR',
      paymentType: 'bank_transfer_out',
    });
  });
});

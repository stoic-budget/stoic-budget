import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { SimpliiParser, isSimpliiStatement, simpliiEntry } from '@/modules/parsing/parsers/simplii.parser';

const STATEMENT = ['your no fee chequing account', '“Simplii Financial” is a division of CIBC.', '1-888-723-8881 simplii.com.'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2019, 8, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('SimpliiParser', () => {
  it('knows its statement by its name and web address', () => {
    expect(isSimpliiStatement(STATEMENT)).toBe(true);
    expect(isSimpliiStatement('Transfer to Simplii Financial')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new SimpliiParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SIMPLII)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.CIBC)).resolves.toBe(false);
    await expect(claims(BankName.SIMPLII, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['INTERAC E-TRANSFER SEND Member One', { debit: 50 }, 'Member One', 'bank_transfer_out'],
    ['ABM WITHDRAWAL', { debit: 20 }, 'ABM WITHDRAWAL', 'cash'],
    ['INTEREST', { credit: 0.12 }, 'INTEREST', 'interest'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(simpliiEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});

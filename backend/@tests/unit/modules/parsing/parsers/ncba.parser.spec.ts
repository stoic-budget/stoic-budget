import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { NcbaParser, isNcbaStatement, ncbaEntry } from '@/modules/parsing/parsers/ncba.parser';

const STATEMENT = ['e-Statement Of Account', 'Payments In 1,500.00', 'Payments Out 24,600.00', 'info@ncbagroup.com NCBA'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 7, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'KES',
  ...amount,
});

describe('NcbaParser', () => {
  it('knows its statement by its name or its e-statement layout', () => {
    expect(isNcbaStatement(STATEMENT)).toBe(true);
    expect(isNcbaStatement('e-Statement Of Account')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NcbaParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NCBA)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.FIDELITY_BANK)).resolves.toBe(false);
    await expect(claims(BankName.NCBA, FileType.CSV)).resolves.toBe(false);
  });

  it('drops the value date from the text and types the row', () => {
    expect(ncbaEntry(row('IB Outgoing Mobile Payments 01/08/2024 FTC1000000AAAA', { debit: 1000 }))).toMatchObject({
      paymentPurpose: 'IB Outgoing Mobile Payments FTC1000000AAAA',
      paymentType: 'bank_transfer_out',
    });
  });
});

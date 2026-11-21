import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { UcoParser, isUcoStatement, ucoEntry } from '@/modules/parsing/parsers/uco.parser';

const STATEMENT = ['Statement for A/c 10000000000001 Between 01-05-2020 and 31-07-2020', 'IFSC Code UCBA0001000'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2020, 6, 27),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'INR',
  ...amount,
});

describe('UcoParser', () => {
  it('knows its statement by its IFSC and title', () => {
    expect(isUcoStatement(STATEMENT)).toBe(true);
    expect(isUcoStatement('NEFT to UCBA0001000')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UcoParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.UCO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.SBI)).resolves.toBe(false);
    await expect(claims(BankName.UCO, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['MPAY/UPI/TRTR/100000000001/SAMP/member@ok/U', { credit: 500 }, 'bank_transfer_in'],
    ['MPAY/IMPSI/TRTR/100000000002/ MEMBER ONE/XX000001', { debit: 300 }, 'bank_transfer_out'],
  ])('reads the rail behind the prefix: %s', (purpose, amount, paymentType) => {
    expect(ucoEntry(row(purpose, amount)).paymentType).toBe(paymentType);
  });
});

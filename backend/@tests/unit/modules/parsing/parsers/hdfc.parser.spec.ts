import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { HdfcParser, hdfcEntry, isHdfcStatement } from '@/modules/parsing/parsers/hdfc.parser';

const STATEMENT = ['RTGS/NEFT IFSC : HDFC0001000 MICR : 400240000', 'Statement of account'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2018, 5, 4),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'INR',
  ...amount,
});

describe('HdfcParser', () => {
  it('knows its statement by the IFSC and the heading', () => {
    expect(isHdfcStatement(STATEMENT)).toBe(true);
    expect(isHdfcStatement('NEFT DR-HDFC0001000-ACME')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new HdfcParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.HDFC)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.AXIS)).resolves.toBe(false);
    await expect(claims(BankName.HDFC, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['NEFT DR-UBIN0500000-MEMBER TWO-NETBANK, MUM-N155', { debit: 5000 }, 'MEMBER TWO', 'bank_transfer_out'],
    ['IMPS-818411585956-MEMBER THREE-HDF', { credit: 3000 }, 'MEMBER THREE', 'bank_transfer_in'],
    ['UPI-100000000000000-member@upi-81551 8551633-OK', { credit: 7000 }, 'member@upi', 'bank_transfer_in'],
    ['POS 416021XXXXXX1000 ACME STORE', { debit: 1760 }, 'ACME STORE', 'card'],
    ['EMI 4923306 CHQ S49233060051', { debit: 2268 }, 'EMI 4923306 CHQ S49233060051', 'direct_debit'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(hdfcEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});

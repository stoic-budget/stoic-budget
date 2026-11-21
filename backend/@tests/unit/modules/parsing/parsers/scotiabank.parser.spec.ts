import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { ScotiabankParser, isScotiabankStatement, scotiabankEntry } from '@/modules/parsing/parsers/scotiabank.parser';

const STATEMENT = ['Your account number:', '10000 01000 10', 'Call 1 800 4-SCOTIA', 'www.scotiabank.com'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2024, 0, 3),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'CAD',
  ...amount,
});

describe('ScotiabankParser', () => {
  it('knows its statement by its phone line or web address', () => {
    expect(isScotiabankStatement(STATEMENT)).toBe(true);
    expect(isScotiabankStatement('PC Transfer to ScotiaLine')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new ScotiabankParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.SCOTIABANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.RBC)).resolves.toBe(false);
    await expect(claims(BankName.SCOTIABANK, FileType.CSV)).resolves.toBe(false);
  });

  it.each([
    ['Point of sale purchase Fpos ACME Store Sampletown ONCA', { debit: 15 }, 'ACME Store Sampletown ONCA', 'card'],
    ['Deposit 1000 Payroll ACME LTD', { credit: 1017 }, 'Deposit 1000 Payroll ACME LTD', 'bank_transfer_in'],
    ['ABM withdrawal Sample S.C. #2 Sampletown ON', { debit: 400 }, 'ABM withdrawal Sample S.C. #2 Sampletown ON', 'cash'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(scotiabankEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});

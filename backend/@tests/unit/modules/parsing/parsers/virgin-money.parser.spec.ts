import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { VirginMoneyParser, isVirginMoneyStatement, virginMoneyEntry } from '@/modules/parsing/parsers/virgin-money.parser';

const STATEMENT = ['Account number Sort code Statement date', '10000001 82-10-00 01 Sep 22 - 15 Sep 22', 'Date Description Type Debits Credits Balance'].join(
  '\n',
);

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 8, 14),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('VirginMoneyParser', () => {
  it('knows its statement by its name, or by its sort code beside its header', () => {
    expect(isVirginMoneyStatement(STATEMENT)).toBe(true);
    expect(isVirginMoneyStatement('Transfer to Virgin Money')).toBe(true);
    expect(isVirginMoneyStatement('Date Description Type Debits Credits Balance')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new VirginMoneyParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.VIRGIN_MONEY)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.MONZO)).resolves.toBe(false);
    await expect(claims(BankName.VIRGIN_MONEY, FileType.CSV)).resolves.toBe(false);
  });

  it('reads the party between the channel and the reference', () => {
    expect(virginMoneyEntry(row('MOB, Member One, rent Transfer', { debit: 30 }))).toMatchObject({
      counterpartyName: 'Member One',
      paymentType: 'bank_transfer_out',
    });
  });
});

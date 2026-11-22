import { BankName, FileType } from '@/entities/statement.entity';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import { IfastParser, ifastEntry, isIfastStatement } from '@/modules/parsing/parsers/ifast.parser';

const STATEMENT = ['Jan 2025 Monthly Statement', 'iFAST Global Bank Limited, 77 Marsh Wall, London E14 9SH, UK'].join('\n');

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2025, 2, 14),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'GBP',
  ...amount,
});

describe('IfastParser', () => {
  it('knows its statement by the bank name and the title', () => {
    expect(isIfastStatement(STATEMENT)).toBe(true);
    expect(isIfastStatement('Payment to iFAST Global Bank Limited')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new IfastParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.IFAST)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BARCLAYS)).resolves.toBe(false);
    await expect(claims(BankName.IFAST, FileType.CSV)).resolves.toBe(false);
  });

  it('types inbound and outbound payments', () => {
    expect(ifastEntry(row('Inbound domestic payment within UK ACME LTD', { credit: 53.18 })).paymentType).toBe(
      'bank_transfer_in',
    );
    expect(ifastEntry(row('Outbound domestic payment within UK acme', { debit: 53 })).paymentType).toBe(
      'bank_transfer_out',
    );
  });
});

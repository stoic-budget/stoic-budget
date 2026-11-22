import { BankName, FileType } from '@/entities/statement.entity';
import { UlsterParser, isUlsterStatement } from '@/modules/parsing/parsers/ulster.parser';

const STATEMENT = ['Welcome to your new look Ulster Bank statement', 'BIC ULSBGB2B', 'online at www.ulsterbank.co.uk'].join('\n');

describe('UlsterParser', () => {
  it('knows its statement by its BIC and web address', () => {
    expect(isUlsterStatement(STATEMENT)).toBe(true);
    expect(isUlsterStatement('Transfer to www.ulsterbank.co.uk')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UlsterParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.ULSTER)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.NATWEST)).resolves.toBe(false);
    await expect(claims(BankName.ULSTER, FileType.CSV)).resolves.toBe(false);
  });
});

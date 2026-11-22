import { BankName, FileType } from '@/entities/statement.entity';
import { FirstDirectParser, isFirstDirectStatement } from '@/modules/parsing/parsers/first-direct.parser';

const STATEMENT = ['firstdirect.com', 'Your 1st Account details', 'first direct is a division of HSBC UK Bank plc'].join(
  '\n',
);

describe('FirstDirectParser', () => {
  it('knows its statement by the site and its line about HSBC', () => {
    expect(isFirstDirectStatement(STATEMENT)).toBe(true);
    expect(isFirstDirectStatement('Paid to firstdirect.com')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FirstDirectParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FIRST_DIRECT)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.BARCLAYS)).resolves.toBe(false);
    await expect(claims(BankName.FIRST_DIRECT, FileType.CSV)).resolves.toBe(false);
  });
});

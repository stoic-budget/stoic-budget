import { BankName, FileType } from '@/entities/statement.entity';
import { isHalifaxStatement } from '@/modules/parsing/parsers/halifax.parser';
import { LloydsParser, isLloydsStatement } from '@/modules/parsing/parsers/lloyds.parser';

const FOOTER = 'Halifax is a division of Bank of Scotland plc.';
const STATEMENT = ['LLOYDS BASIC ACCT 18 May 2023 to 18 Aug 2023', 'Your Transactions', FOOTER].join('\n');

describe('LloydsParser', () => {
  it('knows its statement by the account name, though it prints the group footer', () => {
    expect(isLloydsStatement(STATEMENT)).toBe(true);
    expect(isHalifaxStatement(STATEMENT)).toBe(false);
    expect(isLloydsStatement(['Your Transactions', FOOTER].join('\n'))).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new LloydsParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.LLOYDS)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.HALIFAX)).resolves.toBe(false);
    await expect(claims(BankName.LLOYDS, FileType.CSV)).resolves.toBe(false);
  });
});

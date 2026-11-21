import { BankName, FileType } from '@/entities/statement.entity';
import { NabParser, isNabStatement } from '@/modules/parsing/parsers/nab.parser';

const STATEMENT = [
  'NAB iSaver',
  'For further information call 13 22 65 for Personal Accounts',
  'BSB number 080-001',
].join('\n');

describe('NabParser', () => {
  it('knows its statement by its name, phone line and BSB', () => {
    expect(isNabStatement(STATEMENT)).toBe(true);
    expect(isNabStatement('NAB transfer, BSB number 080-001')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new NabParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.NAB)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.GREAT_SOUTHERN)).resolves.toBe(false);
    await expect(claims(BankName.NAB, FileType.CSV)).resolves.toBe(false);
  });
});

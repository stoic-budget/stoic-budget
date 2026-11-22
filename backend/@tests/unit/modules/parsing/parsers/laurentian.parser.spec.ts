import { BankName, FileType } from '@/entities/statement.entity';
import { LaurentianParser, isLaurentianStatement } from '@/modules/parsing/parsers/laurentian.parser';

const STATEMENT = [
  '1360, BOUL. RENE-LEVESQUE O., BUR. 600',
  'FROM MAY 24, 2023 TO MAY 31, 2023 391 100-1 01',
  'BALANCE - PREVIOUS STATEMENT 0.00',
].join('\n');

describe('LaurentianParser', () => {
  it('knows its statement by the head office and the previous balance line', () => {
    expect(isLaurentianStatement(STATEMENT)).toBe(true);
    expect(isLaurentianStatement('BALANCE - PREVIOUS STATEMENT 0.00')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new LaurentianParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.LAURENTIAN)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.DESJARDINS)).resolves.toBe(false);
    await expect(claims(BankName.LAURENTIAN, FileType.CSV)).resolves.toBe(false);
  });
});

import { BankName, FileType } from '@/entities/statement.entity';
import { BoqParser, isBoqStatement } from '@/modules/parsing/parsers/boq.parser';

const STATEMENT = [
  'Bank of Queensland Limited',
  'ABN 32 000 000 000',
  'STATEMENT',
  'From 02-Mar-2025 to 01-Apr-2025',
].join('\n');

describe('BoqParser', () => {
  it('knows its statement by the bank name and the title', () => {
    expect(isBoqStatement(STATEMENT)).toBe(true);
    expect(isBoqStatement('Bank of Queensland Limited')).toBe(false);
    expect(isBoqStatement('Transfer to Bank of Queensland Limited\nSTATEMENT of fees')).toBe(false);
  });

  it('claims a PDF named BOQ or unnamed, and no other bank', async () => {
    const parser = new BoqParser();
    expect(await parser.canParse(BankName.BOQ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).toBe(true);
    expect(await parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).toBe(false);
    expect(await parser.canParse(BankName.BOQ, FileType.CSV, 'x.csv', STATEMENT)).toBe(false);
  });
});

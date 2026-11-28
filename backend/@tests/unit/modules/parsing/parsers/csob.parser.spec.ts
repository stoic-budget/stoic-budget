import { BankName, FileType } from '@/entities/statement.entity';
import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import { CsobParser, isCsobStatement, withStatementYear } from '@/modules/parsing/parsers/csob.parser';

const STATEMENT = [
  'Výpis z účtu',
  'Účet: 123456789/0300',
  'Rok/č. výpisu: 2026/3',
  'Československá obchodní banka, a. s., Radlická 333/150, Praha 5',
].join('\n');

describe('CsobParser', () => {
  it('knows its statement by the bank name or its BIC', () => {
    expect(isCsobStatement(STATEMENT)).toBe(true);
    expect(isCsobStatement('BIC: CEKOCZPP\nRok/č. výpisu: 2026/3')).toBe(true);
    expect(isCsobStatement('ČESKOSLOVENSKÁ OBCHODNÍ BANKA, A. S.\nRok/č. výpisu: 2026/3')).toBe(true);
    expect(isCsobStatement('ČSOB, a. s.\nROK/Č. VÝPISU: 2026/3')).toBe(true);
    expect(isCsobStatement('BIC CEKO CZ PP\nRok/č. výpisu: 2026/3')).toBe(true);
    // Accents as a letter and a combining mark, the way some PDFs write them.
    expect(isCsobStatement(STATEMENT.normalize('NFD'))).toBe(true);
    // A payment to a ČSOB account in another bank's statement names only its bank code.
    expect(isCsobStatement('Odchozí platba 1100000004/0300 ACME Bydlení')).toBe(false);
    // Nor does a row naming the bank and its BIC, without the statement's own header.
    expect(isCsobStatement('Výpis z účtu\nPlatba od Člen Dva, BIC CEKOCZPP, Československá obchodní banka')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new CsobParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.CSOB)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KBC)).resolves.toBe(false);
    await expect(claims(BankName.CSOB, FileType.CSV)).resolves.toBe(false);
  });

  it("leaves another bank's statement whose row names ČSOB, and a Slovak ČSOB statement, to the generic reading", () => {
    expect(isCsobStatement('Komerční banka\nÚčet: 1234567890/0100\nRok/č. výpisu: 2026/3\nPlatba BIC CEKOCZPP')).toBe(false);
    expect(isCsobStatement('ČSOB, a. s.\nÚčet: 4000123456/7500\nRok/č. výpisu: 2026/3')).toBe(false);
  });

  it("names the statement's own account from its header line, not a row's counterparty", () => {
    const parser = new CsobParser() as unknown as { accountNumber(text: string): string | null };
    expect(parser.accountNumber('Výpis z účtu\nÚčet: 123456789/0300\nProtiúčet: 2900000001/0800')).toBe(
      '123456789/0300',
    );
    expect(parser.accountNumber('Výpis\n05.03. Platba Protiúčet: 2900000001/0800')).toBeNull();
  });
});

describe('withStatementYear', () => {
  const text = (lines: string[]): PdfTextRow[] =>
    lines.map((line, index) => ({ page: 1, y: index * 10, text: line, items: [] }));
  const row = (day: number, month: number): LayoutTransaction => ({
    date: { day, month },
    dateText: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`,
    description: '',
    firstLine: '',
    counterparty: '',
    amount: 1,
  });

  it('dates rows printed without a year in the year "Rok/č. výpisu" names, 29 February included', () => {
    const [leap] = withStatementYear(text(['Rok/č. výpisu: 2024/2']), [row(29, 2)]);
    expect(leap).toMatchObject({ date: { day: 29, month: 2, year: 2024 }, dateText: '29.02.2024' });
  });

  it('puts December rows of a statement that reaches January in the year before', () => {
    const [december, january] = withStatementYear(text(['Rok/č. výpisu: 2026/1']), [row(30, 12), row(2, 1)]);
    expect(december.date.year).toBe(2025);
    expect(january.date.year).toBe(2026);
  });

  it('leaves the year to the period when the statement prints one', () => {
    const read = [row(5, 3)];
    expect(withStatementYear(text(['Období: 1. 3. 2026 - 31. 3. 2026', 'Rok/č. výpisu: 2025/3']), read)).toEqual(read);
  });
});

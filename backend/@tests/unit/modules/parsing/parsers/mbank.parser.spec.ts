import { BankName, FileType } from '@/entities/statement.entity';
import { isMbankStatement, MbankParser, mbankLine } from '@/modules/parsing/parsers/mbank.parser';

const CZ = ['mBank S.A., organizační složka', 'Výpis z účtu', 'Číslo účtu: 670100-2200000099/6210', 'Měna účtu CZK'].join('\n');
const SK = ['mBank S.A., pobočka zahraničnej banky', 'Zoznam operácií', 'IBAN: SK12 8360 5207 0042 0000 0099'].join('\n');

describe('MbankParser', () => {
  it("knows the Czech branch's statement and the Slovak branch's list of operations", () => {
    expect(isMbankStatement(CZ)).toBe(true);
    expect(isMbankStatement(SK)).toBe(true);
  });

  it('reads glued labels, and a label after the client\'s name', () => {
    expect(isMbankStatement('mBank S.A.\nVýpis z účtu\nČísloúčtu: 670100-2200000099/6210')).toBe(true);
    expect(isMbankStatement('mBank S.A.\nMember One Číslo účtu: 670100-2200000099/6210')).toBe(true);
    expect(isMbankStatement('mBank S.A., pobočka zahraničnej banky\nZoznamoperácií')).toBe(true);
  });

  it('needs both the bank and its own account (or the Slovak list)', () => {
    expect(isMbankStatement('ACME Banka a.s.\nČíslo účtu: 670100-2200000099/6210')).toBe(false);
    expect(isMbankStatement('mBank S.A.\nČíslo účtu: 1111111111/0600')).toBe(false);
    expect(isMbankStatement('ACME Banka a.s.\nZoznam operácií')).toBe(false);
  });

  it("does not take another bank's statement whose row pays an mBank account", () => {
    const header = Array.from({ length: 25 }, (_, n) => `ACME Banka line ${n}`).join('\n');
    expect(isMbankStatement(`${header}\nPlatba na účet 670100-2200000001/6210 mBank S.A.`)).toBe(false);
    expect(isMbankStatement('ACME Banka a.s.\nČíslo účtu: 1111111111/0600\nPlatba mBank S.A. 670100-2200000001/6210')).toBe(false);
    const row = '01.03.2026 Příchozí platba BIC: BREXCZPP\nČíslo účtu protistrany: 670100-2200000001/6210';
    expect(isMbankStatement(`ACME Banka a.s.\nČíslo účtu: 1111111111/0600\n${row}`)).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new MbankParser();
    const claims = (bank: BankName, type = FileType.PDF) => parser.canParse(bank, type, 'x.pdf', CZ);
    await expect(claims(BankName.MBANK)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KBC)).resolves.toBe(false);
  });
});

describe('mbankLine', () => {
  it.each([
    ['PLATBAKARTOU', 'Platba kartou'],
    ['PŘÍCHOZÍPLATBAZMBANK', 'Příchozí platba z mBank'],
    ['ODCHOZÍOKAMŽITÁPLATBA', 'Odchozí okamžitá platba'],
    ['PRIJATÁPLATBAMEDZIBANKOVÁ', 'Prijatá platba medzibanková'],
    ['NájemACME', 'Nájem ACME'],
    ['DATUMPROVEDENÍTRANSAKCE:2026-03-01', ''],
    ['000000-1100000004/0300', ''],
    ['2200000001/6210', ''],
    ['Member One 19-2000145399/0800', 'Member One'],
    ['eSHOP McDONALDS', 'eSHOP McDONALDS'],
  ])('puts %s apart', (glued, words) => {
    expect(mbankLine(glued)).toBe(words);
  });
});

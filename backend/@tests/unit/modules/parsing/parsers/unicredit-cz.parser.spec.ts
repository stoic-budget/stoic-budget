import { BankName, FileType } from '@/entities/statement.entity';
import {
  isUnicreditCzStatement,
  UnicreditCzParser,
  unicreditPayee,
} from '@/modules/parsing/parsers/unicredit-cz.parser';

const STATEMENT = ['UniCredit Bank Czech Republic and Slovakia, a.s.', 'Výpis z účtu', 'Číslo účtu: 1234567890/2700'].join('\n');

describe('UnicreditCzParser', () => {
  it('knows its statement by the bank and its own account with the bank code 2700', () => {
    expect(isUnicreditCzStatement(STATEMENT)).toBe(true);
    expect(isUnicreditCzStatement('BIC: BACXCZPP\nIBAN: CZ12 2700 0000 0012 3456 7890')).toBe(true);
    expect(isUnicreditCzStatement('UniCredit Bank Czech Republic and Slovakia, a.s.\nIBAN: CZ1227000000001234567890')).toBe(true);
    expect(isUnicreditCzStatement('UniCredit Bank Czech Republic and Slovakia, a.s.\nČíslo účtu: 1234567890 / 2700')).toBe(true);
  });

  it('needs the bank and its own account in the header, above the first row', () => {
    const otherBank = ['ACME Banka a.s.', 'Výpis z účtu', 'Číslo účtu: 123456789/0100'];
    const loanRow = ['02.03.2026 Splátka úvěru UniCredit Bank Czech Republic -12.500,00', 'Číslo účtu: 2100123456/2700 BIC BACXCZPP'];
    expect(isUnicreditCzStatement([...otherBank, ...loanRow].join('\n'))).toBe(false);
    expect(isUnicreditCzStatement('UniCredit Bank Czech Republic and Slovakia, a.s.\nČíslo účtu: 123456789/0100')).toBe(false);
    expect(isUnicreditCzStatement('ACME Banka a.s.\nČíslo účtu: 1234567890/2700')).toBe(false);
  });

  it("leaves the Italian UniCredit, and another bank's statement paying a UniCredit account, alone", () => {
    expect(isUnicreditCzStatement('UniCredit S.p.A.\nCodice BIC SWIFT: UNCRITM1AG0\nEstratto conto al 31.03.2026')).toBe(false);
    const header = Array.from({ length: 25 }, (_, n) => `ACME Banka line ${n}`).join('\n');
    expect(isUnicreditCzStatement(`${header}\nPlatba na účet 1234567890/2700 UniCredit Bank Czech Republic`)).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UnicreditCzParser();
    const claims = (bank: BankName, type = FileType.PDF) => parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.UNICREDIT_CZ)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.UNICREDIT)).resolves.toBe(false);
  });
});

describe('unicreditPayee', () => {
  it('names the card merchant, past the card, its holder, the amounts and the town', () => {
    const lines = ['Datum transakce: : 28.02.2026', '1111-2XXX-XX33-0000', 'MEMBER ONE', 'CZK 759,00', 'ACME0001, ACME Market Praha', 'Praha, CZE'];
    expect(unicreditPayee('Platba u obchodníka', lines)).toBe('ACME Market Praha');
  });

  it("names a domestic payment's payee, else its message", () => {
    expect(unicreditPayee('Tuzemská platba okamžitá - Mobile Banking', ['Příjemce: ACME Bydlení', 'Popis: Nájem'])).toBe('ACME Bydlení');
    expect(unicreditPayee('Tuzemská platba - Mobile Banking', ['Popis: Faktura ID 12026'])).toBe('Faktura ID 12026');
  });

  it('names the payer of a transfer within the bank, and the cash machine', () => {
    expect(unicreditPayee('PŘEVOD V RÁMCI BANKY', ['Příchozí úhrada', 'Plátce: ACME Holding a.s.'])).toBe('ACME Holding a.s.');
    expect(unicreditPayee('PŘEVOD V RÁMCI BANKY', ['Odchozí úhrada', 'Popis: VS 2026'])).toBe('PŘEVOD V RÁMCI BANKY');
    expect(unicreditPayee('Výběr z bankomatu', ['CZK 2.000,00', 'ACME ATM Brno, CZE'])).toBe('Výběr z bankomatu, ACME ATM Brno');
  });

  it('keeps the kind of transaction when the lines name nobody', () => {
    expect(unicreditPayee('Platba u obchodníka', ['1111-2XXX-XX33-0000'])).toBe('Platba u obchodníka');
    expect(unicreditPayee('Úroky', [])).toBe('Úroky');
  });
});

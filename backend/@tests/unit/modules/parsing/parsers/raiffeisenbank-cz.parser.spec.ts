import { BankName, FileType } from '@/entities/statement.entity';
import {
  isRaiffeisenbankCzStatement,
  RaiffeisenbankCzParser,
  raiffeisenbankPayee,
} from '@/modules/parsing/parsers/raiffeisenbank-cz.parser';

const STATEMENT = ['Raiffeisenbank a.s.', 'Výpis z běžného účtu', 'Číslo účtu: 1234567890/5500', 'BIC: RZBCCZPP'].join(
  '\n',
);

describe('RaiffeisenbankCzParser', () => {
  it('knows its statement by the bank and its own account with the bank code 5500', () => {
    expect(isRaiffeisenbankCzStatement(STATEMENT)).toBe(true);
    expect(isRaiffeisenbankCzStatement('RAIFFEISENBANK A.S.\nIBAN: CZ12 5500 0000 0012 3456 7890')).toBe(true);
    expect(isRaiffeisenbankCzStatement('Raiffeisenbank a.s.\nIBAN: CZ1255000000001234567890')).toBe(true);
    expect(isRaiffeisenbankCzStatement('Raiffeisenbank a.s.\nČíslo účtu: 1234567890 / 5500')).toBe(true);
  });

  it("does not take another bank's short-header statement whose first row pays a Raiffeisenbank account", () => {
    const other = [
      'ACME Banka a.s.',
      'Výpis z účtu',
      'Číslo účtu: 1111111111/0600',
      'Datum Popis Částka',
      '2.3.2026 Platba na účet 1234567890/5500 Raiffeisenbank a.s. -100,00',
      'BIC: RZBCCZPP',
    ].join('\n');
    expect(isRaiffeisenbankCzStatement(other)).toBe(false);
  });

  it("leaves the Romanian Raiffeisen Bank, and another bank's statement paying a Raiffeisenbank account, alone", () => {
    expect(isRaiffeisenbankCzStatement('RAIFFEISEN BANK S.A.\nCod BIC: RZBRROBU\nCont: RO49 RZBR 0000 0600 0123 4567')).toBe(
      false,
    );
    const header = Array.from({ length: 25 }, (_, n) => `ACME Banka line ${n}`).join('\n');
    expect(isRaiffeisenbankCzStatement(`${header}\nPlatba na účet 1234567890/5500 Raiffeisenbank a.s.`)).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new RaiffeisenbankCzParser();
    const claims = (bank: BankName, type = FileType.PDF) => parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.RAIFFEISENBANK_CZ)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.RAIFFEISEN)).resolves.toBe(false);
  });
});

describe('raiffeisenbankPayee', () => {
  it("names the counterparty on the transaction code's line", () => {
    expect(raiffeisenbankPayee(['2900000001/0800', '8436776101 Zaměstnavatel One s.r.o.'])).toBe('Zaměstnavatel One s.r.o.');
  });

  it("does not take an account number for a transaction code", () => {
    expect(raiffeisenbankPayee(['2900000001/0800'])).toBeNull();
  });

  it('names the card merchant, not the card', () => {
    expect(raiffeisenbankPayee(['8436776102 PK: 516844XXXXXX4400', 'ACME POTRAVINY; PRAHA 4; CZE'])).toBe('ACME POTRAVINY');
    expect(
      raiffeisenbankPayee(['3,00 EUR', '8436776103 PK: 516844XXXXXX4400 25,10 CZK/EUR', '3,00 EUR;ACME FUEL 731 SVIT; Svit; SVK']),
    ).toBe('ACME FUEL 731 SVIT');
  });

  it("takes no payee from the value date's line, whatever number it carries", () => {
    expect(raiffeisenbankPayee(['2. 3. 2026 123456789012 0308', '8436776101 ACME s.r.o.'])).toBe('ACME s.r.o.');
  });

  it('names nobody for a card whose merchant line is missing', () => {
    expect(raiffeisenbankPayee(['3. 3. 2026', '8436776102 PK: 516844XXXXXX4400'])).toBeNull();
  });

  it('names nobody where the block names nobody', () => {
    expect(raiffeisenbankPayee(['8436776105'])).toBeNull();
  });
});

import { BankName, FileType } from '@/entities/statement.entity';
import { FioParser, fioPayee, isFioStatement } from '@/modules/parsing/parsers/fio.parser';

const STATEMENT = ['Fio banka, a.s.', 'Výpis z účtu', 'Číslo účtu: 1234567890/2010', 'BIC FIOBCZPPXXX', 'Měna účtu CZK'].join(
  '\n',
);

describe('FioParser', () => {
  it('knows its statement by the bank name or its BIC, Czech or Slovak', () => {
    expect(isFioStatement(STATEMENT)).toBe(true);
    expect(isFioStatement('BIC FIOZSKBAXXX\nVýpis z účtu\nMena účtu EUR')).toBe(true);
    // A payment to a Fio account in another bank's statement names only its bank code.
    expect(isFioStatement('Příchozí platba 2900000001/2010 ACME s.r.o.')).toBe(false);
  });

  it('reads the name in any case and spacing, with the currency line of its header', () => {
    expect(isFioStatement('FIO BANKA, A.S.\nVýpis z účtu\nMěna účtu CZK')).toBe(true);
    expect(isFioStatement('Fio banka a.s.\nMena účtu EUR')).toBe(true);
    expect(isFioStatement('www.fio.cz\nMěna účtu CZK')).toBe(true);
  });

  it("is not fooled by another bank's statement whose row names Fio", () => {
    const header = Array.from({ length: 20 }, (_, n) => `ACME Bank statement line ${n}`).join('\n');
    // A transfer from a Fio account, its BIC and the bank's name in the row.
    const row = 'Incoming transfer from Member Two, CZ6520100000002900000001, BIC FIOBCZPPXXX, Fio banka';
    expect(isFioStatement(`${header}\n${row}`)).toBe(false);
    // Nor by the bank's name at the top without the header's currency line.
    expect(isFioStatement('Payment to Fio banka, a.s.\nAmount 12.00')).toBe(false);
  });

  it("is not fooled by another Czech bank's statement that prints the currency line and a Fio row early", () => {
    const other = [
      'ACME Banka, a.s.',
      'Výpis z účtu',
      'IBAN CZ65 0800 0000 1920 0014 5399',
      'Měna účtu CZK',
      '2.3.2026 Příchozí SEPA platba FIOBCZPPXXX 1 000,00',
      'Fio banka, a.s.',
    ].join('\n');
    expect(isFioStatement(other)).toBe(false);
    // A row naming the bank mid-line is no header line either.
    expect(isFioStatement('ACME Banka\nMěna účtu CZK\nPlatba Fio banka 12,00')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new FioParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.FIO)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.KBC)).resolves.toBe(false);
    await expect(claims(BankName.FIO, FileType.CSV)).resolves.toBe(false);
  });
});

describe('fioPayee', () => {
  it('names the card merchant', () => {
    expect(
      fioPayee('Platba kartou', ['Nákup: ACME Potraviny, Hlavní 12, Praha, CZE,', 'dne 1.3.2026, částka 245.90 CZK']),
    ).toBe('ACME Potraviny');
  });

  it('names the cash machine of a cash deposit', () => {
    expect(fioPayee('Vklad do bankomatu', ['Vklad do bankomatu: ACME Mall, Bratislava, SVK'])).toBe(
      'Vklad do bankomatu: ACME Mall',
    );
  });

  it('names the sender of a deposit', () => {
    expect(fioPayee('Bezhotovostní vklad', ['Bezhotovostní vklad Člen Dva', '27500000005'])).toBe('Člen Dva');
  });

  it('takes the first line that names someone, past the id, the symbols and a bare date', () => {
    expect(fioPayee('Úhrada CZ6508000000192000145399', ['28.2.2026', 'ACME Energie a.s.', '27500000016 VS: 778899'])).toBe(
      'ACME Energie a.s.',
    );
  });

  it('leaves the operation id and symbols printed beside the name out of it', () => {
    expect(fioPayee('Příchozí platba', ['Zaměstnavatel One s.r.o. 27500000021 VS: 2026040'])).toBe(
      'Zaměstnavatel One s.r.o.',
    );
  });

  it('falls back on the operation without the account', () => {
    expect(fioPayee('Úhrada CZ6508000000192000145399', ['27500000016 VS: 778899'])).toBe('Úhrada');
  });
});

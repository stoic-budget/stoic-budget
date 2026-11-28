import {
  findAccountCurrency,
  findCzechAccount,
  readPaymentSymbols,
  withoutCzechAccount,
} from '@/modules/parsing/helpers/statement-czech-account.helper';

describe('findCzechAccount', () => {
  it.each([
    ['Příchozí platba 2900000001/0800', '2900000001/0800'],
    ['Trvalý příkaz 19-1234567890/0100', '19-1234567890/0100'],
    ['ACME s.r.o. 5500000001 / 0100', '5500000001/0100'],
    ['Úhrada CZ65 0800 0000 1920 0014 5399', 'CZ6508000000192000145399'],
    ['Bezhotovostný vklad SK3112000000001987426353', 'SK3112000000001987426353'],
  ])('reads %s', (text, account) => {
    expect(findCzechAccount(text)).toBe(account);
  });

  it('does not read a date or a figure as an account', () => {
    expect(findCzechAccount('dne 1.3.2026, částka 245.90 CZK')).toBeNull();
    expect(findCzechAccount('Splátka 12/2026')).toBeNull();
  });

  it('takes the account out of the text', () => {
    expect(withoutCzechAccount('Příchozí platba 2900000001/0800')).toBe('Příchozí platba');
  });
});

describe('readPaymentSymbols', () => {
  it('reads the variable, constant and specific symbols', () => {
    expect(readPaymentSymbols('27500000016 VS: 778899 KS: 0308 SS: 12')).toEqual({
      vs: '778899',
      ks: '0308',
      ss: '12',
    });
  });

  it('finds none in a plain line', () => {
    expect(readPaymentSymbols('Nájem ACME Bydlení')).toEqual({});
  });
});

describe('findAccountCurrency', () => {
  it.each([
    ['Měna účtu CZK', 'CZK'],
    ['Mena účtu EUR', 'EUR'],
    ['Mena účtu: EUR', 'EUR'],
    ['Měna: CZK', 'CZK'],
  ])('reads %s', (text, currency) => {
    expect(findAccountCurrency(text)).toBe(currency);
  });

  it('finds none where the header names none', () => {
    expect(findAccountCurrency('Výpis z účtu')).toBeNull();
  });

  it("does not take a payment's currency in a row for the account's", () => {
    expect(findAccountCurrency('Výpis z účtu\nPlatba kartou Měna USD Kurz 23,10')).toBeNull();
  });
});

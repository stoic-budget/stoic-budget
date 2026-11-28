import {
  descriptionAsPayee,
  mostCommonCurrency,
} from '@/modules/parsing/helpers/tabular-columns.helper';

describe('descriptionAsPayee', () => {
  it('reads a lone Description column as the payee', () => {
    expect(descriptionAsPayee(['date', 'description', 'amount'], { date: 0, purpose: 1, amount: 2 })).toEqual({
      date: 0,
      counterparty: 1,
      amount: 2,
    });
  });

  it('keeps a description as purpose when the file names the payee', () => {
    const mapping = { date: 0, counterparty: 1, purpose: 2, amount: 3 };
    expect(descriptionAsPayee(['date', 'payee', 'description', 'amount'], mapping)).toBe(mapping);
  });

  it('keeps a payment purpose a purpose', () => {
    const mapping = { date: 0, purpose: 1, amount: 2 };
    expect(descriptionAsPayee(['дата', 'назначение платежа', 'сумма'], mapping)).toBe(mapping);
  });
});

describe('mostCommonCurrency', () => {
  it('names the currency most rows carry', () => {
    expect(mostCommonCurrency([{ currency: 'EUR' }, { currency: 'USD' }, { currency: 'EUR' }])).toBe('EUR');
  });

  it('has nothing to say without rows', () => {
    expect(mostCommonCurrency([])).toBeNull();
  });
});

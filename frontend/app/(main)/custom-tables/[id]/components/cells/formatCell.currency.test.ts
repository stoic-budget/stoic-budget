import { describe, expect, it } from 'vitest';
import type { CustomTableColumn, CustomTableGridRow } from '../../utils/types';
import { formatCellText, inRowCurrency, rowCurrencyKey } from './formatCell';

const AMOUNT = {
  id: 'c-amount',
  key: 'amount',
  title: 'Amount',
  type: 'currency',
  // The code the column took from the first row when the table was made.
  config: { currency: 'USD', precision: 2, source: { kind: 'app_field', field: 'amount' } },
} as unknown as CustomTableColumn;
const CODE = {
  id: 'c-code',
  key: 'code',
  title: 'Currency',
  type: 'text',
  config: { source: { kind: 'app_field', field: 'currency' } },
} as unknown as CustomTableColumn;
const row = (amount: number, code: string | null) =>
  ({ id: `r-${code}`, data: { amount, code } }) as unknown as CustomTableGridRow;
const labels = { yes: 'Yes', no: 'No' };

describe('money cells in a table made from transactions (#648)', () => {
  const key = rowCurrencyKey([AMOUNT, CODE]);

  it("shows each amount in its own row's currency", () => {
    const shekels = row(3500, 'ILS');
    const dollars = row(100, 'USD');

    expect(formatCellText(inRowCurrency(AMOUNT, shekels, key), shekels, 'EUR', labels)).toMatch(
      /₪/,
    );
    expect(formatCellText(inRowCurrency(AMOUNT, dollars, key), dollars, 'EUR', labels)).toMatch(
      /\$/,
    );
  });

  it("keeps the column's code for a row without one, and any other column as it is", () => {
    const blank = row(5, null);
    expect(inRowCurrency(AMOUNT, blank, key)).toBe(AMOUNT);
    expect(inRowCurrency(CODE, row(5, 'ILS'), key)).toBe(CODE);
    expect(inRowCurrency(AMOUNT, row(5, 'ILS'), rowCurrencyKey([AMOUNT]))).toBe(AMOUNT);
  });

  it('keeps the code of a currency column the user added, and needs a text code column', () => {
    const planned = {
      ...AMOUNT,
      key: 'planned',
      config: { currency: 'EUR', precision: 2 },
    } as unknown as CustomTableColumn;
    expect(inRowCurrency(planned, row(5, 'ILS'), key)).toBe(planned);
    const picked = { ...CODE, type: 'select' } as unknown as CustomTableColumn;
    expect(rowCurrencyKey([AMOUNT, picked])).toBeUndefined();
  });

  it('reads a lower-case or padded code', () => {
    const padded = row(5, ' ils ');
    expect(inRowCurrency(AMOUNT, padded, key).config?.currency).toBe('ILS');
    expect(inRowCurrency(AMOUNT, row(5, 'US$'), key)).toBe(AMOUNT);
  });
});

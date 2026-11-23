import { describe, expect, it } from 'vitest';
import { computeTotals, type TaxRateOption } from './useInvoiceForm';

const STANDARD: TaxRateOption = { id: 'standard', name: 'Standard 19%', rate: 19 };
const REVERSE: TaxRateOption = { id: 'reverse', name: 'Reverse charge 19%', rate: 19, isReverseCharge: true };
const line = (unitPrice: number, taxRateId: string) => ({
  description: 'ACME Consulting',
  quantity: 1,
  unitPrice,
  taxRateId,
});

describe('invoice totals in the wizard (#684)', () => {
  it('charges no VAT on a reverse-charge rate', () => {
    expect(computeTotals([line(100, 'reverse')], [STANDARD, REVERSE], false)).toEqual({
      subtotal: 100,
      taxTotal: 0,
      total: 100,
    });
  });

  it("rounds each line's tax to the cent, as the server stores it", () => {
    const lines = [line(9.99, 'standard'), line(9.99, 'standard'), line(9.99, 'standard')];
    expect(computeTotals(lines, [STANDARD], false)).toEqual({
      subtotal: 29.97,
      taxTotal: 5.7,
      total: 35.67,
    });
  });
});

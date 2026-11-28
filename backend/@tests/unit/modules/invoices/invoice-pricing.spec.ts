import {
  lineAdjustmentAmount,
  lineAmount,
  type PricableLine,
} from '../../../../src/modules/invoices/invoice-pricing';

const line = (overrides: Partial<PricableLine>): PricableLine => ({
  description: 'Work',
  quantity: 1,
  unitPrice: 100,
  taxRateId: null,
  categoryId: null,
  ...overrides,
});

describe('line amount with a discount or surcharge', () => {
  it('is quantity × price when the line has neither', () => {
    expect(lineAmount(line({ quantity: 3, unitPrice: 33.33 }))).toBe(99.99);
  });

  it('takes a discount off and adds a surcharge, each rounded to cents first', () => {
    expect(lineAdjustmentAmount(line({ quantity: 2, unitPrice: 29.9, adjustmentPercent: -5 }))).toBe(-2.99);
    expect(lineAmount(line({ quantity: 2, unitPrice: 29.9, adjustmentPercent: -5 }))).toBe(56.81);
    expect(lineAmount(line({ quantity: 3, unitPrice: 11.1, adjustmentPercent: '10.00' }))).toBe(36.63);
  });

  it('reads a stored decimal string and a full discount', () => {
    expect(lineAmount(line({ adjustmentPercent: '-100.00' }))).toBe(0);
    expect(lineAmount(line({ adjustmentPercent: null }))).toBe(100);
  });
});

describe('invoice totals, tax rounded once per rate', () => {
  const manager = {
    getRepository: () => ({
      findBy: async () => [{ id: 'rate-19', rate: '19', name: 'Standard', isReverseCharge: false }],
    }),
  } as never;

  it('prices three lines of 10.00 including 19 % as the e-invoice does', async () => {
    const { totalsFor } = await import('../../../../src/modules/invoices/invoice-pricing');
    const lines = [1, 2, 3].map(() => line({ unitPrice: 10, taxRateId: 'rate-19' }));

    expect(await totalsFor(manager, lines, true)).toEqual({ subtotal: 25.21, taxTotal: 4.79, total: 30 });
  });

  it('credits each invoice of a credit note with its own lines', async () => {
    const { priceEach, totalsOf } = await import('../../../../src/modules/invoices/invoice-pricing');
    const invoice = [line({ unitPrice: 12.31, taxRateId: 'rate-19' })];

    const priced = await priceEach(manager, [{ lines: invoice }, { lines: invoice }], false);

    expect(totalsOf(priced.slice(0, 1)).total).toBe(totalsOf(priced.slice(1)).total);
  });
});

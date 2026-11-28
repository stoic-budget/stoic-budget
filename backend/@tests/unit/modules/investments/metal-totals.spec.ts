import type { MetalLot } from '@/contracts';
import { metalTotals } from '@/modules/investments/metal-totals';

const DISCOUNTS = { XAU: 3, XAG: 8, XPT: 6, XPD: 6 };
const lot = (name: string, value: number, fineOunces: number, cost: number | null) =>
  ({
    id: name,
    name,
    metal: 'XAU',
    fineOunces,
    price: value / fineOunces,
    pricedAt: '2026-11-20T10:00:00.000Z',
    value,
    dealerValue: value * 0.97,
    cost,
    insured: null,
  }) as unknown as MetalLot;

describe('metalTotals (#655)', () => {
  it('leaves a lot without a purchase price out of the gain and the cost per ounce', () => {
    const totals = metalTotals(
      [lot('ACME coin', 2600, 1, 2000), lot('Inherited bar', 5200, 2, null)],
      [],
      DISCOUNTS,
    );

    expect(totals).toMatchObject({ value: 7800, cost: 2000, gain: 600, unpricedLots: 1 });
    expect(totals.byMetal[0]).toMatchObject({
      value: 7800,
      cost: 2000,
      gain: 600,
      costPerOunce: 2000,
      unpricedLots: 1,
    });
  });

  it('has no gain and no cost per ounce when no lot has a price', () => {
    const totals = metalTotals([lot('Inherited bar', 5200, 2, null)], [], DISCOUNTS);

    expect(totals).toMatchObject({ gain: 0, unpricedLots: 1 });
    expect(totals.byMetal[0]).toMatchObject({ gain: 0, costPerOunce: null });
  });
});

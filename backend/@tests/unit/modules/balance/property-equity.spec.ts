import { BalanceAccountType } from '@/entities/balance-account.entity';
import { attributesFor, propertyKindOf } from '@/modules/balance/property/property-kind';
import { depreciatedValue, propertyEquity } from '@/modules/balance/property/property-math';

describe('depreciatedValue', () => {
  const base = 10_000;

  it('loses the rate over one year', () => {
    expect(depreciatedValue(base, 15, '2025-03-01', '2026-03-01')).toBeCloseTo(8500, 6);
  });

  it('compounds year on year (declining balance, not straight line)', () => {
    expect(depreciatedValue(base, 20, '2024-01-01', '2025-12-31')).toBeCloseTo(
      base * 0.8 ** (730 / 365),
      6,
    );
    expect(depreciatedValue(base, 20, '2024-01-01', '2025-12-31')).toBeGreaterThan(base * 0.6);
  });

  it('takes part of a year in proportion', () => {
    expect(depreciatedValue(base, 20, '2026-01-01', '2026-07-02')).toBeCloseTo(
      base * 0.8 ** (182 / 365),
      6,
    );
  });

  it('is the valuation itself on its own day and on any day before it', () => {
    expect(depreciatedValue(base, 20, '2026-01-01', '2026-01-01')).toBe(base);
    expect(depreciatedValue(base, 20, '2026-01-01', '2025-06-01')).toBe(base);
  });

  it('reaches zero and stays there at 100 percent', () => {
    expect(depreciatedValue(base, 100, '2026-01-01', '2026-01-02')).toBe(0);
  });
});

describe('propertyEquity', () => {
  it('is the whole value without a linked debt, with no ratio', () => {
    expect(propertyEquity(300_000, null)).toEqual({ equity: 300_000, ltv: null });
  });

  it('subtracts a linked debt and gives the loan-to-value ratio', () => {
    expect(propertyEquity(300_000, 200_000)).toEqual({ equity: 100_000, ltv: 0.6667 });
  });

  it('goes negative when more is owed than the property is worth', () => {
    expect(propertyEquity(300_000, 360_000)).toEqual({ equity: -60_000, ltv: 1.2 });
  });

  it('has no ratio without a value to divide by', () => {
    expect(propertyEquity(0, 50_000)).toEqual({ equity: -50_000, ltv: null });
  });

  it('owes nothing on an overpaid loan', () => {
    expect(propertyEquity(300_000, -100)).toEqual({ equity: 300_000, ltv: 0 });
  });
});

describe('propertyKindOf', () => {
  const line = (id: string, code: string, extra: Record<string, unknown> = {}) =>
    ({
      id,
      code,
      parentId: null,
      accountType: BalanceAccountType.ASSET,
      isAutoComputed: false,
      ...extra,
    }) as never;
  const realEstate = line('re', 'ASSET_REAL_ESTATE');
  const vehicles = line('ve', 'ASSET_VEHICLES');
  const flat = line('flat', 'CUSTOM_1', { parentId: 're' });
  const other = line('other', 'ASSET_OTHER');
  const mortgage = line('m', 'LIABILITY_MORTGAGE', { accountType: BalanceAccountType.LIABILITY });

  it('reads the kind off the section a line sits in', () => {
    expect(propertyKindOf(vehicles, [realEstate, vehicles])).toBe('vehicle');
    expect(propertyKindOf(realEstate, [realEstate, vehicles])).toBe('real_estate');
    expect(propertyKindOf(flat, [realEstate, flat])).toBe('real_estate');
  });

  it('is no property for a section with lines under it, another section, or a debt', () => {
    expect(propertyKindOf(realEstate, [realEstate, flat])).toBeNull();
    expect(propertyKindOf(other, [other])).toBeNull();
    expect(propertyKindOf(mortgage, [mortgage])).toBeNull();
  });
});

describe('attributesFor', () => {
  it('keeps the attributes of the line kind', () => {
    expect(attributesFor('real_estate', { area: 72.5, areaUnit: 'm2', yearBuilt: 1998 })).toEqual({
      area: 72.5,
      areaUnit: 'm2',
      yearBuilt: 1998,
    });
    expect(attributesFor('vehicle', { make: 'ACME', mileage: 42_000, mileageUnit: 'km' })).toEqual(
      { make: 'ACME', mileage: 42_000, mileageUnit: 'km' },
    );
  });

  it('refuses the attributes of the other kind', () => {
    expect(attributesFor('real_estate', { make: 'ACME' })).toBeUndefined();
    expect(attributesFor('vehicle', { area: 50 })).toBeUndefined();
  });

  it('stores nothing filled in as null', () => {
    expect(attributesFor('vehicle', {})).toBeNull();
    expect(attributesFor('vehicle', null)).toBeNull();
  });
});

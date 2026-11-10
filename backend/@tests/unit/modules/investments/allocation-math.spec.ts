import { InvestmentAssetClass, InvestmentMetal } from '@/entities/investment-holding.entity';
import {
  type AllocationPosition,
  buildAllocation,
  spreadCents,
  toSlices,
} from '@/modules/investments/allocation-math';
import type { HoldingClassificationView } from '@/modules/investments/holding-classification';

const unset: HoldingClassificationView = {
  sector: null,
  region: null,
  country: null,
  lookThrough: null,
};

const position = (
  cents: number,
  assetClass: InvestmentAssetClass,
  classification: Partial<HoldingClassificationView> = {},
  metal: InvestmentMetal | null = null,
): AllocationPosition => ({
  cents,
  assetClass,
  metal,
  classification: { ...unset, ...classification },
});

const sumOf = (map: Map<string, number>) => [...map.values()].reduce((a, b) => a + b, 0);

describe('spreadCents', () => {
  it('splits by weights and keeps every cent', () => {
    const value = 100_001; // 1 000.01
    const parts = spreadCents(value, [
      { key: 'europe', weight: 33.33 },
      { key: 'asia', weight: 33.33 },
      { key: 'north_america', weight: 33.34 },
    ]);
    expect(sumOf(parts)).toBe(value);
    expect(parts.get('europe')).toBe(33_330);
    expect(parts.get('asia')).toBe(33_330);
    expect(parts.get('north_america')).toBe(33_341);
  });

  it('hands the leftover cents to the parts that lost most in rounding', () => {
    // 1 cent over three equal thirds: the first of the tie takes it.
    const parts = spreadCents(1, [
      { key: 'a', weight: 33.33 },
      { key: 'b', weight: 33.33 },
      { key: 'c', weight: 33.34 },
    ]);
    expect(sumOf(parts)).toBe(1);
    expect(parts.get('c')).toBe(1);
  });

  it('keeps the total on awkward weights and values', () => {
    for (const cents of [1, 7, 99, 12_345, 987_654_321]) {
      const parts = spreadCents(cents, [
        { key: 'a', weight: 0.01 },
        { key: 'b', weight: 12.34 },
        { key: 'c', weight: 87.65 },
      ]);
      expect(sumOf(parts)).toBe(cents);
    }
  });

  it('adds the remainder named "other" like any other key', () => {
    const parts = spreadCents(10_000, [
      { key: 'information_technology', weight: 60 },
      { key: 'other', weight: 40 },
    ]);
    expect(parts.get('other')).toBe(4_000);
  });

  it('puts a value with weights that add to nothing under unclassified, never drops it', () => {
    expect(spreadCents(500, [])).toEqual(new Map([['unclassified', 500]]));
  });
});

describe('buildAllocation', () => {
  const fund = position(200_000, InvestmentAssetClass.ETF, {
    region: 'europe', // its own single value: outweighed by the breakdown below
    lookThrough: {
      sector: null,
      region: [
        { key: 'north_america', weight: 60 },
        { key: 'europe', weight: 30 },
        { key: 'other', weight: 10 },
      ],
      country: [
        { key: 'US', weight: 55.55 },
        { key: 'other', weight: 44.45 },
      ],
    },
  });
  const stock = position(100_000, InvestmentAssetClass.STOCK, {
    sector: 'information_technology',
    region: 'north_america',
    country: 'US',
  });
  const gold = position(50_000, InvestmentAssetClass.METAL, {}, InvestmentMetal.GOLD);
  const bond = position(25_001, InvestmentAssetClass.BOND);

  const totals = buildAllocation([fund, stock, gold, bond, position(0, InvestmentAssetClass.CASH)]);

  it('adds every cut up to the same total', () => {
    expect(totals.totalCents).toBe(375_001);
    for (const cut of [totals.sector, totals.region, totals.country]) {
      expect(sumOf(cut)).toBe(375_001);
    }
  });

  it('spreads a fund by its breakdown where it has one', () => {
    expect(totals.region.get('north_america')).toBe(120_000 + 100_000);
    expect(totals.region.get('europe')).toBe(60_000);
    expect(totals.region.get('other')).toBe(20_000);
    expect(totals.country.get('US')).toBe(111_100 + 100_000);
  });

  it('counts a fund without a breakdown in a dimension by its own value, or as unclassified', () => {
    // The fund has no sector breakdown and no sector: its whole value is unclassified.
    expect(totals.sector.get('unclassified')).toBe(200_000 + 50_000 + 25_001);
    expect(totals.sector.get('information_technology')).toBe(100_000);
  });

  it('nests the holding classes and metals under the broad classes', () => {
    expect(totals.classes.get('equity')).toEqual(
      new Map([
        ['etf', 200_000],
        ['stock', 100_000],
      ]),
    );
    expect(totals.classes.get('commodities')).toEqual(new Map([['gold', 50_000]]));
    expect(totals.classes.get('fixed_income')).toEqual(new Map([['bond', 25_001]]));
    // A holding worth nothing takes no slice.
    expect(totals.classes.has('cash')).toBe(false);
  });
});

describe('toSlices', () => {
  it('orders by size, keeps other and unclassified last and turns cents into money', () => {
    const slices = toSlices(
      new Map([
        ['unclassified', 90_000],
        ['europe', 10_000],
        ['other', 50_000],
        ['asia', 20_000],
      ]),
      170_000,
    );
    expect(slices.map(slice => slice.key)).toEqual(['asia', 'europe', 'other', 'unclassified']);
    expect(slices[0]).toEqual({ key: 'asia', amount: 200, percent: 11.76 });
  });
});

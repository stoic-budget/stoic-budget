import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import { HoldingClassificationBody } from '@/contracts';
import { InvestmentAssetClass, type InvestmentHolding } from '@/entities/investment-holding.entity';
import {
  readClassification,
  setAssetClass,
  toStoredLookThrough,
} from '@/modules/investments/holding-classification';

const holding = (overrides: Partial<InvestmentHolding> = {}) =>
  ({
    assetClass: InvestmentAssetClass.ETF,
    sector: null,
    region: null,
    country: null,
    lookThrough: null,
    ...overrides,
  }) as InvestmentHolding;

const decodes = (body: unknown) =>
  Exit.isSuccess(
    Schema.decodeUnknownExit(HoldingClassificationBody, { onExcessProperty: 'error' })(body),
  );

describe('readClassification', () => {
  it('reads known values and nulls out words no longer on the lists', () => {
    expect(
      readClassification(holding({ sector: 'energy', region: 'atlantis', country: 'ZZ' })),
    ).toEqual({ sector: 'energy', region: null, country: null, lookThrough: null });
  });

  it('folds a breakdown key that is no longer on the list into other, keeping the 100', () => {
    const view = readClassification(
      holding({
        lookThrough: {
          sector: [
            { key: 'energy', weight: 50 },
            { key: 'retired_sector', weight: 20 },
            { key: 'other', weight: 30 },
          ],
        },
      }),
    );
    expect(view.lookThrough).toEqual({
      sector: [
        { key: 'energy', weight: 50 },
        { key: 'other', weight: 50 },
      ],
      region: null,
      country: null,
    });
  });

  it('reads a dimension that names nothing but other as none', () => {
    const view = readClassification(
      holding({
        lookThrough: {
          sector: [{ key: 'energy', weight: 100 }],
          region: [
            { key: 'atlantis', weight: 60 },
            { key: 'other', weight: 40 },
          ],
          country: [{ key: 'other', weight: 100 }],
        },
      }),
    );
    expect(view.lookThrough).toEqual({
      sector: [{ key: 'energy', weight: 100 }],
      region: null,
      country: null,
    });
  });

  it('ignores a breakdown left on a holding that is no fund', () => {
    const view = readClassification(
      holding({
        assetClass: InvestmentAssetClass.STOCK,
        lookThrough: { region: [{ key: 'europe', weight: 100 }] },
      }),
    );
    expect(view.lookThrough).toBeNull();
  });
});

describe('setAssetClass', () => {
  it('drops the breakdown when a fund becomes something else', () => {
    const fund = holding({ lookThrough: { region: [{ key: 'europe', weight: 100 }] } });
    setAssetClass(fund, InvestmentAssetClass.FUND);
    expect(fund.lookThrough).not.toBeNull();
    setAssetClass(fund, InvestmentAssetClass.STOCK);
    expect(fund.assetClass).toBe(InvestmentAssetClass.STOCK);
    expect(fund.lookThrough).toBeNull();
  });
});

describe('toStoredLookThrough', () => {
  it('stores null when no dimension has weights', () => {
    expect(toStoredLookThrough({ sector: null, region: undefined })).toBeNull();
    expect(toStoredLookThrough(null)).toBeNull();
  });

  it('stores each dimension, null where there is none', () => {
    expect(toStoredLookThrough({ region: [{ key: 'asia', weight: 100 }] })).toEqual({
      sector: null,
      region: [{ key: 'asia', weight: 100 }],
      country: null,
    });
  });
});

describe('HoldingClassificationBody', () => {
  const thirds = [
    { key: 'europe', weight: 33.33 },
    { key: 'asia', weight: 33.33 },
    { key: 'other', weight: 33.34 },
  ];

  it('takes weights that add up to exactly 100, other included', () => {
    expect(decodes({ lookThrough: { region: thirds } })).toBe(true);
    expect(decodes({ lookThrough: { sector: [{ key: 'energy', weight: 8.2 }, { key: 'other', weight: 91.8 }] } })).toBe(true);
    expect(decodes({ lookThrough: { country: [{ key: 'US', weight: 0.1 }, { key: 'DE', weight: 0.2 }, { key: 'other', weight: 99.7 }] } })).toBe(true);
  });

  it('refuses weights short of or over 100', () => {
    expect(decodes({ lookThrough: { region: thirds.slice(0, 2) } })).toBe(false);
    expect(decodes({ lookThrough: { region: [...thirds, { key: 'africa', weight: 1 }] } })).toBe(false);
  });

  it('refuses a key twice, a zero weight, three decimals and an empty list', () => {
    expect(decodes({ lookThrough: { region: [{ key: 'asia', weight: 50 }, { key: 'asia', weight: 50 }] } })).toBe(false);
    expect(decodes({ lookThrough: { region: [{ key: 'asia', weight: 0 }, { key: 'other', weight: 100 }] } })).toBe(false);
    expect(decodes({ lookThrough: { region: [{ key: 'asia', weight: 50.005 }, { key: 'other', weight: 49.995 }] } })).toBe(false);
    expect(decodes({ lookThrough: { region: [] } })).toBe(false);
  });

  it('refuses a dimension that names nothing but other', () => {
    expect(decodes({ lookThrough: { region: [{ key: 'other', weight: 100 }] } })).toBe(false);
  });

  it('refuses words that are not on the lists', () => {
    expect(decodes({ sector: 'technology' })).toBe(false);
    expect(decodes({ country: 'us' })).toBe(false);
    expect(decodes({ country: 'ZZ' })).toBe(false);
    expect(decodes({ lookThrough: { sector: [{ key: 'unclassified', weight: 100 }] } })).toBe(false);
    expect(decodes({ sector: 'energy', region: 'europe', country: 'DE' })).toBe(true);
  });
});

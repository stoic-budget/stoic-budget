import {
  type AllocationClass,
  type AllocationSubclass,
  OTHER_SHARE,
  UNCLASSIFIED,
} from '../../contracts';
import { InvestmentAssetClass, InvestmentMetal } from '../../entities/investment-holding.entity';
import { type HoldingClassificationView, LOOK_THROUGH_DIMENSIONS } from './holding-classification';

/** One holding as the allocation sees it: its value in whole cents of the workspace currency. */
export interface AllocationPosition {
  cents: number;
  assetClass: InvestmentAssetClass;
  metal: InvestmentMetal | null;
  classification: HoldingClassificationView;
}

const CLASS_OF: Record<InvestmentAssetClass, AllocationClass> = {
  [InvestmentAssetClass.STOCK]: 'equity',
  [InvestmentAssetClass.ETF]: 'equity',
  [InvestmentAssetClass.FUND]: 'equity',
  [InvestmentAssetClass.BOND]: 'fixed_income',
  [InvestmentAssetClass.CASH]: 'cash',
  [InvestmentAssetClass.REAL_ESTATE]: 'real_estate',
  [InvestmentAssetClass.METAL]: 'commodities',
  [InvestmentAssetClass.OTHER]: 'other',
};

const SUBCLASS_OF: Record<
  Exclude<InvestmentAssetClass, InvestmentAssetClass.METAL>,
  AllocationSubclass
> = {
  [InvestmentAssetClass.STOCK]: 'stock',
  [InvestmentAssetClass.ETF]: 'etf',
  [InvestmentAssetClass.FUND]: 'fund',
  [InvestmentAssetClass.BOND]: 'bond',
  [InvestmentAssetClass.CASH]: 'cash',
  [InvestmentAssetClass.REAL_ESTATE]: 'real_estate',
  [InvestmentAssetClass.OTHER]: 'other',
};

const METAL_SUBCLASS: Record<InvestmentMetal, AllocationSubclass> = {
  [InvestmentMetal.GOLD]: 'gold',
  [InvestmentMetal.SILVER]: 'silver',
  [InvestmentMetal.PLATINUM]: 'platinum',
  [InvestmentMetal.PALLADIUM]: 'palladium',
};

function subclassOf(position: AllocationPosition): AllocationSubclass {
  if (position.assetClass === InvestmentAssetClass.METAL) {
    return position.metal ? METAL_SUBCLASS[position.metal] : 'other';
  }
  return SUBCLASS_OF[position.assetClass];
}

/**
 * Splits `cents` by `weights` (percent, two decimals) so the parts add up to
 * `cents` exactly: each part is rounded down, and the cents left over go one
 * by one to the parts that lost the most in rounding (the earlier on a tie).
 * Integer arithmetic throughout, so no float ever drops or adds a cent.
 */
export function spreadCents(
  cents: number,
  weights: ReadonlyArray<{ key: string; weight: number }>,
): Map<string, number> {
  const parts = weights.map(row => BigInt(Math.round(row.weight * 100)));
  const sum = parts.reduce((total, part) => total + part, 0n);
  const result = new Map<string, number>();
  if (sum <= 0n) {
    result.set(UNCLASSIFIED, cents);
    return result;
  }
  const whole = BigInt(cents);
  const floors = parts.map(part => (whole * part) / sum);
  const remainders = parts.map(part => (whole * part) % sum);
  let left = Number(whole - floors.reduce((total, part) => total + part, 0n));
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
  const extra = new Array<number>(parts.length).fill(0);
  for (const { index } of order) {
    if (left <= 0) break;
    extra[index] = 1;
    left -= 1;
  }
  weights.forEach((row, index) => {
    const share = Number(floors[index]) + extra[index];
    result.set(row.key, (result.get(row.key) ?? 0) + share);
  });
  return result;
}

const add = (map: Map<string, number>, key: string, cents: number) =>
  map.set(key, (map.get(key) ?? 0) + cents);

export interface AllocationTotals {
  totalCents: number;
  classes: Map<string, Map<string, number>>;
  sector: Map<string, number>;
  region: Map<string, number>;
  country: Map<string, number>;
}

/**
 * Adds the holdings up four ways. Per dimension, a fund's breakdown spreads
 * its value; without one the holding's own value takes all of it; without
 * that either, it is unclassified. Every cut adds up to the same total.
 */
export function buildAllocation(positions: readonly AllocationPosition[]): AllocationTotals {
  const totals: AllocationTotals = {
    totalCents: 0,
    classes: new Map(),
    sector: new Map(),
    region: new Map(),
    country: new Map(),
  };
  for (const position of positions) {
    if (position.cents <= 0) continue;
    totals.totalCents += position.cents;
    const group = CLASS_OF[position.assetClass];
    const subclasses = totals.classes.get(group) ?? new Map<string, number>();
    totals.classes.set(group, add(subclasses, subclassOf(position), position.cents));
    for (const dimension of LOOK_THROUGH_DIMENSIONS) {
      const weights = position.classification.lookThrough?.[dimension];
      if (weights) {
        for (const [key, cents] of spreadCents(position.cents, weights)) {
          add(totals[dimension], key, cents);
        }
      } else {
        add(totals[dimension], position.classification[dimension] ?? UNCLASSIFIED, position.cents);
      }
    }
  }
  return totals;
}

const LAST = [OTHER_SHARE, UNCLASSIFIED];

/** Largest first; "other" and "unclassified" at the end, whatever their size. */
export function toSlices<K extends string>(
  map: Map<string, number>,
  totalCents: number,
): Array<{ key: K; amount: number; percent: number }> {
  return [...map]
    .filter(([, cents]) => cents !== 0)
    .sort(([keyA, a], [keyB, b]) => {
      const lastA = LAST.indexOf(keyA);
      const lastB = LAST.indexOf(keyB);
      if (lastA !== lastB) return lastA - lastB;
      return b - a || keyA.localeCompare(keyB);
    })
    .map(([key, cents]) => ({
      key: key as K,
      amount: cents / 100,
      percent: totalCents > 0 ? Math.round((cents / totalCents) * 10_000) / 100 : 0,
    }));
}

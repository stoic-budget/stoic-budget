import {
  HOLDING_REGIONS,
  HOLDING_SECTORS,
  type HoldingCountry,
  type HoldingLookThrough,
  type HoldingRegion,
  type HoldingSector,
  ISO_COUNTRIES,
  LOOK_THROUGH_CLASSES,
  type LookThroughInput,
  OTHER_SHARE,
} from '../../contracts';
import type {
  HoldingLookThroughRecord,
  InvestmentAssetClass,
  InvestmentHolding,
  LookThroughDimension,
} from '../../entities/investment-holding.entity';

export const LOOK_THROUGH_DIMENSIONS: readonly LookThroughDimension[] = [
  'sector',
  'region',
  'country',
];

const KNOWN: Record<LookThroughDimension, ReadonlySet<string>> = {
  sector: new Set(HOLDING_SECTORS),
  region: new Set(HOLDING_REGIONS),
  country: new Set(ISO_COUNTRIES),
};

/** Whether a holding of this class may carry a breakdown: one that holds other things. */
export function takesLookThrough(assetClass: InvestmentAssetClass): boolean {
  return (LOOK_THROUGH_CLASSES as readonly string[]).includes(assetClass);
}

/**
 * Changes a holding's class. A breakdown belongs to a fund: moved to any other
 * class, the holding loses it, so a stock never spreads by weights nobody sees.
 */
export function setAssetClass(holding: InvestmentHolding, assetClass: InvestmentAssetClass): void {
  holding.assetClass = assetClass;
  if (!takesLookThrough(assetClass)) {
    holding.lookThrough = null;
  }
}

/** A stored single value, or null when it is not (or no longer) one of the list's words. */
function known<T extends string>(dimension: LookThroughDimension, value: string | null): T | null {
  return value !== null && KNOWN[dimension].has(value) ? (value as T) : null;
}

/**
 * A stored breakdown as the API reads it. A key that is no longer on the list
 * folds into `other`, so the weights still add up to 100 and the fund's value
 * is never lost on the way. One that names nothing but `other` reads as none,
 * as the API refuses to store it: the editor could not show it.
 */
function readWeights(dimension: LookThroughDimension, stored: HoldingLookThroughRecord | null) {
  const rows = stored?.[dimension];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const weights = new Map<string, number>();
  for (const row of rows) {
    const weight = Number(row?.weight);
    if (!(Number.isFinite(weight) && weight > 0)) continue;
    const key = KNOWN[dimension].has(row.key) ? row.key : OTHER_SHARE;
    weights.set(key, Math.round(((weights.get(key) ?? 0) + weight) * 100) / 100);
  }
  const named = [...weights.keys()].some(key => key !== OTHER_SHARE);
  return named ? [...weights].map(([key, weight]) => ({ key, weight })) : null;
}

export interface HoldingClassificationView {
  sector: HoldingSector | null;
  region: HoldingRegion | null;
  country: HoldingCountry | null;
  lookThrough: HoldingLookThrough | null;
}

/** The holding's classification in the contract's words; anything unknown reads as unset. */
export function readClassification(holding: InvestmentHolding): HoldingClassificationView {
  const stored = takesLookThrough(holding.assetClass) ? holding.lookThrough : null;
  const sector = readWeights('sector', stored);
  const region = readWeights('region', stored);
  const country = readWeights('country', stored);
  return {
    sector: known<HoldingSector>('sector', holding.sector ?? null),
    region: known<HoldingRegion>('region', holding.region ?? null),
    country: known<HoldingCountry>('country', holding.country ?? null),
    lookThrough:
      sector || region || country ? ({ sector, region, country } as HoldingLookThrough) : null,
  };
}

/** A breakdown from a request, as stored: null when it names no dimension at all. */
export function toStoredLookThrough(
  input: LookThroughInput | null,
): HoldingLookThroughRecord | null {
  if (!input) return null;
  const stored: HoldingLookThroughRecord = {};
  for (const dimension of LOOK_THROUGH_DIMENSIONS) {
    const rows = input[dimension];
    stored[dimension] = rows ? rows.map(row => ({ key: row.key, weight: row.weight })) : null;
  }
  return LOOK_THROUGH_DIMENSIONS.some(dimension => stored[dimension]) ? stored : null;
}

import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';
import {
  ALLOCATION_CLASSES,
  ALLOCATION_SUBCLASSES,
  HOLDING_REGIONS,
  HOLDING_SECTORS,
  ISO_COUNTRIES,
  OTHER_SHARE,
  UNCLASSIFIED,
} from './allocation-keys';

export const HoldingSector = Schema.Literals(HOLDING_SECTORS);
export type HoldingSector = Wire<typeof HoldingSector>;

export const HoldingRegion = Schema.Literals(HOLDING_REGIONS);
export type HoldingRegion = Wire<typeof HoldingRegion>;

/** ISO 3166-1 alpha-2, upper case. */
export const HoldingCountry = Schema.Literals(ISO_COUNTRIES);
export type HoldingCountry = Wire<typeof HoldingCountry>;

/** What a fund's weights may name: the list's own values, or the unnamed rest. */
export const LookThroughSectorKey = Schema.Literals([...HOLDING_SECTORS, OTHER_SHARE]);
export const LookThroughRegionKey = Schema.Literals([...HOLDING_REGIONS, OTHER_SHARE]);
export const LookThroughCountryKey = Schema.Literals([...ISO_COUNTRIES, OTHER_SHARE]);

const weightsOf = <K extends Schema.Top>(key: K) =>
  Schema.NullOr(Schema.Array(Schema.Struct({ key, weight: Schema.Number })));

/**
 * A fund's breakdown as stored: per dimension, weights in percent that add up
 * to 100. A dimension without one is null, and the holding's own value (or
 * nothing) stands for the whole fund there.
 */
export const HoldingLookThrough = Schema.Struct({
  sector: weightsOf(LookThroughSectorKey),
  region: weightsOf(LookThroughRegionKey),
  country: weightsOf(LookThroughCountryKey),
});
export type HoldingLookThrough = Wire<typeof HoldingLookThrough>;

export const AllocationClass = Schema.Literals(ALLOCATION_CLASSES);
export type AllocationClass = Wire<typeof AllocationClass>;

export const AllocationSubclass = Schema.Literals(ALLOCATION_SUBCLASSES);
export type AllocationSubclass = Wire<typeof AllocationSubclass>;

const sliceOf = <K extends Schema.Top>(key: K) =>
  Schema.Struct({
    key,
    /** In the workspace currency, to the cent. */
    amount: Schema.Number,
    /** Share of the whole portfolio, two decimals. */
    percent: Schema.Number,
  });

const SubclassSlice = sliceOf(AllocationSubclass);

export const AllocationClassSlice = Schema.Struct({
  key: AllocationClass,
  amount: Schema.Number,
  percent: Schema.Number,
  subclasses: Schema.Array(SubclassSlice),
});
export type AllocationClassSlice = Wire<typeof AllocationClassSlice>;

export const AllocationSectorSlice = sliceOf(
  Schema.Literals([...HOLDING_SECTORS, OTHER_SHARE, UNCLASSIFIED]),
);
export type AllocationSectorSlice = Wire<typeof AllocationSectorSlice>;

export const AllocationRegionSlice = sliceOf(
  Schema.Literals([...HOLDING_REGIONS, OTHER_SHARE, UNCLASSIFIED]),
);
export type AllocationRegionSlice = Wire<typeof AllocationRegionSlice>;

export const AllocationCountrySlice = sliceOf(
  Schema.Literals([...ISO_COUNTRIES, OTHER_SHARE, UNCLASSIFIED]),
);
export type AllocationCountrySlice = Wire<typeof AllocationCountrySlice>;

/**
 * `GET /investments/allocation`: every holding (investment, retirement and
 * metal accounts) in the workspace currency, cut four ways. A fund with a
 * breakdown is spread by it; the cuts each add up to `total` to the cent.
 */
export const InvestmentAllocation = Schema.Struct({
  currency: Schema.String,
  total: Schema.Number,
  /** Holdings left out: no exchange rate to the workspace currency is known. */
  unvalued: Schema.Number,
  classes: Schema.Array(AllocationClassSlice),
  sectors: Schema.Array(AllocationSectorSlice),
  regions: Schema.Array(AllocationRegionSlice),
  countries: Schema.Array(AllocationCountrySlice),
});
export type InvestmentAllocation = Wire<typeof InvestmentAllocation>;

/** `GET /investments/holdings/:id/sector-suggestion`: what the quote source says, if anything. */
export const HoldingSectorSuggestion = Schema.Struct({
  sector: Schema.NullOr(HoldingSector),
});
export type HoldingSectorSuggestion = Wire<typeof HoldingSectorSuggestion>;

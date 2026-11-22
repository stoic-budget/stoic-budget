import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';

/**
 * How the daily closes of a symbol are doing, as one workspace sees them:
 * `pending` before the first fetch, `stale` once the feed failed several days
 * in a row and nothing newer was entered here, `ok` otherwise.
 */
export const PriceHealthStatus = Schema.Literals(['ok', 'stale', 'pending']);
export type PriceHealthStatus = Wire<typeof PriceHealthStatus>;

export const PriceHealth = Schema.Struct({
  status: PriceHealthStatus,
  /** The newest close this workspace has for the symbol: the feed's or its own. */
  lastCloseOn: Schema.NullOr(DateOnly),
  /** Fetches in a row that brought no close. */
  failures: Schema.Number,
});
export type PriceHealth = Wire<typeof PriceHealth>;

/** Where a close came from: the daily feed, typed in, or imported from a file. */
export const SecurityCloseSource = Schema.Literals(['auto', 'manual', 'import']);
export type SecurityCloseSource = Wire<typeof SecurityCloseSource>;

/**
 * A close the workspace entered or imported for one of its symbols; it wins
 * over the feed's close of that day in this workspace only. Also the answer
 * of `POST /investments/holdings/:id/closes`.
 */
export const SecurityClose = Schema.Struct({
  id: Schema.String,
  symbol: Schema.String,
  date: DateOnly,
  close: Schema.Number,
  currency: Schema.String,
  source: Schema.Literals(['manual', 'import']),
});
export type SecurityClose = Wire<typeof SecurityClose>;

export const SecurityCloseList = Schema.Array(SecurityClose);
export type SecurityCloseList = Wire<typeof SecurityCloseList>;

/** Why a line of an imported file was left out. */
export const ImportCloseSkipReason = Schema.Literals([
  'unreadable_date',
  'unreadable_close',
  'future_date',
  'duplicate_date',
]);
export type ImportCloseSkipReason = Wire<typeof ImportCloseSkipReason>;

/** `POST /investments/holdings/:id/closes/import`. */
export const ImportClosesResult = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  skipped: Schema.Array(Schema.Struct({ line: Schema.Number, reason: ImportCloseSkipReason })),
});
export type ImportClosesResult = Wire<typeof ImportClosesResult>;

/**
 * One day of a holding's history, in the history's currency. `value` is null
 * before the first close; `costBasis` and `unrealizedGain` are null for a
 * holding without trades, whose past quantity and cost nobody recorded.
 */
export const HoldingHistoryPoint = Schema.Struct({
  date: DateOnly,
  close: Schema.NullOr(Schema.Number),
  quantity: Schema.NullOr(Schema.Number),
  value: Schema.NullOr(Schema.Number),
  costBasis: Schema.NullOr(Schema.Number),
  unrealizedGain: Schema.NullOr(Schema.Number),
});
export type HoldingHistoryPoint = Wire<typeof HoldingHistoryPoint>;

/** `GET /investments/holdings/:id/history`. */
export const HoldingPriceHistory = Schema.Struct({
  holdingId: Schema.String,
  symbol: Schema.NullOr(Schema.String),
  /** The trades' currency, or the price's for a holding without trades. */
  currency: Schema.String,
  /** `trades`: quantity and cost replayed day by day; `none`: only the closes are known. */
  basis: Schema.Literals(['trades', 'none']),
  health: Schema.NullOr(PriceHealth),
  firstCloseOn: Schema.NullOr(DateOnly),
  points: Schema.Array(HoldingHistoryPoint),
});
export type HoldingPriceHistory = Wire<typeof HoldingPriceHistory>;

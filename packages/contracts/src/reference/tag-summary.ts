import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';
import { StorageTag } from '../storage/storage';

const Amount = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  amount: Schema.Number,
  count: Schema.Number,
});

/**
 * `GET /tags/:id/summary`: the tag page, over all time. Counted as Reports'
 * By tag counts (confirmed rows, no transfers, another member's private rows
 * left out, each currency at its current rate); a row with two tags counts
 * fully on both pages.
 */
export const TagSummary = Schema.Struct({
  tag: StorageTag,
  currency: Schema.String,
  spent: Schema.Number,
  received: Schema.Number,
  /** Received less spent. */
  net: Schema.Number,
  /** The first and the last day a counted row carries the tag; null when none does. */
  firstDate: Schema.NullOr(DateOnly),
  lastDate: Schema.NullOr(DateOnly),
  /** What the months, categories and payees add up: the larger of the two sides. */
  direction: Schema.Literals(['expense', 'income']),
  /** The `direction` side by month, from its first month to its last, oldest first, at most the last 24. */
  months: Schema.Array(Schema.Struct({ month: Schema.String, amount: Schema.Number })),
  /** By the row's own category, largest first; a null id for rows without one. */
  categories: Schema.Array(
    Schema.Struct({
      id: Schema.NullOr(Schema.String),
      name: Schema.NullOr(Schema.String),
      amount: Schema.Number,
    }),
  ),
  /** The largest payees, largest first. */
  topPayees: Schema.Array(Amount),
  /** Currencies left out of every figure because no rate was found for them. */
  missingRates: Schema.Array(Schema.String),
});
export type TagSummary = Wire<typeof TagSummary>;

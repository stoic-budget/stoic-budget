import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/**
 * `GET /categories/:id/summary`: the category page. Counted like the reports
 * count a category (confirmed rows, no transfers, each amount converted at its
 * own day's rate), subcategories included. With `netRefunds`, money back into a
 * spending category lowers it, as the Reports switch of that name does.
 */
export const CategorySummary = Schema.Struct({
  currency: Schema.String,
  /** What the figures add up: income for an income category, spending for any other. */
  direction: Schema.Literals(['expense', 'income']),
  /** The last twelve months, oldest first, this one last. */
  months: Schema.Array(Schema.Struct({ month: Schema.String, amount: Schema.Number })),
  thisMonth: Schema.Number,
  /** Over the full months before this one that had any; null when none did. */
  averagePerMonth: Schema.NullOr(Schema.Number),
  lastYearTotal: Schema.Number,
  /**
   * The twelve months by direct subcategory (a deeper one counts in its branch),
   * plus the rows filed on the category itself under its own id; empty when it has
   * no subcategories. Only what moved, largest first.
   */
  subcategories: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String, amount: Schema.Number }),
  ),
  /** The largest payees of the twelve months, from rows the viewer may read. */
  topPayees: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      amount: Schema.Number,
      count: Schema.Number,
    }),
  ),
  /**
   * Rows of the other direction filed here, which the figures leave out (spending
   * in an income category, income in a spending one unless refunds are netted).
   */
  otherDirection: Schema.NullOr(Schema.Struct({ amount: Schema.Number })),
  /** Currencies left out of every figure because no rate was found for their day. */
  missingRates: Schema.Array(Schema.String),
});
export type CategorySummary = Wire<typeof CategorySummary>;

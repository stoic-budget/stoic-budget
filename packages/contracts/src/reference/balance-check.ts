import * as Schema from 'effect/Schema';
import { DateOnly, type Wire } from '../common/wire';

/**
 * Rows up to the day in a currency with no rate on their day: left out of our
 * balance until the rate is there, and booking the difference is refused.
 */
const Unconverted = Schema.Struct({
  kind: Schema.Literal('unconverted'),
  currencies: Schema.Array(Schema.String),
});

/** Rows of the account up to the day still waiting in Review: not in our balance yet. */
const InReview = Schema.Struct({
  kind: Schema.Literal('in_review'),
  count: Schema.Number,
  /** Their net effect on the balance once confirmed. */
  amount: Schema.Number,
});

/** Rows of the account up to the day set aside as possible duplicates. */
const Duplicates = Schema.Struct({
  kind: Schema.Literal('duplicates'),
  count: Schema.Number,
  /** What they would add if they were not duplicates after all. */
  amount: Schema.Number,
});

/** Rows dated just after the day whose sum is exactly the difference: the bank booked them earlier. */
const BookedLater = Schema.Struct({
  kind: Schema.Literal('booked_later'),
  amount: Schema.Number,
  rows: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      date: DateOnly,
      /** The merchant; a placeholder for another member's private row. */
      payee: Schema.String,
      amount: Schema.Number,
    }),
  ),
});

/** Days no statement of the account covers, up to the day checked: a statement may be missing. */
const StatementGap = Schema.Struct({
  kind: Schema.Literal('statement_gap'),
  from: DateOnly,
  to: DateOnly,
});

export const BalanceCheckReason = Schema.Union([
  Unconverted,
  InReview,
  Duplicates,
  BookedLater,
  StatementGap,
]);
export type BalanceCheckReason = Wire<typeof BalanceCheckReason>;

/**
 * `POST /wallets/:id/balance-check`: our balance at the end of the day against
 * the bank's, and where the difference probably is. Amounts are in the
 * account's currency; a debt is below zero, as in `WalletItem.balance`.
 */
export const BalanceCheckResult = Schema.Struct({
  date: DateOnly,
  bankBalance: Schema.Number,
  ourBalance: Schema.Number,
  /** Bank minus ours: what a balance adjustment would book. */
  difference: Schema.Number,
  matches: Schema.Boolean,
  reasons: Schema.Array(BalanceCheckReason),
});
export type BalanceCheckResult = Wire<typeof BalanceCheckResult>;

/**
 * `POST /wallets/:id/balance-adjustment`: the check after booking, and the row
 * booked; null when there was no difference left to book (a second click).
 */
export const BalanceAdjustmentResult = Schema.Struct({
  check: BalanceCheckResult,
  transactionId: Schema.NullOr(Schema.String),
});
export type BalanceAdjustmentResult = Wire<typeof BalanceAdjustmentResult>;

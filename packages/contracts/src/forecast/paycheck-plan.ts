import * as Schema from 'effect/Schema';
import { NumericInput, StringListInput } from '../common/requests';
import { DateOnly, type Wire } from '../common/wire';

/** `GET /forecast/paychecks`. */
export const PaycheckPlanQuery = Schema.Struct({
  /** Income streams whose paydays start the periods; the biggest regular one when absent. */
  streams: Schema.optional(StringListInput),
  /** Spending accounts the starting cash is read from; every spending account when absent. */
  walletIds: Schema.optional(StringListInput),
  /** Money kept aside in every period, not counted as safe to spend. */
  buffer: Schema.optional(
    NumericInput.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1e12)),
  ),
});
export type PaycheckPlanQuery = Wire<typeof PaycheckPlanQuery>;

export const PaycheckCadence = Schema.Literals([
  'weekly',
  'fortnightly',
  'semimonthly',
  'monthly',
  'other',
]);
export type PaycheckCadence = Wire<typeof PaycheckCadence>;

/** A payer whose paydays can start the periods. */
export const PaycheckStream = Schema.Struct({
  /** `detected:<payer>` from history, `declared:<payer>` from open receivables. */
  id: Schema.String,
  label: Schema.String,
  kind: Schema.Literals(['detected', 'declared']),
  /** What one payday brings, workspace currency. */
  amount: Schema.Number,
  cadence: PaycheckCadence,
  nextDate: Schema.NullOr(DateOnly),
  /** Whether its paydays start the periods in this answer. */
  selected: Schema.Boolean,
});
export type PaycheckStream = Wire<typeof PaycheckStream>;

export const PaycheckItemKind = Schema.Literals([
  'income',
  'payable',
  'subscription',
  'goal',
  'tax',
]);
export type PaycheckItemKind = Wire<typeof PaycheckItemKind>;

/** Money due or arriving inside a period. */
export const PaycheckItem = Schema.Struct({
  date: DateOnly,
  label: Schema.String,
  /** Positive = money in, negative = money out. Workspace currency. */
  amount: Schema.Number,
  kind: PaycheckItemKind,
  sourceId: Schema.String,
  /** A bill past its due date (counted today), or a payday that is late (expected today). */
  isOverdue: Schema.Boolean,
  /** For income: the stream it belongs to; null for a one-off receivable. */
  streamId: Schema.NullOr(Schema.String),
});
export type PaycheckItem = Wire<typeof PaycheckItem>;

export const PaycheckPeriod = Schema.Struct({
  start: DateOnly,
  /** Last day, inclusive: the day before the next payday. */
  end: DateOnly,
  /** The payday that ends the period, or null when the period is a month. */
  nextPayday: Schema.NullOr(DateOnly),
  /** Days from today (or the start) to the end, both counted. */
  daysLeft: Schema.Number,
  startingCash: Schema.Number,
  /** False for the current period (today's balance), true for the later ones. */
  startingCashProjected: Schema.Boolean,
  income: Schema.Number,
  commitments: Schema.Number,
  /** Cash + income − commitments − buffer, at the period's lowest point; negative = short. */
  safeToSpend: Schema.Number,
  safeToSpendPerDay: Schema.Number,
  items: Schema.Array(PaycheckItem),
});
export type PaycheckPeriod = Wire<typeof PaycheckPeriod>;

/** A spending account the starting cash can be read from. */
export const PaycheckAccount = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  currency: Schema.String,
  /** Today's counted balance in the account's own currency. */
  balance: Schema.Number,
  selected: Schema.Boolean,
});
export type PaycheckAccount = Wire<typeof PaycheckAccount>;

/** The rate a foreign amount was converted at; null when none is known (counted 1:1). */
export const PaycheckRate = Schema.Struct({
  currency: Schema.String,
  rate: Schema.NullOr(Schema.Number),
  rateDate: Schema.NullOr(DateOnly),
});
export type PaycheckRate = Wire<typeof PaycheckRate>;

/** `GET /forecast/paychecks`: payday to payday, what is due and what is safe to spend. */
export const PaycheckPlanResponse = Schema.Struct({
  currency: Schema.String,
  today: DateOnly,
  /** `paydays` when a chosen stream starts the periods, else the workspace month. */
  basis: Schema.Literals(['paydays', 'month']),
  /** `irregular`: income came in, but no payer pays regularly. */
  incomeStatus: Schema.Literals(['regular', 'irregular', 'none']),
  buffer: Schema.Number,
  streams: Schema.Array(PaycheckStream),
  accounts: Schema.Array(PaycheckAccount),
  rates: Schema.Array(PaycheckRate),
  periods: Schema.Array(PaycheckPeriod),
});
export type PaycheckPlanResponse = Wire<typeof PaycheckPlanResponse>;

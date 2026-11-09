import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';

export const LoanMethod = Schema.Literals(['annuity', 'linear', 'interest_only']);
export type LoanMethod = Wire<typeof LoanMethod>;

export const LoanDayCount = Schema.Literals(['30/360', 'actual/365']);
export type LoanDayCount = Wire<typeof LoanDayCount>;

/** What an extra payment buys: a shorter term at the same payment, or a lower payment over the same term. */
export const LoanExtraMode = Schema.Literals(['reduce_term', 'reduce_payment']);
export type LoanExtraMode = Wire<typeof LoanExtraMode>;

/** A new annual rate (percent) from a day on: the schedule is worked out again from there. */
export const LoanRateChange = Schema.Struct({ from: DateOnly, annualRate: Schema.Number });
export type LoanRateChange = Wire<typeof LoanRateChange>;

export const LoanExtraPayment = Schema.Struct({ date: DateOnly, amount: Schema.Number });
export type LoanExtraPayment = Wire<typeof LoanExtraPayment>;

/** The same extra amount with every payment from `from` on. */
export const LoanRecurringExtra = Schema.Struct({ amount: Schema.Number, from: DateOnly });
export type LoanRecurringExtra = Wire<typeof LoanRecurringExtra>;

/** The terms of a debt account, in its currency. */
export const LoanTermsItem = Schema.Struct({
  id: Schema.String,
  walletId: Schema.String,
  /** The account's currency: the terms are always in it. */
  currency: Schema.String,
  principal: DecimalString,
  startDate: DateOnly,
  termMonths: Schema.Number,
  paymentDay: Schema.Number,
  method: LoanMethod,
  dayCount: LoanDayCount,
  /** Percent a year. */
  annualRate: DecimalString,
  rateChanges: Schema.Array(LoanRateChange),
  extraPayments: Schema.Array(LoanExtraPayment),
  recurringExtra: Schema.NullOr(LoanRecurringExtra),
  extraMode: LoanExtraMode,
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type LoanTermsItem = Wire<typeof LoanTermsItem>;

/** `GET`/`PUT /wallets/:id/loan-terms`: the terms, or null while the account has none. */
export const LoanTermsState = Schema.Struct({ terms: Schema.NullOr(LoanTermsItem) });
export type LoanTermsState = Wire<typeof LoanTermsState>;

/** One payment of a schedule. `balance` is what is still owed after it. */
const loanRowFields = {
  period: Schema.Number,
  date: DateOnly,
  annualRate: Schema.Number,
  payment: Schema.Number,
  interest: Schema.Number,
  principal: Schema.Number,
  extra: Schema.Number,
  balance: Schema.Number,
};

export const LoanProjectionRow = Schema.Struct(loanRowFields);
export type LoanProjectionRow = Wire<typeof LoanProjectionRow>;

export const LoanScheduleRow = Schema.Struct({
  ...loanRowFields,
  /** What the account really owed on that day, from its counted rows; null for days still ahead. */
  actualBalance: Schema.NullOr(Schema.Number),
});
export type LoanScheduleRow = Wire<typeof LoanScheduleRow>;

const loanSummaryFields = {
  periods: Schema.Number,
  payoffDate: Schema.NullOr(DateOnly),
  totalInterest: Schema.Number,
  totalPaid: Schema.Number,
  /** A whole month's payment at the start. */
  regularPayment: Schema.Number,
};

export const LoanScheduleSummary = Schema.Struct(loanSummaryFields);
export type LoanScheduleSummary = Wire<typeof LoanScheduleSummary>;

/**
 * `GET /wallets/:id/loan-schedule`: the planned schedule with the real balance
 * beside each past payment, where the account stands today against the plan,
 * and what is left to pay from that real balance.
 */
export const LoanSchedule = Schema.Struct({
  currency: Schema.String,
  startDate: DateOnly,
  principal: Schema.Number,
  today: DateOnly,
  plan: Schema.Struct({ ...loanSummaryFields, rows: Schema.Array(LoanScheduleRow) }),
  /** Null when the account has no opening balance and no counted rows to compare. */
  actual: Schema.NullOr(
    Schema.Struct({
      balance: Schema.Number,
      plannedBalance: Schema.Number,
      /** Real minus planned: above zero is behind the plan, below zero ahead of it. */
      difference: Schema.Number,
    }),
  ),
  projection: Schema.NullOr(
    Schema.Struct({
      ...loanSummaryFields,
      from: DateOnly,
      startBalance: Schema.Number,
      rows: Schema.Array(LoanProjectionRow),
    }),
  ),
});
export type LoanSchedule = Wire<typeof LoanSchedule>;

/** `POST /wallets/:id/loan-schedule/what-if`: the plan against the plan plus extra payments. */
export const LoanWhatIf = Schema.Struct({
  baseline: LoanScheduleSummary,
  scenario: LoanScheduleSummary,
  monthsSaved: Schema.Number,
  interestSaved: Schema.Number,
  /** The payment after the first extra one, as planned and as it would be. */
  paymentBefore: Schema.NullOr(Schema.Number),
  paymentAfter: Schema.NullOr(Schema.Number),
});
export type LoanWhatIf = Wire<typeof LoanWhatIf>;

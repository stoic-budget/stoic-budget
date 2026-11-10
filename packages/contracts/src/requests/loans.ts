import * as Schema from 'effect/Schema';
import { DateOnlyInput, isAtMostTwoDecimals, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';
import { LoanDayCount, LoanExtraMode, LoanMethod } from '../wealth/loans';

/**
 * Money owed or paid: at least a cent (a smaller positive amount would round
 * to zero in the column), under 10^13 so it fits `decimal(15,2)`.
 */
const LoanAmount = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0.01),
  Schema.isLessThan(1e13),
  isAtMostTwoDecimals,
);

/** Percent a year, 0–100. */
const AnnualRate = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100),
);

const ExtraPayments = Schema.Array(
  Schema.Struct({ date: DateOnlyInput, amount: LoanAmount }),
).check(Schema.isMaxLength(600));

const RecurringExtra = Schema.Struct({ amount: LoanAmount, from: DateOnlyInput });

/**
 * `PUT /wallets/:id/loan-terms`: the whole set of terms, replacing what was
 * there. Only a loan or credit card account takes them.
 */
export const LoanTermsBody = Schema.Struct({
  principal: LoanAmount,
  startDate: DateOnlyInput,
  termMonths: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(600),
  ),
  paymentDay: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(31),
  ),
  method: LoanMethod,
  dayCount: LoanDayCount,
  annualRate: AnnualRate,
  rateChanges: Schema.optional(
    Schema.Array(Schema.Struct({ from: DateOnlyInput, annualRate: AnnualRate })).check(
      Schema.isMaxLength(120),
    ),
  ),
  extraPayments: Schema.optional(ExtraPayments),
  recurringExtra: optionalNullable(RecurringExtra),
  extraMode: optionalNullable(LoanExtraMode),
  /** Split new payments into the account on import; off when left out. */
  autoSplit: Schema.optional(Schema.Boolean),
});
export type LoanTermsBody = Wire<typeof LoanTermsBody>;

/** `POST /wallets/:id/loan-schedule/what-if`: extra payments to try on top of the plan. Nothing is saved. */
export const LoanWhatIfBody = Schema.Struct({
  extraPayments: Schema.optional(ExtraPayments),
  recurringExtra: optionalNullable(RecurringExtra),
  mode: LoanExtraMode,
});
export type LoanWhatIfBody = Wire<typeof LoanWhatIfBody>;

/** `/wallets/:id/loan-payments/:transactionId/split`: the loan account and one payment into it. */
export const LoanPaymentParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  transactionId: Schema.String.check(Schema.isUUID()),
});
export type LoanPaymentParams = Wire<typeof LoanPaymentParams>;

/**
 * `POST /wallets/:id/loan-payments/:transactionId/split`: the interest part of
 * the payment, at most the payment itself; the rest is principal.
 */
export const LoanPaymentSplitBody = Schema.Struct({ interest: LoanAmount });
export type LoanPaymentSplitBody = Wire<typeof LoanPaymentSplitBody>;

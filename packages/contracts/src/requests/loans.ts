import * as Schema from 'effect/Schema';
import { DateOnlyInput, isAtMostTwoDecimals, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';
import { LoanDayCount, LoanExtraMode, LoanMethod } from '../wealth/loans';

/**
 * The most a loan, or one extra payment on it, can be. The schedule works in
 * cents on JavaScript numbers, exact up to 2^53 (about 9·10^15 cents): the
 * most it adds up is the interest of 600 months at 100% a year, some 51 times
 * the principal, so a principal under 10^12 keeps every total under 5.1·10^15
 * cents. That still fits a large mortgage in a currency of small units (rial,
 * dong, rupiah), and `decimal(15,2)` holds it.
 */
export const LOAN_AMOUNT_LIMIT = 1e12;

/** Money owed or paid: at least a cent (a smaller positive amount would round to zero in the column). */
const LoanAmount = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0.01),
  Schema.isLessThan(LOAN_AMOUNT_LIMIT),
  isAtMostTwoDecimals,
);

/** No finer than the `numeric(7,4)` column, so a rate change (kept as JSON) is stored as the rate is. */
const isAtMostFourDecimals = Schema.makeFilter<number>(value =>
  Math.abs(Math.round(value * 10_000) - value * 10_000) < 1e-6
    ? undefined
    : 'Expected at most 4 decimal places',
);

/** Percent a year, 0–100, to four decimals. */
const AnnualRate = Schema.Finite.check(
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(100),
  isAtMostFourDecimals,
);

const ExtraPayments = Schema.Array(
  Schema.Struct({ date: DateOnlyInput, amount: LoanAmount }),
).check(Schema.isMaxLength(600));

const RecurringExtra = Schema.Struct({ amount: LoanAmount, from: DateOnlyInput });

/**
 * `PUT /wallets/:id/loan-terms`: the whole set of terms, replacing what was
 * there. Only a loan or credit card account takes them, and the last payment
 * date must fall by 31 December 9999 (`LOAN_TERMS_END_TOO_LATE` otherwise).
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

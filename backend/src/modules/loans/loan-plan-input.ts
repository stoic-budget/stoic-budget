import type { LoanTerms } from '../../entities/loan-terms.entity';
import type { LoanPlanInput } from './engine/loan-plan';

const toDay = (value: string | Date): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

/** Stored terms as the schedule engine takes them. */
export function planInputOf(terms: LoanTerms): LoanPlanInput {
  return {
    principal: Number(terms.principal),
    startDate: toDay(terms.startDate),
    termMonths: terms.termMonths,
    paymentDay: terms.paymentDay,
    method: terms.method,
    dayCount: terms.dayCount,
    annualRate: Number(terms.annualRate),
    rateChanges: terms.rateChanges,
    extraPayments: terms.extraPayments,
    recurringExtras: terms.recurringExtra ? [terms.recurringExtra] : [],
    extraMode: terms.extraMode,
  };
}

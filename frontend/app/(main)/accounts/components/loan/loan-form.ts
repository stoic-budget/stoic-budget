import type {
  LoanDayCount,
  LoanExtraMode,
  LoanMethod,
  LoanTermsBody,
  LoanTermsItem,
} from '@/app/lib/contracts';

/** The terms as the person types them: every field a string until it is sent. */
export interface LoanForm {
  principal: string;
  startDate: string;
  termMonths: string;
  paymentDay: string;
  annualRate: string;
  method: LoanMethod;
  dayCount: LoanDayCount;
  rateChanges: Array<{ from: string; annualRate: string }>;
  extraPayments: Array<{ date: string; amount: string }>;
  monthlyExtra: string;
  monthlyExtraFrom: string;
  extraMode: LoanExtraMode;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A typed number, with a comma accepted as the decimal mark; null when it is not one. */
export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '') {
    return null;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

const money = (value: string) => {
  const number = parseNumber(value);
  return number !== null &&
    number >= 0.01 &&
    Math.abs(Math.round(number * 100) - number * 100) < 1e-6
    ? number
    : null;
};

const rate = (value: string) => {
  const number = parseNumber(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
};

const whole = (value: string, min: number, max: number) => {
  const number = parseNumber(value);
  return number !== null && Number.isInteger(number) && number >= min && number <= max
    ? number
    : null;
};

/** A new loan starts from what the account owes, today, on today's day of the month. */
export function emptyLoanForm(owed: number, today: string): LoanForm {
  return {
    principal: owed > 0 ? String(owed) : '',
    startDate: today,
    termMonths: '',
    paymentDay: String(Number(today.slice(8, 10))),
    annualRate: '',
    method: 'annuity',
    dayCount: '30/360',
    rateChanges: [],
    extraPayments: [],
    monthlyExtra: '',
    monthlyExtraFrom: '',
    extraMode: 'reduce_term',
  };
}

export function termsToForm(terms: LoanTermsItem): LoanForm {
  return {
    principal: String(Number(terms.principal)),
    startDate: terms.startDate,
    termMonths: String(terms.termMonths),
    paymentDay: String(terms.paymentDay),
    annualRate: String(Number(terms.annualRate)),
    method: terms.method,
    dayCount: terms.dayCount,
    rateChanges: terms.rateChanges.map(change => ({
      from: change.from,
      annualRate: String(change.annualRate),
    })),
    extraPayments: terms.extraPayments.map(extra => ({
      date: extra.date,
      amount: String(extra.amount),
    })),
    monthlyExtra: terms.recurringExtra ? String(terms.recurringExtra.amount) : '',
    monthlyExtraFrom: terms.recurringExtra?.from ?? '',
    extraMode: terms.extraMode,
  };
}

/**
 * The body for `PUT /wallets/:id/loan-terms`, or null when a field shown in
 * the form is not filled in right. A half-filled row is never dropped quietly:
 * the form sends exactly what it shows, or nothing.
 */
export function formToBody(form: LoanForm): LoanTermsBody | null {
  const principal = money(form.principal);
  const termMonths = whole(form.termMonths, 1, 600);
  const paymentDay = whole(form.paymentDay, 1, 31);
  const annualRate = rate(form.annualRate);
  if (
    principal === null ||
    termMonths === null ||
    paymentDay === null ||
    annualRate === null ||
    !DATE.test(form.startDate)
  ) {
    return null;
  }
  const rateChanges = form.rateChanges.map(change => ({
    from: DATE.test(change.from) ? change.from : null,
    annualRate: rate(change.annualRate),
  }));
  const extraPayments = form.extraPayments.map(extra => ({
    date: DATE.test(extra.date) ? extra.date : null,
    amount: money(extra.amount),
  }));
  const monthly = form.monthlyExtra.trim() === '' ? null : money(form.monthlyExtra);
  if (
    rateChanges.some(change => change.from === null || change.annualRate === null) ||
    extraPayments.some(extra => extra.date === null || extra.amount === null) ||
    (form.monthlyExtra.trim() !== '' && (monthly === null || !DATE.test(form.monthlyExtraFrom)))
  ) {
    return null;
  }
  return {
    principal,
    startDate: form.startDate,
    termMonths,
    paymentDay,
    method: form.method,
    dayCount: form.dayCount,
    annualRate,
    rateChanges: rateChanges.map(change => ({
      from: change.from as string,
      annualRate: change.annualRate as number,
    })),
    extraPayments: extraPayments.map(extra => ({
      date: extra.date as string,
      amount: extra.amount as number,
    })),
    recurringExtra: monthly === null ? null : { amount: monthly, from: form.monthlyExtraFrom },
    extraMode: form.extraMode,
  };
}

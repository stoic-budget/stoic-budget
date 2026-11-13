import { resolveLocaleTag } from '@/app/lib/user-format';

/** What a budget leaves for each of the days left in its period. */
export interface LeftPerDay {
  /** Rounded down to the currency's smallest unit, so `amount × days` never exceeds what is left. */
  amount: number;
  /** Days left in the period, today included. */
  days: number;
  /** Decimal places of the currency's smallest unit (2 for EUR, 0 for JPY, 3 for KWD). */
  fractionDigits: number;
}

/** `YYYY-MM-DD` of `now` on the clock of `timeZone`; the reader's own clock when none is given. */
export function dayKeyIn(now: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find(entry => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function minorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    // A code Intl does not know: cents, as most currencies have.
    return 2;
  }
}

const dayNumber = (day: string): number => {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date) / 86_400_000;
};

/**
 * Spread what is left over the days left in the period, today included. Null
 * when there is nothing to spread (overspent, exactly used up, less than the
 * smallest coin a day) or when `today` lies outside the period: a past or
 * future period has no "days left", and the card says nothing then.
 */
export function leftPerDay({
  remaining,
  currency,
  periodStart,
  periodEnd,
  today,
}: {
  remaining: number;
  currency: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  today: string;
}): LeftPerDay | null {
  if (!periodStart || !periodEnd || today < periodStart || today > periodEnd) {
    return null;
  }
  const fractionDigits = minorUnitDigits(currency);
  const scale = 10 ** fractionDigits;
  // Whole minor units first: 250.5 - 30.27 is 220.23000000000002 in floating point.
  const minorLeft = Math.round(remaining * scale);
  const days = dayNumber(periodEnd) - dayNumber(today) + 1;
  const minorPerDay = Math.floor(minorLeft / days);
  if (minorPerDay <= 0) {
    return null;
  }
  return { amount: minorPerDay / scale, days, fractionDigits };
}

/**
 * Which plural form a count takes. `two` is the dual of Slovenian and Upper
 * Sorbian ("2 dneva", "2 dnjej"); every other language's text for it is its few form.
 */
export function pluralForm(locale: string, count: number): 'one' | 'two' | 'few' | 'many' {
  const category = new Intl.PluralRules(resolveLocaleTag(locale)).select(count);
  if (category === 'one' || category === 'two' || category === 'few') {
    return category;
  }
  return 'many';
}

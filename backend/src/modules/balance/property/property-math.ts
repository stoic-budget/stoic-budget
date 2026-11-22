const DAY_MS = 86_400_000;

const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

/**
 * What a thing valued at `base` on `valuedOn` is estimated to be worth on
 * `date`, losing `ratePercent` of its value a year (declining balance, a year
 * of 365 days). Never earlier than the valuation: a day before it, or the day
 * itself, is the valuation as entered.
 */
export function depreciatedValue(
  base: number,
  ratePercent: number,
  valuedOn: string,
  date: string,
): number {
  const days = dayNumber(date) - dayNumber(valuedOn);
  if (days <= 0 || ratePercent <= 0) return base;
  const kept = Math.max(0, 1 - ratePercent / 100);
  return base * kept ** (days / 365);
}

/**
 * What of a property is the owner's: its value less what is still owed on
 * it, and the loan-to-value ratio (a fraction). Without a linked debt the
 * whole value is equity and there is no ratio; without a value there is
 * nothing to divide by. A debt can exceed the value (negative equity, a ratio
 * above 1); an overpaid loan owes nothing rather than a negative amount.
 */
export function propertyEquity(
  value: number,
  debt: number | null,
): { equity: number; ltv: number | null } {
  const owed = debt === null ? 0 : Math.max(0, debt);
  return {
    equity: Math.round((value - owed) * 100) / 100,
    ltv: debt === null || value <= 0 ? null : Math.round((owed / value) * 10_000) / 10_000,
  };
}

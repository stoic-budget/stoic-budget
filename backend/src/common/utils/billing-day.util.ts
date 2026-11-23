/**
 * The day of the month a subscription is billed on (#662). Kept apart from the
 * charge calendar so the entity can use it without importing a module.
 */
/** Year, month (0-based) and day of a stored date, a `Date` or its `YYYY-MM-DD` text. */
function partsOf(value: Date | string): { year: number; month: number; day: number } {
  if (typeof value === 'string') {
    return {
      year: Number(value.slice(0, 4)),
      month: Number(value.slice(5, 7)) - 1,
      day: Number(value.slice(8, 10)),
    };
  }
  return { year: value.getFullYear(), month: value.getMonth(), day: value.getDate() };
}

export const lastDayOf = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * The billing day to keep once the next charge date is set (#662). A date on
 * the day the billing day gives in its month (the 28th of February for the
 * 31st) is a step and keeps it; any other date was set by someone and names
 * the new billing day.
 */
export function billingDayAfter(
  next: Date | string | null,
  billingDay: number | null,
): number | null {
  if (!next) {
    return billingDay;
  }
  const { year, month, day } = partsOf(next);
  if (billingDay !== null && day === Math.min(billingDay, lastDayOf(year, month))) {
    return billingDay;
  }
  return day;
}

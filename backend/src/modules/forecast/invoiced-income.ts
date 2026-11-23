import { type ForecastEvent, sameParty } from './forecast.engine';

const DAY_MS = 86_400_000;
const days = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * The recurring payments an open invoice or receivable stands for. A client
 * who pays monthly and was invoiced for November pays once in November: the
 * invoice is that payment, so the nearest expected payday of the same payer
 * (within half its interval) is dropped, one per invoice.
 */
export function withoutInvoicedIncome(
  income: ForecastEvent[],
  expected: ForecastEvent[],
  intervalDaysOf: (sourceId: string) => number,
): ForecastEvent[] {
  const covered = new Set<ForecastEvent>();
  for (const bill of expected) {
    if (bill.amount <= 0) continue;
    const distance = (event: ForecastEvent) => Math.abs(days(bill.date, event.date));
    const [nearest] = income
      .filter(
        event =>
          !covered.has(event) &&
          sameParty(event.label, bill.label) &&
          distance(event) <= intervalDaysOf(event.sourceId) / 2,
      )
      .sort((a, b) => distance(a) - distance(b));
    if (nearest) covered.add(nearest);
  }
  return income.filter(event => !covered.has(event));
}

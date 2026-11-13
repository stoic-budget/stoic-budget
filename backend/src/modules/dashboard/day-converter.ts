import { CurrencyConverter } from '../exchange-rates/currency-converter';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/** A row's day, the date its amount converts at. */
export const DAY_SQL = "TO_CHAR(t.transactionDate, 'YYYY-MM-DD')";

/** Sums read back per currency and day, as Postgres returns them (strings). */
export type DayRow<K extends string> = { currency: string; day: string } & Record<K, string>;

/**
 * A converter for sums grouped by currency and day: each converts at its own
 * day's rate, as Reports do, so a month on the dashboard and in the Reports
 * flow come to the same figures. A currency without a rate is left out, not
 * counted 1:1.
 */
export function loadDayConverter(
  exchangeRates: ExchangeRatesService,
  target: string,
  rows: Array<{ currency: string; day: string }>,
  workspaceId: string,
): Promise<CurrencyConverter> {
  return CurrencyConverter.load(
    exchangeRates,
    target,
    rows.map(row => ({ currency: row.currency, date: row.day })),
    workspaceId,
  );
}

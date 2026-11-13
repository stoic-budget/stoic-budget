import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { CurrencyConverter } from './currency-converter';
import type { ExchangeRatesService } from './exchange-rates.service';

/** A transaction's day under `alias`, the date its amount converts at. */
export const daySql = (alias: string): string => `TO_CHAR(${alias}.transactionDate, 'YYYY-MM-DD')`;
export const DAY_SQL = daySql('t');

/** Sums read back per currency and day, as Postgres returns them (strings). */
export type DayRow<K extends string> = { currency: string; day: string } & Record<K, string>;

/** An amount (a number or Postgres' string) in the target currency at `day`'s rate. */
export type DayConvert = ((
  amount: number | string | null | undefined,
  currency: string | null | undefined,
  day: string,
) => number) & {
  /** Currencies left out for want of a rate, sorted. */
  readonly missing: string[];
};

/**
 * Converts amounts at their own day's rate, as Reports do, so a figure on the
 * dashboard and the same figure in Reports agree. `rows` name every
 * (currency, day) that will be converted, so the rates load up front. A
 * currency without a rate is left out, not counted 1:1.
 */
export async function loadDayConverter(
  exchangeRates: ExchangeRatesService,
  target: string,
  rows: Array<{ currency: string | null | undefined; day: string }>,
  workspaceId: string,
): Promise<DayConvert> {
  const converter = await CurrencyConverter.load(
    exchangeRates,
    target,
    rows.map(row => ({ currency: currencyCodeOrDefault(row.currency), date: row.day })),
    workspaceId,
  );
  const convert = (
    amount: number | string | null | undefined,
    currency: string | null | undefined,
    day: string,
  ) => {
    const value = typeof amount === 'number' ? amount : Number.parseFloat(amount ?? '');
    return Number.isFinite(value)
      ? converter.convert(value, currencyCodeOrDefault(currency), day)
      : 0;
  };
  return Object.defineProperty(convert, 'missing', { get: () => converter.missing }) as DayConvert;
}

import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/**
 * Converts the bills summary into the workspace currency, one lookup per
 * currency and day, and notes each currency with no rate (#787): it still
 * counts at face value, as on the dashboard, and the page names it instead
 * of passing 500 UAH off as 500 EUR without a word.
 */
export function summaryRates(
  rates: Pick<ExchangeRatesService, 'getRateOrNull'>,
  targetCurrency: string,
  workspaceId: string,
) {
  const cache = new Map<string, Promise<number | null>>();
  const unrated = new Set<string>();
  const convert = async (
    amount: number,
    sourceCurrency: string | null | undefined,
    day?: Date,
  ): Promise<number> => {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = currencyCodeOrDefault(sourceCurrency);
    if (source === targetCurrency) return amount;
    const key = `${source}:${day?.toISOString().slice(0, 10) ?? ''}`;
    if (!cache.has(key))
      cache.set(key, rates.getRateOrNull(source, targetCurrency, day, workspaceId));
    const rate = await cache.get(key);
    if (rate !== null && rate !== undefined) return amount * rate;
    unrated.add(source);
    return amount;
  };
  /** The currencies without a rate, or nothing when every one had one. */
  const missingRates = (): { missingRates?: string[] } =>
    unrated.size > 0 ? { missingRates: [...unrated].sort() } : {};
  return { convert, missingRates };
}

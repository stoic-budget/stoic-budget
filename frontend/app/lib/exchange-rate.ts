import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

/**
 * Fetches a currency conversion rate from the server, or null when it has none.
 * There is no public fallback: the page's CSP blocks third-party rate mirrors,
 * and a missing rate is shown as missing, not guessed (#646).
 */
export const fetchExchangeRate = async (from: string, to: string): Promise<number | null> => {
  try {
    const quote = await apiQueryDecoded({
      url: '/exchange-rates',
      params: { from, to },
      contract: 'ExchangeRateQuote',
    });
    return Number.isFinite(quote.rate) ? quote.rate : null;
  } catch {
    return null;
  }
};

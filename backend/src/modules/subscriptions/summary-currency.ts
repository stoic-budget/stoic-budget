import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/**
 * Converts the summary's amounts to the workspace currency at today's rate
 * and notes each currency that had none (#787): those still count at face
 * value, as the dashboard does, and the page names them so the total is not
 * trusted blindly.
 */
export function summaryConverter(
  rates: ExchangeRatesService,
  workspaceCurrency: string | undefined,
  workspaceId: string,
) {
  const missing = new Set<string>();
  const convert = async (amount: number, currency: string): Promise<number> => {
    if (!(amount && workspaceCurrency) || currency.toUpperCase() === workspaceCurrency)
      return amount;
    const rate = await rates.getRateOrNull(currency, workspaceCurrency, new Date(), workspaceId);
    if (rate !== null) return amount * rate;
    missing.add(currency.toUpperCase());
    return amount;
  };
  /** The currencies without a rate, or nothing when every one had one. */
  const missingRates = (): { missingRates?: string[] } =>
    missing.size > 0 ? { missingRates: [...missing].sort() } : {};
  return { convert, missingRates };
}

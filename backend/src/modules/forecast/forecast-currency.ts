import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';

/** A three-letter code in upper case; the old default when there is none. */
export function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = String(currency || '')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'KZT';
}

/**
 * The forecast's amounts in the workspace currency at today's rate. A
 * currency with no rate still counts at face value, as on the dashboard, and
 * is noted for the workspace being forecast (#787) so the page can say so.
 * The notes are per workspace: two forecasts of one workspace at once can
 * only add the same currencies.
 */
export class ForecastRates {
  private readonly unrated = new Map<string, Set<string>>();

  constructor(private readonly rates: Pick<ExchangeRatesService, 'getRateOrNull'>) {}

  begin(workspaceId: string): void {
    this.unrated.set(workspaceId, new Set());
  }

  async convert(
    amount: number,
    from: string | null | undefined,
    to: string,
    workspaceId: string,
  ): Promise<number> {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const source = normalizeCurrency(from);
    if (source === to) return amount;
    const rate = await this.rates.getRateOrNull(source, to, undefined, workspaceId);
    if (rate !== null) return amount * rate;
    this.unrated.get(workspaceId)?.add(source);
    return amount;
  }

  /** The currencies without a rate since `begin`, or nothing; forgets them. */
  finish(workspaceId: string): { missingRates?: string[] } {
    const missing = this.unrated.get(workspaceId);
    this.unrated.delete(workspaceId);
    return missing?.size ? { missingRates: [...missing].sort() } : {};
  }
}

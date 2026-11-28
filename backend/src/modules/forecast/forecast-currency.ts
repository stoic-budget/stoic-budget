import { AsyncLocalStorage } from 'node:async_hooks';
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
 * is noted for the forecast being computed (#787) so the page can say so.
 * The notes follow the call, not the workspace: each forecast, even two of
 * one workspace at once, keeps its own (async context), and nothing is left
 * behind when one fails.
 */
export class ForecastRates {
  private readonly unrated = new AsyncLocalStorage<Set<string>>();

  constructor(private readonly rates: Pick<ExchangeRatesService, 'getRateOrNull'>) {}

  /** Starts this call's notes; what it awaits from here on writes to them. */
  begin(): void {
    this.unrated.enterWith(new Set());
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
    this.unrated.getStore()?.add(source);
    return amount;
  }

  /** The currencies this call found without a rate since `begin`, or nothing. */
  finish(): { missingRates?: string[] } {
    const missing = this.unrated.getStore();
    return missing?.size ? { missingRates: [...missing].sort() } : {};
  }
}

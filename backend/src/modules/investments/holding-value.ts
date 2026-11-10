import type { InvestmentHolding as HoldingView } from '../../contracts';
import type { InvestmentHolding } from '../../entities';
import type { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { readClassification } from './holding-classification';
import { pricedUnits } from './metal-weight.util';

/** What the holding is worth in `to`, or null when no rate is known. */
export async function holdingValueIn(
  holding: InvestmentHolding,
  to: string,
  rates: Pick<ExchangeRatesService, 'getRateOrNull'>,
): Promise<number | null> {
  // A metal lot is priced per fine troy ounce, not per piece.
  const amount = pricedUnits(holding) * Number(holding.price);
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const source = (holding.priceCurrency || to).toUpperCase();
  if (source === to) return amount;
  const rate = await rates.getRateOrNull(source, to, undefined, holding.workspaceId);
  return rate === null ? null : amount * rate;
}

/** A holding as the investments page reads it, valued in `currency`. */
export async function holdingView(
  holding: InvestmentHolding,
  currency: string,
  rates: Pick<ExchangeRatesService, 'getRateOrNull'>,
  hasTrades: boolean,
): Promise<HoldingView> {
  const value = (await holdingValueIn(holding, currency, rates)) ?? 0;
  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    assetClass: holding.assetClass,
    quantity: Number(holding.quantity),
    price: Number(holding.price),
    priceCurrency: holding.priceCurrency,
    priceSource: holding.priceSource,
    pricedAt: holding.pricedAt?.toISOString() ?? null,
    value: Math.round(value * 100) / 100,
    hasTrades,
    ...readClassification(holding),
  };
}

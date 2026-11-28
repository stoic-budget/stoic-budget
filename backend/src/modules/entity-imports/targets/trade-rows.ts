import type { InvestmentHolding } from '../../../entities/investment-holding.entity';
import type { TradeEvent } from '../../investments/trade-ledger';

/**
 * Holdings a sheet's ticker names. Stored symbols carry a market (VWCE.DE,
 * ACME.US); a broker often writes the bare ticker, which then matches the
 * one holding with that ticker on any market.
 */
export function bySymbol(holdings: InvestmentHolding[], raw: string, normalized: string) {
  const exact = holdings.filter(holding => holding.symbol === normalized);
  if (exact.length > 0 || raw.includes('.')) return exact;
  const ticker = raw.toUpperCase();
  return holdings.filter(holding => holding.symbol?.split('.')[0] === ticker);
}

/** "3:1", "3 for 1", "3-for-1", "1/10", "1 to 10": new units for old. */
export function parseRatio(raw: string): { to: number; from: number } | null {
  const match =
    /^\s*(\d+(?:[.,]\d+)?)\s*(?::|\/|-?\s*for\s*-?|to|за|к)\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(raw);
  if (!match) return null;
  const to = Number(match[1].replace(',', '.'));
  const from = Number(match[2].replace(',', '.'));
  return to > 0 && from > 0 ? { to, from } : null;
}

/** Two trades of one holding that say the same thing: kind, day and every figure. */
export function sameTrade(stored: TradeEvent, row: Omit<TradeEvent, 'id'>): boolean {
  const same = (a: number | null, b: number | null) =>
    a === null || b === null ? a === b : Math.abs(a - b) < 1e-9;
  return (
    stored.kind === row.kind &&
    stored.date === row.date &&
    same(stored.quantity, row.quantity) &&
    same(stored.price, row.price) &&
    same(stored.fee, row.fee) &&
    same(stored.amount, row.amount) &&
    same(stored.splitFrom, row.splitFrom) &&
    same(stored.splitTo, row.splitTo)
  );
}

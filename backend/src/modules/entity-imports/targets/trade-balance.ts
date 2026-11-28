import { normalizeStockSymbol } from '../../investments/stock-price.service';
import { countsUnits, replayTrades, type TradeEvent } from '../../investments/trade-ledger';
import {
  type detectDateOrder,
  nameKey,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext } from './target.types';

/** The book a row goes to: its holding's symbol, else its name; none without either. */
export function bookKey(row: string[], ctx: ImportContext): string | null {
  const raw = ctx.cell(row, 'symbol').trim();
  const name = ctx.cell(row, 'name').trim();
  return raw ? `s:${normalizeStockSymbol(raw)}` : name ? `n:${nameKey(name)}` : null;
}

/**
 * For each book the rows state a balance for (a statement's opening cash),
 * the last day the rows reach: the end of the statement they come from.
 */
export function statedBookEnds(
  rows: string[][],
  ctx: ImportContext,
  order: ReturnType<typeof detectDateOrder>,
): Map<string, string> {
  const stated = new Set(
    rows
      .filter(row => resolveEnumAlias('tradeKind', ctx.cell(row, 'kind')) === 'balance')
      .map(row => bookKey(row, ctx)),
  );
  const ends = new Map<string, string>();
  for (const row of rows) {
    const key = bookKey(row, ctx);
    const date = parseImportDate(ctx.cell(row, 'date'), order);
    if (key && date && stated.has(key) && date > (ends.get(key) ?? '')) {
      ends.set(key, date);
    }
  }
  return ends;
}

/**
 * What a stated balance moves: the units it states at the start of its day,
 * less those held before that day (a top-up on the statement's first day is a
 * move of its own). Null when the row states no units.
 */
export function balanceDifference(
  events: TradeEvent[],
  stated: string,
  date: string,
): number | null {
  const units = parseImportNumber(stated).value;
  if (units === null) {
    return null;
  }
  const before = events.filter(event => event.date < date);
  return units - (countsUnits(before) ? replayTrades(before, 'fifo').quantity : 0);
}

/**
 * Whether a later statement already holds this one: moves stored after the
 * day these rows end mean a later balance was stated, and it counts what these
 * rows moved. Imported out of order, the rows would count it twice.
 */
export function coveredByLater(stored: TradeEvent[], end: string | undefined): boolean {
  return end !== undefined && stored.some(event => event.date > end);
}

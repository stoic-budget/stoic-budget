import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';

type ColumnMapping = Record<string, number>;

/**
 * A plain export ("Date, Description, Amount") has no payee column: its
 * description is who was paid. Without this every row would read "Unknown".
 * A purpose column (Назначение, Purpose) stays a purpose.
 */
export function descriptionAsPayee(headers: string[], mapping: ColumnMapping): ColumnMapping {
  const index = mapping.purpose;
  if (mapping.counterparty !== undefined || index === undefined) return mapping;
  if (!/description|описание/i.test(headers[index] ?? '')) return mapping;
  const { purpose: _purpose, ...rest } = mapping;
  return { ...rest, counterparty: index };
}

/** The currency most rows carry: a file's own Currency column speaks for the statement. */
export function mostCommonCurrency(
  transactions: Pick<ParsedTransaction, 'currency'>[],
): string | null {
  const counts = new Map<string, number>();
  for (const { currency } of transactions) {
    if (currency) counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [currency, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) best = currency;
  }
  return best;
}

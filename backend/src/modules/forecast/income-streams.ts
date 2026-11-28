import type { IncomeRow } from './forecast.engine';

/**
 * Income rows by payer, a payer paying in two currencies as two streams: their
 * amounts do not compare. Rows with no payer name are left out.
 */
export function incomeStreams(rows: IncomeRow[]): Map<string, IncomeRow[]> {
  const streams = new Map<string, IncomeRow[]>();
  for (const row of rows) {
    const payer = (row.counterpartyName ?? '').trim().toLowerCase();
    const key = `${payer}|${(row.currency ?? '').toUpperCase()}`;
    if (payer) streams.set(key, [...(streams.get(key) ?? []), row]);
  }
  return streams;
}

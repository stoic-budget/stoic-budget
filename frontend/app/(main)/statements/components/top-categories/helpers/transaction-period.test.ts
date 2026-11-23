import { describe, expect, it } from 'vitest';
import { resolveStatementDateValue } from '../../filters/statement-filter-internals';
import { mapTransactionToRecord } from '../../top-merchants/helpers/top-merchants-mappers';
import { mapTransactionToCategoryRecord } from './top-categories-mappers';

// A statement for 20 February – 15 March, holding a purchase of 20 February.
const meta = { statementDateFrom: '2026-02-20', statementDateTo: '2026-03-15', status: 'completed' };
const purchase = {
  id: 'tx-1',
  transactionDate: '2026-02-20',
  debit: 200,
  credit: 0,
  amount: -200,
  transactionType: 'expense',
  counterpartyName: 'ACME Store',
  category: { name: 'Shopping' },
  currency: 'EUR',
};

describe('cash flow tables place a row in the period of its own date', () => {
  it('categories table: the February purchase is in February', () => {
    const record = mapTransactionToCategoryRecord(purchase as never, meta as never, 'EUR');
    expect(resolveStatementDateValue(record as never).slice(0, 10)).toBe('2026-02-20');
  });

  it('payees table: the February purchase is in February', () => {
    const record = mapTransactionToRecord(purchase as never, meta as never, 'EUR');
    expect(resolveStatementDateValue(record as never).slice(0, 10)).toBe('2026-02-20');
  });
});

describe('a date-only value is its own day in any time zone', () => {
  it('reads 1 March as 1 March, not the last of February west of Greenwich', async () => {
    const { toDateOnly } = await import('../../filters/statement-filter-internals');
    const day = toDateOnly('2026-03-01');
    expect([day?.getFullYear(), day?.getMonth(), day?.getDate()]).toEqual([2026, 2, 1]);
  });
});

import { describe, expect, it } from 'vitest';
import { mapApiRecordToTransaction } from './transactionMapper';

describe('mapApiRecordToTransaction', () => {
  const row = {
    id: 'row-1',
    transactionDate: '2026-11-02',
    counterpartyName: 'ACME Store - Wireless Buds',
    paymentPurpose: 'Wireless Buds',
    debit: 89,
  };

  it('keeps the row’s comment, which the drawer’s Comment field starts from', () => {
    expect(mapApiRecordToTransaction({ ...row, comments: 'Paid in cash · Holiday' }).comments).toBe(
      'Paid in cash · Holiday',
    );
  });

  it('reads a row without a comment as none', () => {
    expect(mapApiRecordToTransaction(row).comments).toBeNull();
  });
});

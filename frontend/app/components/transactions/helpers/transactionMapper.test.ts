import { describe, expect, it } from 'vitest';
import { transactionItem } from '@/app/test/fixtures/contracts';
import { fromStatementTransaction, mapApiRecordToTransaction } from './transactionMapper';

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

describe('a list row mapped for the drawer', () => {
  // The drawer offers Undo split only on a row that still carries its group.
  it('keeps the split group and index of a split part', () => {
    const part = { ...transactionItem({ id: 'part-2' }), splitGroupId: 'group-1', splitIndex: 1 };

    const opened = mapApiRecordToTransaction(fromStatementTransaction(part));

    expect(opened.splitGroupId).toBe(part.splitGroupId);
    expect(opened.splitIndex).toBe(part.splitIndex);
  });

  it('leaves a row nobody split without a group', () => {
    const opened = mapApiRecordToTransaction(fromStatementTransaction(transactionItem({ id: 'whole' })));

    expect(opened.splitGroupId ?? null).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { transactionItem } from '@/app/test/fixtures/contracts';
import { fromStatementTransaction, mapApiRecordToTransaction } from './transactionMapper';

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

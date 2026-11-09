import type { Transaction } from '@/entities/transaction.entity';
import {
  assertSplitAllowed,
  cloneForSplit,
} from '@/modules/transactions/helpers/transaction-split-clone';

describe('cloneForSplit', () => {
  it('hands the payment type to every part', () => {
    const source = { workspaceId: 'ws-1', paymentType: 'card' } as Transaction;

    expect(cloneForSplit(source).paymentType).toBe('card');
  });

  it('keeps an empty payment type empty', () => {
    const source = { workspaceId: 'ws-1', paymentType: null } as Transaction;

    expect(cloneForSplit(source).paymentType).toBeNull();
  });

  it('keeps every part out of budgets when the whole was left out', () => {
    const source = { workspaceId: 'ws-1', excludedFromBudgets: true } as Transaction;

    expect(cloneForSplit(source).excludedFromBudgets).toBe(true);
  });
});

describe('assertSplitAllowed', () => {
  it('refuses a row the bank has not booked yet', () => {
    const pending = { workspaceId: 'ws-1', isPending: true } as Transaction;

    expect(() => assertSplitAllowed(pending)).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'TRANSACTION_SPLIT_PENDING' }) }),
    );
  });

  it('lets a booked row through', () => {
    const booked = { workspaceId: 'ws-1', isPending: false } as Transaction;

    expect(() => assertSplitAllowed(booked)).not.toThrow();
  });
});

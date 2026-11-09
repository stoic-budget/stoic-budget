import type { Transaction } from '@/entities/transaction.entity';
import { cloneForSplit } from '@/modules/transactions/helpers/transaction-split-clone';

describe('cloneForSplit', () => {
  it('hands the payment type to every part', () => {
    const source = { workspaceId: 'ws-1', paymentType: 'card' } as Transaction;

    expect(cloneForSplit(source).paymentType).toBe('card');
  });

  it('keeps an empty payment type empty', () => {
    const source = { workspaceId: 'ws-1', paymentType: null } as Transaction;

    expect(cloneForSplit(source).paymentType).toBeNull();
  });

  it('keeps every part of split interest on its loan payment', () => {
    const source = { workspaceId: 'ws-1', loanInterestOfId: 'payment-1' } as Transaction;

    expect(cloneForSplit(source).loanInterestOfId).toBe('payment-1');
  });
});

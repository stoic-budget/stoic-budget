import type { Transaction } from '@/entities/transaction.entity';
import { matchesConditions } from '@/modules/classification/engine/rule-conditions';

const row = (overrides: Partial<Transaction>) => overrides as Transaction;

describe('rule conditions on the amount', () => {
  it('reads a stored amount as a number: 25.00 is 25', () => {
    const stored = row({ amount: '25.00' as unknown as number });

    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: 25 }])).toBe(true);
    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: '25' }])).toBe(true);
    expect(matchesConditions(stored, [{ field: 'amount', operator: 'equals', value: 26 }])).toBe(false);
  });
});

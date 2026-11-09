import { type PlannedRow, planTransactionChange } from '@/modules/mcp/confirm/transaction-change-rules';

const me = 'member-1';
const row = (id: string, overrides: Partial<PlannedRow> = {}): PlannedRow => ({
  id,
  transactionDate: '2026-10-05',
  amount: '12.50',
  currency: 'EUR',
  counterpartyName: 'ACME Store - Wireless Buds',
  categoryId: 'cat-food',
  categoryName: 'Food',
  isVerified: false,
  taxLocked: false,
  isPrivate: false,
  ownerMemberId: me,
  ...overrides,
});
const target = { name: 'Gadgets' };

describe('planTransactionChange', () => {
  it('changes the rows the call would change and says why each other id is left alone', () => {
    const rows = [
      row('a'),
      row('same', { categoryId: 'cat-gadgets' }),
      row('theirs', { isPrivate: true, ownerMemberId: 'member-2' }),
      row('filed', { taxLocked: true }),
    ];

    const plan = planTransactionChange(
      ['a', 'missing', 'same', 'theirs', 'filed', 'a'],
      rows,
      { categoryId: 'cat-gadgets' },
      target,
      me,
    );

    expect(plan.rows).toEqual([{ id: 'a', state: 'cat-food|0' }]);
    expect(plan.skipped).toEqual([
      { reason: 'not_found', ids: ['missing'] },
      { reason: 'unchanged', ids: ['same'] },
      { reason: 'private', ids: ['theirs'] },
      { reason: 'tax_locked', ids: ['filed'] },
    ]);
    expect(plan.examples).toEqual([
      {
        id: 'a',
        date: '2026-10-05',
        amount: '12.50',
        currency: 'EUR',
        counterparty: 'ACME Store - Wireless Buds',
        before: { categoryId: 'cat-food', categoryName: 'Food', approved: false },
        after: { categoryId: 'cat-gadgets', categoryName: 'Gadgets', approved: false },
      },
    ]);
  });

  it('finds rows asked for by an upper-case id, once each', () => {
    const plan = planTransactionChange(
      ['A', 'a', 'MISSING'],
      [row('a')],
      { approve: true },
      target,
      me,
    );

    expect(plan.rows.map(r => r.id)).toEqual(['a']);
    expect(plan.skipped).toEqual([{ reason: 'not_found', ids: ['missing'] }]);
  });

  it('approves another member’s private row without naming its merchant', () => {
    const plan = planTransactionChange(
      ['theirs'],
      [row('theirs', { isPrivate: true, ownerMemberId: 'member-2' })],
      { approve: true },
      { name: null },
      me,
    );

    expect(plan.rows.map(r => r.id)).toEqual(['theirs']);
    expect(plan.examples[0].counterparty).toBe('—');
    expect(JSON.stringify(plan)).not.toContain('ACME');
    expect(plan.examples[0].after).toEqual({
      categoryId: 'cat-food',
      categoryName: 'Food',
      approved: true,
    });
  });

  it('keeps the owner’s own private row readable to them', () => {
    const plan = planTransactionChange(
      ['mine'],
      [row('mine', { isPrivate: true })],
      { categoryId: 'cat-gadgets' },
      target,
      me,
    );

    expect(plan.examples[0].counterparty).toBe('ACME Store - Wireless Buds');
  });

  it('treats an approved row with the asked category as unchanged, and a filed one as locked only when a category is sent', () => {
    const rows = [
      row('done', { isVerified: true }),
      row('filed', { taxLocked: true }),
      row('filed-done', { taxLocked: true, isVerified: true }),
    ];

    const approveOnly = planTransactionChange(['done', 'filed'], rows, { approve: true }, target, me);
    const withSameCategory = planTransactionChange(
      ['done', 'filed', 'filed-done'],
      rows,
      { approve: true, categoryId: 'cat-food' },
      target,
      me,
    );

    expect(approveOnly.rows.map(r => r.id)).toEqual(['filed']);
    expect(approveOnly.skipped).toEqual([{ reason: 'unchanged', ids: ['done'] }]);
    // The update refuses any category on a filed row, even its own.
    expect(withSameCategory.rows).toEqual([]);
    expect(withSameCategory.skipped).toEqual([
      { reason: 'unchanged', ids: ['done', 'filed-done'] },
      { reason: 'tax_locked', ids: ['filed'] },
    ]);
  });

  it('clears a category with null, and a row without one is unchanged', () => {
    const plan = planTransactionChange(
      ['a', 'bare'],
      [row('a'), row('bare', { categoryId: null, categoryName: null })],
      { categoryId: null },
      { name: null },
      me,
    );

    expect(plan.rows).toEqual([{ id: 'a', state: 'cat-food|0' }]);
    expect(plan.skipped).toEqual([{ reason: 'unchanged', ids: ['bare'] }]);
    expect(plan.examples[0].after).toMatchObject({ categoryId: null, categoryName: null });
  });

  it('spells out at most five examples and reads dates and amounts as the database sends them', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `r${i}`);
    const plan = planTransactionChange(
      ids,
      ids.map(id => row(id, { transactionDate: new Date('2026-10-07T00:00:00Z'), amount: 3 })),
      { approve: true },
      target,
      me,
    );

    expect(plan.rows).toHaveLength(8);
    expect(plan.examples).toHaveLength(5);
    expect(plan.examples[0]).toMatchObject({ date: '2026-10-07', amount: '3' });
  });
});

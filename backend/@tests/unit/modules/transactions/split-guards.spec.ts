import { assertSplittable } from '@/modules/transactions/helpers/split-guards';

const row = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'tx-1',
    amount: '1000.00',
    debit: '1000.00',
    credit: null,
    splitGroupId: null,
    transferPairKind: null,
    transferPairId: null,
    investmentAccountId: null,
    reimbursementOfId: null,
    isDuplicate: false,
    isPending: false,
    taxLocked: false,
    isPrivate: false,
    ownerMemberId: null,
    ...overrides,
  }) as never;

const parts = { parts: [{ amount: 600 }, { amount: 400 }] } as never;

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as { getResponse(): { code: string } }).getResponse().code;
  }
  return null;
};

describe('assertSplittable', () => {
  it.each([
    ['a transfer between own accounts', { transferPairId: 'tx-2', transferPairKind: 'transfer' }],
    ['a move into an investment account', { investmentAccountId: 'inv-1' }],
    ['a reimbursement of an expense', { reimbursementOfId: 'tx-3' }],
  ])('refuses %s: its parts would count as spending', (_label, linked) => {
    expect(codeOf(() => assertSplittable(row(linked), parts, null))).toBe('TRANSACTION_SPLIT_LINKED');
  });

  it('lets an ordinary row through', () => {
    expect(codeOf(() => assertSplittable(row(), parts, null))).toBeNull();
  });
});

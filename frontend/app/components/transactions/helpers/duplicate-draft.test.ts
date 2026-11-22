import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '../types';
import { canDuplicate, duplicateDraft } from './duplicate-draft';

const MERCHANT = 'ACME Store - Wireless Buds';
const GROCERIES: Category = { id: 'cat-groceries', name: 'Groceries', type: 'expense' };
const ACCOUNT = { id: 'wallet-1', currency: 'EUR', isActive: true };

function row(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    transactionDate: '2026-10-12',
    counterpartyName: MERCHANT,
    paymentPurpose: 'Order 1042',
    comments: 'For the office',
    debit: 49.9,
    credit: 0,
    amount: -49.9,
    transactionType: 'expense',
    currency: 'EUR',
    category: { id: GROCERIES.id, name: GROCERIES.name },
    walletId: ACCOUNT.id,
    isVerified: false,
    ...overrides,
  };
}

describe('canDuplicate', () => {
  it('offers a plain expense', () => {
    expect(canDuplicate(row())).toBe(true);
  });

  it.each([
    ['income', { transactionType: 'income', debit: 0, credit: 49.9 }],
    ['a transfer leg', { transferPairId: 'pair-1', transferPairKind: 'transfer' as const }],
    ['money moved into an investment account', { investmentAccountId: 'inv-1' }],
    ['a split part', { splitGroupId: 'group-1', splitIndex: 1 }],
    ['a private row', { isPrivate: true, ownerMemberId: 'member-1' }],
    ['a row a synced crypto wallet brought in', { cryptoWalletId: 'crypto-1', counterpartyName: '0xabc0000000000000000000000000000000000001' }],
  ])('does not offer %s', (_case, overrides) => {
    expect(canDuplicate(row(overrides as Partial<Transaction>))).toBe(false);
  });
});

describe('duplicateDraft', () => {
  it('fills in what the manual expense form holds, and nothing else', () => {
    const tx = row({
      statementId: 'statement-1',
      transferPairId: 'pair-1',
      reimbursementOfId: 'tx-0',
      splitGroupId: 'group-1',
      isVerified: true,
      ownerMemberId: 'member-1',
      payee: { id: 'payee-1', name: MERCHANT },
    } as Partial<Transaction>);

    const draft = duplicateDraft(tx, [GROCERIES], [ACCOUNT]);

    expect(draft).toEqual({
      amount: '49.90',
      currency: 'EUR',
      merchant: MERCHANT,
      description: 'Order 1042',
      categoryId: GROCERIES.id,
      taxRateId: '',
      walletId: ACCOUNT.id,
    });
    const sent = JSON.stringify(draft);
    for (const value of ['statement-1', 'pair-1', 'tx-0', 'group-1', 'member-1', 'payee-1']) {
      expect(sent).not.toContain(value);
    }
    // The comment and the original date stay behind: the form has no field for one, its own today for the other.
    expect(sent).not.toContain('For the office');
    expect(sent).not.toContain('2026-10-12');
  });

  it.each([
    [49.9, 'EUR', '49.90'],
    [50, 'EUR', '50.00'],
    [1500, 'JPY', '1500'],
    [1.234, 'KWD', '1.234'],
    [0.005, 'EUR', '0.005'],
    [0, 'EUR', ''],
  ])('writes %s %s as the form would show it typed: %s', (debit, currency, expected) => {
    expect(duplicateDraft(row({ debit, currency }), [], []).amount).toBe(expected);
  });

  it('leaves the description empty when the purpose only repeats the merchant', () => {
    expect(duplicateDraft(row({ paymentPurpose: MERCHANT }), [], []).description).toBe('');
  });

  it.each([
    ['disabled', { ...GROCERIES, isEnabled: false }],
    ['an income category', { ...GROCERIES, type: 'income' as const }],
    ['the private bucket', { ...GROCERIES, name: 'Private' }],
  ])('leaves the category to pick when it is %s', (_case, category) => {
    expect(duplicateDraft(row(), [category], []).categoryId).toBe('');
  });

  it('leaves the category to pick when it is gone', () => {
    expect(duplicateDraft(row(), [], []).categoryId).toBe('');
  });

  it.each([
    ['closed', { ...ACCOUNT, isActive: false }],
    ['in another currency', { ...ACCOUNT, currency: 'USD' }],
  ])('keeps no account that is %s', (_case, account) => {
    expect(duplicateDraft(row(), [], [account]).walletId).toBeUndefined();
  });

  it('keeps no account that is gone', () => {
    expect(duplicateDraft(row(), [], []).walletId).toBeUndefined();
  });
});

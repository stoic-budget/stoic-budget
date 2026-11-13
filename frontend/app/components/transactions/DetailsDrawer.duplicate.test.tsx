// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearManualPrefill,
  DUPLICATE_EXPENSE_HREF,
  peekManualPrefill,
} from '@/app/lib/manual-expense-prefill';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import DetailsDrawer from './DetailsDrawer';
import type { Category, Transaction } from './types';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/components/notes/NotesPanel', () => ({ NotesPanel: () => null }));
vi.mock('@/app/components/payees/useOfferPayeeQueue', () => ({ useOfferPayeeQueue: () => vi.fn() }));
vi.mock('./hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: () => [] }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('./TransactionHistoryTab', () => ({ TransactionHistoryTab: () => null }));

const MERCHANT = 'ACME Store - Wireless Buds';
const SNACKS: Category = { id: 'cat-snacks', name: 'Snacks', type: 'expense' };
const ACCOUNT = walletItem({ id: '11111111-1111-4111-8111-111111111111', name: 'Everyday', currency: 'EUR' });

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    transactionDate: '2026-10-12',
    counterpartyName: MERCHANT,
    paymentPurpose: 'Order 1042',
    debit: 12.5,
    credit: 0,
    amount: -12.5,
    transactionType: 'expense',
    currency: 'EUR',
    category: { id: SNACKS.id, name: SNACKS.name },
    walletId: ACCOUNT.id,
    statementId: 'statement-1',
    isVerified: false,
    ...overrides,
  } as Transaction;
}

function renderDrawer(tx: Transaction, onClose = vi.fn()) {
  renderWithQuery(
    <DetailsDrawer
      open
      transaction={tx}
      categories={[SNACKS]}
      onClose={onClose}
      onUpdateCategory={vi.fn()}
      onSplitDone={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
}

describe('DetailsDrawer: Duplicate', () => {
  beforeEach(() => {
    clearManualPrefill();
    router.push.mockReset();
    api.get.mockReset().mockImplementation(async (url: string) => ({
      data: url === '/wallets' ? [ACCOUNT] : [],
    }));
    api.post.mockReset();
    api.put.mockReset();
    api.delete.mockReset();
  });
  afterEach(() => clearManualPrefill());

  it('opens the manual expense form filled in from the row, sending nothing', async () => {
    const onClose = vi.fn();
    renderDrawer(transaction(), onClose);

    fireEvent.click(screen.getByRole('button', { name: 'sheet.duplicate' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(DUPLICATE_EXPENSE_HREF));
    // The drawer closes so the form is not opened underneath it (on Documents it would be).
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(peekManualPrefill()).toEqual({
      amount: '12.50',
      currency: 'EUR',
      merchant: MERCHANT,
      description: 'Order 1042',
      categoryId: SNACKS.id,
      taxRateId: '',
      walletId: ACCOUNT.id,
    });
    // Reading the accounts is the only call: nothing is created, changed or deleted.
    expect(api.get.mock.calls.map(([url]) => url)).toContain('/wallets');
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['income', { transactionType: 'income', debit: 0, credit: 12.5 }],
    ['a transfer leg', { transferPairId: 'pair-1', transferPairKind: 'transfer' }],
    ['a reimbursement pair', { transferPairId: 'pair-1', transferPairKind: 'reimbursement' }],
    ['money moved into an investment account', { investmentAccountId: 'inv-1' }],
    ['a split part', { splitGroupId: 'group-1', splitIndex: 0 }],
    ['a private row', { isPrivate: true, ownerMemberId: 'member-2', counterpartyName: '—' }],
    ['a row a synced crypto wallet brought in', { cryptoWalletId: 'crypto-1' }],
  ])('is not offered on %s', (_case, overrides) => {
    renderDrawer(transaction(overrides as Partial<Transaction>));

    expect(screen.queryByRole('button', { name: 'sheet.duplicate' })).toBeNull();
  });
});

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { TransactionDetailsTab } from './TransactionDetailsTab';
import type { Transaction } from './types';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/contexts/CurrencyDisplayContext', () => ({
  useCurrencyDisplay: () => ({ showConverted: false, workspaceCurrency: 'EUR' }),
}));
vi.mock('./hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: () => [] }));
vi.mock('./hooks/useBulkUpdateOwner', () => ({ useBulkUpdateOwner: () => vi.fn() }));
// The payee, rule and own-transfer sections fetch on their own; this file is about the investment actions.
vi.mock('@/app/components/payees/TransactionPayeeSection', () => ({
  TransactionPayeeSection: () => null,
}));
vi.mock('@/app/components/payees/useOfferPayeeQueue', () => ({ useOfferPayeeQueue: () => vi.fn() }));
vi.mock('@/app/components/rules/RuleFromRowAction', () => ({ RuleFromRowAction: () => null }));
vi.mock('./OwnTransferActions', () => ({ OwnTransferActions: () => null }));


function expense(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    transactionDate: '2026-10-01',
    counterpartyName: 'ACME Store',
    paymentPurpose: 'Purchase',
    debit: 10,
    credit: 0,
    amount: 10,
    transactionType: 'expense',
    currency: 'EUR',
    transferPairId: null,
    transferPairKind: null,
    investmentAccountId: null,
    ...overrides,
  } as Transaction;
}

const renderTab = (transaction: Transaction) =>
  render(
    <TransactionDetailsTab
      transaction={transaction}
      categories={[]}
      onSplitDone={vi.fn()}
      onUpdateCategory={vi.fn()}
    />,
  );

describe('TransactionDetailsTab — balance adjustment', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue(apiResponse([]));
  });

  it('names the row and offers no category, split or unlink: deleting it is the undo', () => {
    const { container } = renderTab(
      expense({ transferPairId: 'tx-1', transferPairKind: 'adjustment' }),
    );
    expect(container.querySelector('label[for="category-select"]')).toBeNull();

    expect(screen.getByTestId('transfer-badge')).toHaveTextContent('Balance adjustment');
    expect(screen.queryByRole('button', { name: /^Split/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Unlink transfer/ })).toBeNull();
  });

  it('still offers them on a transfer between own accounts', () => {
    const { container } = renderTab(
      expense({ transferPairId: 'pair-1', transferPairKind: 'transfer' }),
    );
    expect(container.querySelector('label[for="category-select"]')).not.toBeNull();

    expect(screen.getByTestId('transfer-badge')).toHaveTextContent('Transfer between accounts');
    expect(screen.getByRole('button', { name: /^Split/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlink transfer/ })).toBeInTheDocument();
  });
});

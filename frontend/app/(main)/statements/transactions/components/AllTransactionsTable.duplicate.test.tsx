// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryList } from '@/app/lib/contracts';
import {
  clearManualPrefill,
  DUPLICATE_EXPENSE_HREF,
  peekManualPrefill,
} from '@/app/lib/manual-expense-prefill';
import { categoryItem, transactionItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { ListedRow } from '../all-transactions';
import { AllTransactionsTable } from './AllTransactionsTable';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('@/app/components/item-images/ItemImageBadge', () => ({
  ItemImageBadge: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/(main)/statements/[id]/edit/StatementCategoryDrawer', () => ({ default: () => null }));
// The menu's items, shown inline: what it offers is the point, not how it opens.
vi.mock('@/app/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => children,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

const MERCHANT = 'ACME Store - Wireless Buds';
const CATEGORIES: CategoryList = [categoryItem({ id: 'cat-snacks', name: 'Snacks' })];

function renderTable(rows: ListedRow[]) {
  renderWithQuery(
    <AllTransactionsTable
      rows={rows}
      categories={CATEGORIES}
      budgetByCategory={new Map()}
      selected={new Set()}
      onToggle={vi.fn()}
      onToggleAll={vi.fn()}
      onSetCategory={vi.fn()}
      onOpen={vi.fn()}
    />,
  );
  return screen.getAllByRole('menu');
}

const listed = (overrides: Partial<ListedRow> & Pick<ListedRow, 'id'>): ListedRow => ({
  ...transactionItem({
    id: overrides.id,
    counterpartyName: MERCHANT,
    paymentPurpose: MERCHANT,
    debit: '12.50',
    amount: '-12.50',
    currency: 'EUR',
    categoryId: 'cat-snacks',
    category: { id: 'cat-snacks', name: 'Snacks', isEnabled: true, isSystem: false, source: 'user' },
  }),
  reimbursementOf: null,
  ...overrides,
});

describe('All transactions: Duplicate in the row menu', () => {
  beforeEach(() => {
    router.push.mockReset();
    api.get.mockReset().mockResolvedValue({ data: [] });
    api.post.mockReset();
  });
  afterEach(() => clearManualPrefill());

  it('opens the manual expense form filled in from the row, sending nothing', async () => {
    const [menu] = renderTable([listed({ id: 'tx-1' })]);

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'duplicate' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(DUPLICATE_EXPENSE_HREF));
    expect(peekManualPrefill()).toMatchObject({
      amount: '12.50',
      currency: 'EUR',
      merchant: MERCHANT,
      description: '',
      categoryId: 'cat-snacks',
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    ['income', { transactionType: 'income', debit: null, credit: '12.50' }],
    ['a transfer leg', { transferPairId: 'pair-1', transferPairKind: 'transfer' }],
    ['a split part', { splitGroupId: 'group-1' }],
    ['a private row', { isPrivate: true, ownerMemberId: 'member-2', counterpartyName: '—' }],
    ['a row a synced crypto wallet brought in', { cryptoWalletId: 'crypto-1' }],
  ])('is not offered on %s', (_case, overrides) => {
    const [menu] = renderTable([listed({ id: 'tx-1', ...(overrides as Partial<ListedRow>) })]);

    expect(within(menu).getByRole('menuitem', { name: 'details' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'duplicate' })).toBeNull();
  });
});

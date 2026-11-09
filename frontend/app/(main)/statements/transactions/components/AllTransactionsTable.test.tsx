// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { transactionItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { ListedRow } from '../all-transactions';
import { AllTransactionsTable } from './AllTransactionsTable';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/components/item-images/ItemImageBadge', () => ({
  ItemImageBadge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/(main)/statements/[id]/edit/StatementCategoryDrawer', () => ({
  default: () => null,
}));

const budgetName = 'Food budget';
const row = (id: string, excludedFromBudgets: boolean): ListedRow =>
  transactionItem({ id, categoryId: 'cat-food', excludedFromBudgets }) as ListedRow;

function renderTable(onSetExcluded = vi.fn()) {
  renderWithQuery(
    <AllTransactionsTable
      rows={[row('tx-counted', false), row('tx-left-out', true)]}
      categories={[]}
      budgetByCategory={new Map([['cat-food', budgetName]])}
      selected={new Set(['tx-counted', 'tx-left-out'])}
      onToggle={vi.fn()}
      onToggleAll={vi.fn()}
      onSetCategory={vi.fn()}
      onSetExcluded={onSetExcluded}
      onOpen={vi.fn()}
    />,
  );
  return onSetExcluded;
}

describe('AllTransactionsTable budget exclusion', () => {
  it("names a left-out row's budget cell instead of its category's budget", () => {
    renderTable();

    expect(screen.getAllByText(budgetName)).toHaveLength(1);
    expect(screen.getByText('Not in budgets')).toBeInTheDocument();
  });

  it('leaves the ticked rows out of budgets', () => {
    const onSetExcluded = renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Leave out of budgets' }));

    expect(onSetExcluded).toHaveBeenCalledWith(['tx-counted', 'tx-left-out'], true);
  });

  it('counts the ticked rows in budgets again', () => {
    const onSetExcluded = renderTable();

    fireEvent.click(screen.getByRole('button', { name: 'Count in budgets' }));

    expect(onSetExcluded).toHaveBeenCalledWith(['tx-counted', 'tx-left-out'], false);
  });
});

describe('AllTransactionsTable pending rows', () => {
  const pendingRow = (id: string, isPending: boolean): ListedRow =>
    transactionItem({ id, counterpartyName: 'ACME Store - Wireless Buds', isPending }) as ListedRow;

  it('marks only the row the bank still holds, and dims it', () => {
    renderWithQuery(
      <AllTransactionsTable
        rows={[pendingRow('tx-booked', false), pendingRow('tx-pending', true)]}
        categories={[]}
        budgetByCategory={new Map()}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        onSetCategory={vi.fn()}
        onSetExcluded={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const badges = screen.getAllByText('Pending');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute('title', expect.stringContaining('not booked it yet'));
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(row => row.classList.contains('is-pending-row'))).toEqual([false, true]);
  });
});

// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryRef, transactionItem } from '@/app/test/fixtures/contracts';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import { StatementTransactionsPanel } from './StatementTransactionsPanel';

const { confirmedPayee } = vi.hoisted(() => ({ confirmedPayee: 'ACME Store' }));
const appLocale = vi.hoisted(() => ({ current: 'en' }));
// What the server holds for tx-1: a save from the drawer changes it here.
const server = vi.hoisted(() => ({ excluded: false }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: async ({ url }: { url: string }) =>
    url === '/categories'
      ? []
      : {
          statement: { id: 'st-1', fileName: 'march.pdf', bankName: null, accountNumber: null },
          transactions: [
            transactionItem({
              id: 'tx-1',
              excludedFromBudgets: server.excluded,
              category: categoryRef({ id: 'cat-ads', name: 'Advertising' }),
            }),
            transactionItem({ id: 'tx-2', counterpartyName: confirmedPayee, isVerified: true }),
            // The file named no counterparty: stored empty.
            transactionItem({ id: 'tx-3', counterpartyName: '' }),
          ],
        },
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
// The drawer reports which version of the row it was handed.
vi.mock('@/app/components/transactions/DetailsDrawer', () => ({
  default: ({ transaction }: { transaction: { excludedFromBudgets?: boolean } | null }) =>
    transaction ? (
      <output data-testid="drawer-excluded">{String(transaction.excludedFromBudgets)}</output>
    ) : null,
}));
vi.mock('@/app/components/transactions/hooks/useBulkUpdateCategory', () => ({
  useBulkUpdateCategory: () => ({ mutateAsync: vi.fn() }),
}));
// The icon is looked up by the stored name, so the badge shows which name it got.
vi.mock('@/app/components/dashboard/CategoryIconBadge', () => ({
  CategoryIconBadge: ({ name }: { name: string }) => <i data-testid="category-icon">{name}</i>,
}));

describe('StatementTransactionsPanel', () => {
  beforeEach(() => {
    appLocale.current = 'en';
    server.excluded = false;
  });

  it("names a system category in the reader's language and keeps the stored name for its icon", async () => {
    appLocale.current = 'ru';
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText('Реклама')).toBeInTheDocument();
    expect(screen.getByTestId('category-icon')).toHaveTextContent('Advertising');
  });

  it('shows the stored name in English', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText('Advertising', { selector: 'span' })).toBeInTheDocument();
  });

  it('leaves out confirmed rows when Review opens it', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" unconfirmedOnly />);

    expect(await screen.findByText('Advertising', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(confirmedPayee)).toBeNull();
  });

  it("names a row without a counterparty in the reader's language", async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText('Unknown payee')).toBeInTheDocument();
  });

  it('shows every row in Documents', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText(confirmedPayee)).toBeInTheDocument();
  });

  it('hands the drawer the row as the list reloads it, so a saved change shows there', async () => {
    const client = createTestQueryClient();
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />, { client });
    fireEvent.click(await screen.findByText('Advertising', { selector: 'span' }));
    expect(screen.getByTestId('drawer-excluded')).toHaveTextContent('false');

    server.excluded = true;
    await client.invalidateQueries({ queryKey: ['transactions'] });

    expect(await screen.findByText('true')).toBeInTheDocument();
  });
});

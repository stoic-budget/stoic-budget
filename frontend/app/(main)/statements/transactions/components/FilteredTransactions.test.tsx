// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';
import { transactionItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { ListedRow } from '../all-transactions';
import type { TransactionsFilter } from '../hooks/useFilteredTransactions';
import { FilteredTransactions } from './FilteredTransactions';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useLocale: () => ({ locale: 'en' }), useIntlayer: () => autoDictionary() };
});
// The table and the drawer are All transactions' own; here they show what they were handed.
vi.mock('./AllTransactionsTable', () => ({
  AllTransactionsTable: ({
    rows,
    onOpen,
  }: {
    rows: ListedRow[];
    onOpen: (row: ListedRow) => void;
  }) => (
    <ul>
      {rows.map(row => (
        <li key={row.id}>
          <button type="button" onClick={() => onOpen(row)}>
            {`open ${row.id}`}
          </button>
        </li>
      ))}
    </ul>
  ),
}));
vi.mock('@/app/components/transactions/DetailsDrawer', () => ({
  default: ({
    open,
    transaction,
    source,
  }: {
    open: boolean;
    transaction: { id: string } | null;
    source?: { href: string; name: string };
  }) =>
    open ? (
      <aside data-testid="drawer" data-id={transaction?.id}>
        {source ? <a href={source.href}>{source.name}</a> : <span>no document</span>}
      </aside>
    ) : null,
}));

// As the list sends them: a row of `GET /transactions` plus what it repays.
const rows = [
  { ...transactionItem({ id: 'tx-1', statementId: 'st-1', counterpartyName: 'ACME Store' }) },
  { ...transactionItem({ id: 'tx-2', counterpartyName: 'Example Bakery' }) },
].map(row => ({ ...row, reimbursementOf: null }));

function answer(url: string) {
  if (url === '/transactions') {
    return Promise.resolve(apiResponse({ data: rows, items: rows, total: 60, page: 1, limit: 25 }));
  }
  if (url === '/categories' || url === '/budgets') {
    return Promise.resolve(apiResponse([]));
  }
  return Promise.reject(new Error(`unexpected ${url}`));
}

const listParams = () =>
  api.get.mock.calls
    .filter(([url]) => url === '/transactions')
    .map(([, config]) => (config as { params: Record<string, unknown> }).params);

const render = (filter: TransactionsFilter) =>
  renderWithQuery(<FilteredTransactions filter={filter} title="Rows" empty="Nothing here" />);

/** A page that narrows the list to a month, as the category page's bars do. */
function MonthPicker(): React.JSX.Element {
  const [month, setMonth] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setMonth(true)}>
        May
      </button>
      <FilteredTransactions
        filter={{
          categoryId: 'c-food',
          subcategories: '1',
          ...(month ? { date_from: '2026-05-01', date_to: '2026-05-31' } : {}),
        }}
        title="Rows"
        empty="Nothing here"
      />
    </>
  );
}

describe('FilteredTransactions', () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation(answer);
  });

  it('asks for the filter’s rows, a page at a time', async () => {
    render({ categoryId: 'c-food', subcategories: '1' });

    await screen.findByText('open tx-1');
    expect(listParams()[0]).toEqual({
      categoryId: 'c-food',
      subcategories: '1',
      page: 1,
      limit: 25,
      running_balance: '1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(listParams().at(-1)).toMatchObject({ page: 2 }));
  });

  it('starts again on page 1 when the filter narrows to a month', async () => {
    renderWithQuery(<MonthPicker />);
    await screen.findByText('open tx-1');
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(listParams().at(-1)).toMatchObject({ page: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'May' }));
    await waitFor(() =>
      expect(listParams().at(-1)).toEqual({
        categoryId: 'c-food',
        subcategories: '1',
        date_from: '2026-05-01',
        date_to: '2026-05-31',
        page: 1,
        limit: 25,
        running_balance: '1',
      }),
    );
  });

  it('opens a row in the drawer, with a link to its document when it has one', async () => {
    render({ payeeId: 'p-store' });

    fireEvent.click(await screen.findByText('open tx-1'));
    const drawer = await screen.findByTestId('drawer');
    expect(drawer.dataset.id).toBe('tx-1');
    expect(screen.getByRole('link', { name: 'openDocument' }).getAttribute('href')).toBe(
      '/statements/st-1/edit',
    );
  });

  it('opens a row without a document without a link', async () => {
    render({ payeeId: 'p-store' });

    fireEvent.click(await screen.findByText('open tx-2'));
    expect(await screen.findByText('no document')).toBeTruthy();
  });

  it('says so when the filter has no rows', async () => {
    api.get.mockImplementation((url: string) =>
      url === '/transactions'
        ? Promise.resolve(apiResponse({ data: [], items: [], total: 0, page: 1, limit: 25 }))
        : answer(url),
    );
    render({ categoryId: 'c-empty', subcategories: '1' });

    expect(await screen.findByText('Nothing here')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { AllTransactionsView } from './AllTransactionsView';

const tagId = '4c1d9e2a-3b5f-4a6c-8d7e-9f0a1b2c3d4e';
const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: '' }));
const useAllTransactions = vi.hoisted(() => vi.fn());
const preference = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/statements/transactions',
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('../use-all-transactions', () => ({
  PAGE_SIZE: 50,
  useAllTransactions,
  useTransactionsOverview: () => ({ isPending: false, data: { months: [], categories: [] } }),
}));
vi.mock('@/app/lib/api', () => ({ default: { put: apiPut } }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: ({ url }: { url: string }) =>
    url === '/view-preferences/transactions' ? preference() : Promise.resolve([]),
}));
vi.mock('@/app/(main)/budgets/hooks/useBudgetsPage', () => ({ fetchBudgets: async () => [] }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useTags', () => ({
  useTags: () => ({ data: [{ id: tagId, name: 'Holiday', color: null, usageCount: 1 }] }),
}));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'EUR' } }),
}));
vi.mock('@/app/components/transactions/DetailsDrawer', () => ({ default: () => null }));
vi.mock('./OverviewPies', () => ({ OverviewPies: () => null }));
vi.mock('../../components/TransactionsPageTitle', () => ({ TransactionsPageTitle: () => null }));

/** The query the page last put in the URL. */
const lastUrl = () => new URLSearchParams(String(replace.mock.lastCall?.[0]).split('?')[1] ?? '');

describe('All transactions filters and the URL', () => {
  beforeEach(() => {
    replace.mockReset();
    useAllTransactions.mockReset();
    useAllTransactions.mockReturnValue({ isPending: false, isError: false, data: { data: [], total: 0 } });
    preference.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the list for the filters a link carries', () => {
    search.value = `month=2026-06&q=ACME&amountMin=5&tagIds=${tagId}&noPayee=1`;
    preference.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<AllTransactionsView />);

    expect(useAllTransactions).toHaveBeenLastCalledWith(
      { kind: 'month', month: '2026-06' },
      1,
      expect.objectContaining({ q: 'ACME', amountMin: 5, tagIds: [tagId], noPayee: true }),
    );
    expect(screen.getByRole('searchbox', { name: /Search payee/ })).toHaveProperty('value', 'ACME');
  });

  it('puts a toggled filter in the URL and keeps the rest', () => {
    search.value = 'month=2026-06&q=ACME';
    preference.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<AllTransactionsView />);

    fireEvent.click(screen.getByRole('button', { name: 'No tags' }));

    expect(Object.fromEntries(lastUrl())).toEqual({ month: '2026-06', q: 'ACME', untagged: '1' });
  });

  it('commits the search once typing pauses', () => {
    vi.useFakeTimers();
    search.value = 'all=1';
    preference.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<AllTransactionsView />);

    const box = screen.getByRole('searchbox', { name: /Search payee/ });
    fireEvent.change(box, { target: { value: 'AC' } });
    fireEvent.change(box, { target: { value: 'ACME ' } });
    expect(replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(lastUrl())).toEqual({ all: '1', q: 'ACME' });
  });

  it('clears every filter but the period', () => {
    search.value = `month=2026-06&q=ACME&tagIds=${tagId}&uncategorized=1&paymentType=card`;
    preference.mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<AllTransactionsView />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(Object.fromEntries(lastUrl())).toEqual({ month: '2026-06' });
  });

  it('saves the filters as a view beside what the scope already stores, and applies it', async () => {
    search.value = 'month=2026-06&q=ACME&noPayee=1';
    preference.mockResolvedValue({ state: { owner: 'me' } });
    renderWithQuery(<AllTransactionsView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Saved views' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Coffee' },
    });
    const save = screen.getByRole('button', { name: 'Save current filters' });
    await vi.waitFor(() => expect(save).toHaveProperty('disabled', false));
    fireEvent.click(save);

    expect(apiPut).toHaveBeenCalledWith('/view-preferences/transactions', {
      state: {
        owner: 'me',
        savedViews: [{ id: expect.any(String), name: 'Coffee', filters: 'q=ACME&noPayee=1' }],
      },
    });

    search.value = 'month=2026-06';
    fireEvent.click(screen.getByRole('button', { name: 'Coffee' }));
    expect(Object.fromEntries(lastUrl())).toEqual({ month: '2026-06', q: 'ACME', noPayee: '1' });
  });

  it('will not save a view when the stored ones failed to load, so none are overwritten', async () => {
    search.value = 'month=2026-06&q=ACME';
    preference.mockRejectedValue({ response: { status: 500 } });
    renderWithQuery(<AllTransactionsView />);

    fireEvent.click(await screen.findByRole('button', { name: 'Saved views' }));
    await screen.findByText(/Saved views could not be loaded/);
    fireEvent.change(screen.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Coffee' },
    });
    const save = screen.getByRole('button', { name: 'Save current filters' });
    expect(save).toHaveProperty('disabled', true);
    fireEvent.submit(save.closest('form') as HTMLFormElement);

    expect(apiPut).not.toHaveBeenCalled();
  });
});

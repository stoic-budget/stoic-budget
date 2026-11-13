'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchBudgets } from '@/app/(main)/budgets/hooks/useBudgetsPage';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** What narrows the list: a payee, a tag, or a category with its subcategories; a month. */
export type TransactionsFilter = Pick<
  ContractInput<'TransactionListQuery'>,
  'payeeId' | 'tagId' | 'categoryId' | 'subcategories' | 'date_from' | 'date_to'
>;

/**
 * One page of the rows a filter picks, as All transactions lists them, with
 * what the table and the drawer need beside them: the categories to pick from
 * and which budget each one feeds.
 */
export function useFilteredTransactions(filter: TransactionsFilter, page: number, limit: number) {
  const workspaceId = useWorkspaceId();
  const params = {
    ...filter,
    page,
    limit,
    running_balance: '1',
  } satisfies ContractInput<'TransactionListQuery'>;
  const list = useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { view: 'filtered', ...params } }),
    // A `{ data, total }` page: checked raw, since apiQueryDecoded would unwrap `data`.
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/transactions', { params, signal });
      return checkContract('TransactionListPage', response.data, '/transactions');
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: 5 * 60_000,
    enabled: Boolean(workspaceId),
  });
  const budgets = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
    enabled: Boolean(workspaceId),
  });
  const budgetByCategory = useMemo(
    () => new Map((budgets.data ?? []).map(budget => [budget.categoryId, budget.name])),
    [budgets.data],
  );
  return { list, categories: categories.data ?? [], budgetByCategory };
}

'use client';

import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import api from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export interface BulkExcludeFromBudgetsVariables {
  txIds: string[];
  /** True leaves the rows out of budgets, reports and the forecast; false brings them back. */
  excluded: boolean;
}

/**
 * Leaves rows out of every income and spending figure, or brings them back.
 * Their accounts and net worth keep counting them either way, so the refresh
 * is the same as for a category change: every figure built from transactions.
 */
export function useBulkExcludeFromBudgets(): UseMutationResult<
  void,
  Error,
  BulkExcludeFromBudgetsVariables
> {
  return useMutation({
    mutationFn: async ({ txIds, excluded }: BulkExcludeFromBudgetsVariables) => {
      await api.post('/transactions/bulk-update', {
        items: txIds.map(id => ({ id, updates: { excludedFromBudgets: excluded } })),
      } satisfies ContractInput<'BulkUpdateRequestBody'>);
    },
    onSuccess: () => {
      invalidateFinancialData();
    },
  });
}

/**
 * The same change with its toasts, for the drawer's switch and the lists' bulk
 * action: answers whether it was saved, so a list can clear its ticked rows.
 */
export function useSetExcludedFromBudgets(): {
  setExcluded: (txIds: string[], excluded: boolean) => Promise<boolean>;
  saving: boolean;
} {
  const t = useIntlayer('budgetExclusion');
  const mutation = useBulkExcludeFromBudgets();
  const setExcluded = (txIds: string[], excluded: boolean) =>
    mutation.mutateAsync({ txIds, excluded }).then(
      () => {
        toast.success(t.saved.value);
        return true;
      },
      (error: unknown) => {
        console.error('Failed to change whether rows count in budgets:', error);
        toast.error(t.failed.value);
        return false;
      },
    );
  return { setExcluded, saving: mutation.isPending };
}

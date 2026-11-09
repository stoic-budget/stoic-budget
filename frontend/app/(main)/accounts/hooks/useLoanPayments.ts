'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * The payments into a loan account with their split into principal and
 * interest. Under the account's own key: a split moves the account's balance
 * and its standing against the plan, and both refresh with it.
 */
export function useLoanPayments(walletId: string, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: [...queryKeys.wallet(workspaceId, walletId), 'loan-payments'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/wallets/${walletId}/loan-payments`,
        signal,
        contract: 'LoanPayments',
      }),
    enabled: Boolean(workspaceId && walletId && enabled),
  });
  return { payments: query.data ?? null, error: query.error };
}

/** Splitting a payment and joining it back; either refreshes the account and every figure. */
export function useLoanPaymentMutations(walletId: string, failedText: string) {
  const mutation = useMutation({
    mutationFn: (request: () => Promise<unknown>) => request(),
    onError: error => toast.error(getApiErrorMessage(error, failedText)),
    // Interest is spending: the account, the dashboard, reports and budgets all move.
    onSettled: () => invalidateFinancialData(),
  });
  const run = (request: () => Promise<unknown>) =>
    mutation
      .mutateAsync(request)
      .then(() => true)
      .catch(() => false);
  const url = (transactionId: string) =>
    `/wallets/${walletId}/loan-payments/${transactionId}/split`;

  return {
    pending: mutation.isPending,
    split: (transactionId: string, interest: number) =>
      run(async () => {
        const response = await apiClient.post(url(transactionId), {
          interest,
        } satisfies ContractInput<'LoanPaymentSplitBody'>);
        return checkContract('LoanPaymentItem', response.data, url(transactionId));
      }),
    rejoin: (transactionId: string) =>
      run(async () => {
        await apiClient.delete(url(transactionId));
      }),
  };
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { LoanTermsBody, LoanWhatIf } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * The terms and the schedule of a debt account. Both live under the account's
 * own key, so anything that refreshes the account (an import, an approval)
 * refreshes the real balance against the plan too.
 */
export function useLoan(walletId: string, enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const ready = Boolean(workspaceId && walletId && enabled);
  const base = queryKeys.wallet(workspaceId, walletId);

  const terms = useQuery({
    queryKey: [...base, 'loan-terms'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/wallets/${walletId}/loan-terms`,
        signal,
        contract: 'LoanTermsState',
      }),
    enabled: ready,
  });
  const hasTerms = Boolean(terms.data?.terms);
  const schedule = useQuery({
    queryKey: [...base, 'loan-schedule'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/wallets/${walletId}/loan-schedule`,
        signal,
        contract: 'LoanSchedule',
      }),
    enabled: ready && hasTerms,
  });

  return {
    terms: terms.data?.terms ?? null,
    schedule: hasTerms ? (schedule.data ?? null) : null,
    isPending: terms.isPending,
    error: terms.error ?? schedule.error,
  };
}

/** Saving and removing the terms; either refreshes the account's loan queries. */
export function useLoanMutations(walletId: string, failedText: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const base = queryKeys.wallet(workspaceId, walletId);
  const mutation = useMutation({
    mutationFn: (request: () => Promise<unknown>) => request(),
    onError: error => toast.error(getApiErrorMessage(error, failedText)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: base }),
  });
  const run = (request: () => Promise<unknown>) =>
    mutation
      .mutateAsync(request)
      .then(() => true)
      .catch(() => false);

  return {
    saving: mutation.isPending,
    save: (body: LoanTermsBody) =>
      run(async () => {
        const url = `/wallets/${walletId}/loan-terms`;
        const response = await apiClient.put(url, body satisfies ContractInput<'LoanTermsBody'>);
        return checkContract('LoanTermsState', response.data, url);
      }),
    remove: () =>
      run(async () => {
        await apiClient.delete(`/wallets/${walletId}/loan-terms`);
      }),
  };
}

/** The what-if: nothing is saved, the answer is only shown. */
export function useLoanWhatIf(walletId: string, failedText: string) {
  const mutation = useMutation({
    mutationFn: async (body: ContractInput<'LoanWhatIfBody'>): Promise<LoanWhatIf> => {
      const url = `/wallets/${walletId}/loan-schedule/what-if`;
      const response = await apiClient.post(url, body);
      return checkContract('LoanWhatIf', response.data, url);
    },
    onError: error => toast.error(getApiErrorMessage(error, failedText)),
  });
  return {
    run: (body: ContractInput<'LoanWhatIfBody'>) => mutation.mutate(body),
    result: mutation.data ?? null,
    pending: mutation.isPending,
    reset: mutation.reset,
  };
}

'use client';

import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type BalanceCheckInput = ContractInput<'BalanceCheckBody'>;

/**
 * "Check balance" on one account: compare (writes nothing), remember a match,
 * or book the difference. The server works the difference out itself; only
 * the bank's figure and the day are sent. A failure is said in a toast.
 */
export function useBalanceCheck(walletId: string, failedText: string) {
  const base = `/wallets/${walletId}`;
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, failedText));

  const check = useMutation({
    mutationFn: async (input: BalanceCheckInput) => {
      const url = `${base}/balance-check`;
      const response = await apiClient.post(url, input satisfies BalanceCheckInput);
      return checkContract('BalanceCheckResult', response.data, url);
    },
    onError,
  });
  const confirm = useMutation({
    mutationFn: async (input: BalanceCheckInput) => {
      const url = `${base}/balance-check/confirm`;
      const response = await apiClient.post(url, input satisfies BalanceCheckInput);
      return checkContract('BalanceCheckResult', response.data, url);
    },
    onError,
    onSuccess: () => invalidateFinancialData(),
  });
  const book = useMutation({
    mutationFn: async (input: BalanceCheckInput) => {
      const url = `${base}/balance-adjustment`;
      const response = await apiClient.post(url, input satisfies BalanceCheckInput);
      return checkContract('BalanceAdjustmentResult', response.data, url);
    },
    onError,
    onSettled: () => invalidateFinancialData(),
  });

  return {
    /** Our balance against the bank's; remembered at once when they match. */
    run: async (input: BalanceCheckInput) => {
      const result = await check.mutateAsync(input);
      return result.matches ? confirm.mutateAsync(input) : result;
    },
    book: (input: BalanceCheckInput) => book.mutateAsync(input),
    pending: check.isPending || confirm.isPending,
    booking: book.isPending,
  };
}

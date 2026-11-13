'use client';

import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import api from '@/app/lib/api';
import type { BulkAnnotateResult } from '@/app/lib/contracts';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export interface BulkAnnotateVariables {
  txIds: string[];
  /** Tags to add; the ones a row has stay. */
  tagIds?: string[];
  /** A comment to put after the one each row has. */
  note?: string;
}

const URL = '/transactions/bulk-annotate';

/**
 * Tags and a comment for the ticked rows of a list. invalidateFinancialData
 * refreshes the open list and the By tag figures (the `tags` root is one of
 * them), not only the list the call came from.
 */
export function useBulkAnnotate(): UseMutationResult<
  BulkAnnotateResult,
  Error,
  BulkAnnotateVariables
> {
  return useMutation({
    mutationFn: async ({ txIds, tagIds, note }: BulkAnnotateVariables) => {
      const response = await api.post(URL, {
        ids: txIds,
        ...(tagIds && tagIds.length > 0 ? { addTagIds: tagIds } : {}),
        ...(note ? { note } : {}),
      } satisfies ContractInput<'BulkAnnotateTransactionsBody'>);
      return checkContract('BulkAnnotateResult', response.data, URL);
    },
    onSuccess: () => {
      invalidateFinancialData();
    },
  });
}

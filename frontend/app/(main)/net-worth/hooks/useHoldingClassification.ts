'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { checkBody, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Saves where a holding's money sits and asks the quote source for a share's
 * sector. A save re-reads the holdings and net worth, and the allocation under it.
 */
export function useHoldingClassification(holdingId: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('allocationMix');
  const [looking, setLooking] = useState(false);

  const failed = t.failed.value;
  const saved = t.saved.value;
  const mutation = useMutation({
    // The form builds the body from its own state (plain strings): it is checked against the contract.
    mutationFn: async (input: Record<string, unknown>) => {
      const url = `/investments/holdings/${holdingId}/classification`;
      await apiClient.patch(url, await checkBody('HoldingClassificationBody', input, url));
    },
    onSuccess: async () => {
      toast.success(saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.investments(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
      ]);
    },
    onError: error => toast.error(getApiErrorMessage(error, failed)),
  });

  /** The sector the quote source names for the holding's symbol, or null. Nothing is saved. */
  const suggestSector = useCallback(async () => {
    const url = `/investments/holdings/${holdingId}/sector-suggestion`;
    setLooking(true);
    try {
      const response = await apiClient.get(url);
      return (await checkContract('HoldingSectorSuggestion', response.data, url)).sector;
    } catch (error) {
      toast.error(getApiErrorMessage(error, failed));
      return null;
    } finally {
      setLooking(false);
    }
  }, [holdingId, failed]);

  return {
    save: mutation.mutateAsync,
    saving: mutation.isPending,
    suggestSector,
    looking,
  };
}

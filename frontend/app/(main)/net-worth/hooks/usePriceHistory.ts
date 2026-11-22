'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  HoldingHistoryPoint,
  HoldingPriceHistory,
  ImportClosesResult,
  PriceHealth,
  SecurityClose,
} from '@/app/lib/contracts';

export type CloseInput = ContractInput<'UpsertSecurityCloseBody'>;

/**
 * A holding's history (its chart and how the feed is doing) and the closes
 * the workspace keeps for its symbol. A holding without a symbol has no closes
 * to keep, so they are not asked for. Every change re-reads everything under
 * `investments`: a close moves the chart, the holdings' status and the returns.
 */
export function usePriceHistory(holdingId: string | null, hasSymbol: boolean) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('priceHistory');
  const id = holdingId ?? '';
  const ready = Boolean(workspaceId && holdingId);

  const history = useQuery({
    queryKey: queryKeys.holdingHistory({ workspaceId, holdingId: id }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/investments/holdings/${id}/history`,
        signal,
        contract: 'HoldingPriceHistory',
      }),
    enabled: ready,
  });
  const closes = useQuery({
    queryKey: queryKeys.holdingCloses({ workspaceId, holdingId: id }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/investments/holdings/${id}/closes`,
        signal,
        contract: 'SecurityCloseList',
      }),
    enabled: ready && hasSymbol,
  });

  const failed = t.failed.value;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.investments(workspaceId) });
  const onError = (error: unknown) => toast.error(getApiErrorMessage(error, failed));
  const mutation = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: invalidate,
    onError,
  });
  /** The file's text goes up as it is; the server reads the columns. */
  const importing = useMutation({
    mutationFn: async (csv: string) => {
      const url = `/investments/holdings/${id}/closes/import`;
      const response = await apiClient.post(url, {
        csv,
      } satisfies ContractInput<'ImportSecurityClosesBody'>);
      return checkContract('ImportClosesResult', response.data, url);
    },
    onSuccess: invalidate,
    onError,
  });

  const addClose = useCallback(
    (input: CloseInput) =>
      mutation.mutateAsync(async () => {
        await apiClient.post(`/investments/holdings/${id}/closes`, input);
      }),
    [mutation.mutateAsync, id],
  );
  const deleteClose = useCallback(
    (closeId: string) =>
      mutation.mutateAsync(async () => {
        await apiClient.delete(`/investments/closes/${closeId}`);
      }),
    [mutation.mutateAsync],
  );

  return {
    history: history.data ?? null,
    closes: closes.data ?? [],
    isPending: history.isPending,
    saving: mutation.isPending || importing.isPending,
    addClose,
    deleteClose,
    importCloses: importing.mutateAsync,
  };
}

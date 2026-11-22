'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  CostBasisMethod,
  HoldingLots,
  InvestmentTrade,
  InvestmentTradeKind,
} from '@/app/lib/contracts';

export type TradeInput = ContractInput<'CreateInvestmentTradeBody'>;

/**
 * A holding's trades, the lots they make, and the workspace's cost-basis
 * method. Every change re-reads everything under `investments`: a trade moves
 * the holding's quantity, its account's value, net worth and the returns.
 */
export function useInvestmentTrades(holdingId: string | null) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('investmentTrades');
  const ready = Boolean(workspaceId && holdingId);
  const id = holdingId ?? '';

  const trades = useQuery({
    queryKey: queryKeys.investmentTrades({ workspaceId, holdingId: id }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/investments/holdings/${id}/trades`,
        signal,
        contract: 'InvestmentTradeList',
      }),
    enabled: ready,
  });
  const lots = useQuery({
    queryKey: queryKeys.investmentLots({ workspaceId, holdingId: id }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/investments/holdings/${id}/lots`, signal, contract: 'HoldingLots' }),
    enabled: ready,
  });
  const settings = useQuery({
    queryKey: queryKeys.investmentSettings(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/investments/settings', signal, contract: 'InvestmentSettings' }),
    enabled: Boolean(workspaceId),
  });

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.investments(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
    ]);
  }, [queryClient, workspaceId]);

  const failed = t.failed.value;
  const mutation = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: invalidate,
    // The server says what is wrong (an oversell, a second currency) in words the user can act on.
    onError: error => toast.error(getApiErrorMessage(error, failed)),
  });

  const createTrade = useCallback(
    (input: TradeInput) =>
      mutation.mutateAsync(async () => {
        await apiClient.post(`/investments/holdings/${id}/trades`, input);
      }),
    [mutation.mutateAsync, id],
  );
  const updateTrade = useCallback(
    (tradeId: string, input: ContractInput<'UpdateInvestmentTradeBody'>) =>
      mutation.mutateAsync(async () => {
        await apiClient.patch(`/investments/trades/${tradeId}`, input);
      }),
    [mutation.mutateAsync],
  );
  const deleteTrade = useCallback(
    (tradeId: string) =>
      mutation.mutateAsync(async () => {
        await apiClient.delete(`/investments/trades/${tradeId}`);
      }),
    [mutation.mutateAsync],
  );
  const setBasisMethod = useCallback(
    (basisMethod: 'fifo' | 'average') =>
      mutation.mutateAsync(async () => {
        await apiClient.patch('/investments/settings', {
          basisMethod,
        } satisfies ContractInput<'InvestmentSettingsBody'>);
      }),
    [mutation.mutateAsync],
  );

  return {
    trades: trades.data ?? [],
    lots: lots.data ?? null,
    basisMethod: settings.data?.basisMethod ?? 'fifo',
    isPending: trades.isPending || lots.isPending,
    saving: mutation.isPending,
    createTrade,
    updateTrade,
    deleteTrade,
    setBasisMethod,
  };
}

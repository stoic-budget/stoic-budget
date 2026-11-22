'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

/**
 * The debts a property can be linked to, read while the drawer is open.
 * Under the net worth prefix, so saving a property refreshes both.
 */
export function usePropertyDebts(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  const query = useQuery({
    queryKey: ['net-worth', workspaceId, 'property-debts'],
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/reports/balance/property-debts',
        signal,
        contract: 'PropertyDebtOptions',
      }),
    enabled: Boolean(workspaceId) && enabled,
  });
  return { options: query.data?.options ?? [], isPending: query.isPending };
}

/** Saves a property's details; net worth is read again, since equity and the estimate follow them. */
export function useSaveProperty(failedText: string) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (variables: {
      accountId: string;
      body: ContractInput<'UpdatePropertyBody'>;
    }) => {
      const url = `/reports/balance/accounts/${variables.accountId}/property`;
      const response = await apiClient.put(url, variables.body);
      return checkContract('PropertyDetails', response.data, url);
    },
    onError: error => toast.error(getApiErrorMessage(error, failedText)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] }),
  });
  return {
    saving: mutation.isPending,
    save: (accountId: string, body: ContractInput<'UpdatePropertyBody'>) =>
      mutation
        .mutateAsync({ accountId, body })
        .then(() => true)
        .catch(() => false),
  };
}

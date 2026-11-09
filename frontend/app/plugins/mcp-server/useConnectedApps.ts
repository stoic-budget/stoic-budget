'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { McpOAuthGrantItem } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { McpOAuthGrantItem } from '@/app/lib/contracts';

/** Apps the signed-in person connected to this workspace over OAuth, and disconnecting one. */
export function useConnectedApps() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('mcpServerDrawer');
  const key = queryKeys.mcpOAuthGrants(workspaceId);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/mcp-oauth/grants', signal, contract: 'McpOAuthGrantList' }),
    enabled: Boolean(workspaceId),
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mcp-oauth/grants/${id}`);
    },
    onSuccess: (_response, id) => {
      queryClient.setQueryData<McpOAuthGrantItem[]>(key, previous =>
        (previous ?? []).filter(app => app.id !== id),
      );
      toast.success(t.toasts.appDisconnected.value);
    },
    onError: () => toast.error(t.toasts.disconnectFailed.value),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    apps: query.data ?? [],
    loading: query.isPending && Boolean(workspaceId),
    disconnect: disconnect.mutate,
    disconnecting: disconnect.isPending,
  };
}

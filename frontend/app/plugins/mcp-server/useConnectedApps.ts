'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { McpOAuthGrantItem } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type { McpOAuthGrantItem } from '@/app/lib/contracts';

/** A connected app; `memberName` is set in the workspace-wide list. */
export type ConnectedApp = McpOAuthGrantItem & { memberName?: string };

/**
 * Whether the person sees every member's apps: they manage the workspace's MCP
 * access (owner or admin, who flip the plugin) or its API keys. The server
 * checks the same and refuses everyone else.
 */
export function useManagesMcpAccess(): boolean {
  const { currentWorkspace } = useWorkspace();
  const { hasAnyPermission } = usePermissions();
  const role = currentWorkspace?.memberRole;
  return (
    role === 'owner' ||
    role === 'admin' ||
    hasAnyPermission(['api_key.manage', 'workspace_settings.manage'])
  );
}

/**
 * Apps connected to this workspace over OAuth, and disconnecting one: the
 * person's own, or every member's for whoever manages MCP access.
 */
export function useConnectedApps() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const t = useIntlayer('mcpServerDrawer');
  const workspaceWide = useManagesMcpAccess();
  const base = workspaceWide ? '/mcp-oauth/workspace/grants' : '/mcp-oauth/grants';
  const key = [...queryKeys.mcpOAuthGrants(workspaceId), workspaceWide ? 'workspace' : 'own'];

  const query = useQuery<ConnectedApp[]>({
    queryKey: key,
    queryFn: ({ signal }) =>
      workspaceWide
        ? apiQueryDecoded({ url: base, signal, contract: 'McpOAuthWorkspaceGrantList' })
        : apiQueryDecoded({ url: base, signal, contract: 'McpOAuthGrantList' }),
    enabled: Boolean(workspaceId),
  });

  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${base}/${id}`);
    },
    onSuccess: (_response, id) => {
      queryClient.setQueryData<ConnectedApp[]>(key, previous =>
        (previous ?? []).filter(app => app.id !== id),
      );
      toast.success(t.toasts.appDisconnected.value);
    },
    onError: () => toast.error(t.toasts.disconnectFailed.value),
    // Both lists: a manager's own app sits in each.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpOAuthGrants(workspaceId) }),
  });

  return {
    apps: query.data ?? [],
    workspaceWide,
    loading: query.isPending && Boolean(workspaceId),
    disconnect: disconnect.mutate,
    disconnecting: disconnect.isPending,
  };
}

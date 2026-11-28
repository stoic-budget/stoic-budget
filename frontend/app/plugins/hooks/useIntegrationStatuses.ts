'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntegrationCatalog } from '@/app/integrations/panel/integration-catalog';
import apiClient from '@/app/lib/api';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Different endpoints answer differently: with `connected`, with a `status`
 * string, or — where a workspace may hold several connections — with the list
 * of them.
 */
async function readConnected(statusPath: string): Promise<boolean> {
  return apiClient
    .get(statusPath)
    .then(response => {
      const data = response.data;
      if (Array.isArray(data)) {
        return data.length > 0;
      }
      if (typeof data !== 'object' || data === null) {
        return false;
      }
      return (
        ('connected' in data && data.connected === true) ||
        ('status' in data && String(data.status).toLowerCase() === 'connected')
      );
    })
    .catch(() => false);
}

/** Whether each integration in the catalog is connected, read while the panel is open. */
export function useIntegrationStatuses(enabled: boolean): {
  statuses: Record<string, boolean>;
  refresh: () => void;
} {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const catalog = useIntegrationCatalog();
  const queryKey = queryKeys.integrationCatalogStatuses(workspaceId);

  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(workspaceId),
    queryFn: async () => {
      const entries = catalog.filter(entry => entry.statusPath);
      const pairs = await Promise.all(
        entries.map(
          async entry => [entry.key, await readConnected(entry.statusPath ?? '')] as const,
        ),
      );
      return Object.fromEntries(pairs) as Record<string, boolean>;
    },
  });

  const refresh = useCallback((): void => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { statuses: query.data ?? {}, refresh };
}

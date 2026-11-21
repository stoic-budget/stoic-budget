'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';

import { isDemoInstance } from '@/app/hooks/useDemoStatus';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import api from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

/** The pages that remember themselves; the server keeps the same closed list. */
export type ViewScope =
  | 'transactions'
  | 'review'
  | 'reports'
  | 'dashboard'
  | 'onboarding'
  | 'rules';

/** Long: this is read once on mount and written by the page itself. */
const PREFERENCE_STALE_TIME = 30 * 60 * 1000;

export interface UseViewPreferenceResult<T> {
  /** `undefined` until the saved state has loaded; `null` when nothing was saved or it failed to load. */
  state: T | null | undefined;
  /** The load failed and nothing is cached: `null` above then does not mean "nothing saved". */
  failed: boolean;
  save: (next: T) => void;
  /**
   * The stored state read afresh, for a change that must apply to what another
   * tab may have saved since this one loaded. Rejects when the read fails.
   */
  latest: () => Promise<T | null>;
}

/**
 * How this person left this page last time.
 *
 * Writes are fire-and-forget and the local cache is updated first: nobody
 * should wait on a round trip to change a filter, and a failed save is worth no
 * more than losing the preference.
 *
 * The server keeps whatever the page saved, so `read` turns that into the
 * page's own shape key by key; keep it a module-level function.
 */
export function useViewPreference<T extends Record<string, unknown>>(
  scope: ViewScope,
  read: (saved: Readonly<Record<string, unknown>>) => T,
): UseViewPreferenceResult<T> {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const queryKey = ['view-preferences', workspaceId, scope] as const;
  // Written on every filter change; a ref keeps the latest without re-rendering.
  const pending = useRef<T | null>(null);

  const queryFn = ({ signal }: { signal: AbortSignal }) =>
    apiQueryDecoded({
      url: `/view-preferences/${scope}`,
      signal,
      contract: 'ViewPreferenceState',
    });

  const { data, isError } = useQuery({
    queryKey,
    queryFn,
    staleTime: PREFERENCE_STALE_TIME,
    enabled: Boolean(workspaceId),
  });

  const save = useCallback(
    (next: T) => {
      pending.current = next;
      queryClient.setQueryData(queryKey, { state: next });
      // A demo account is shared: the layout holds for this visit (until the page
      // reloads); the server is not asked.
      if (isDemoInstance()) {
        return;
      }
      void api
        .put(`/view-preferences/${scope}`, {
          state: next,
        } satisfies ContractInput<'ViewPreferenceBody'>)
        .catch(() => {
          // A preference that failed to stick is not worth a toast.
        });
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey is derived from the two below
    [queryClient, scope, workspaceId],
  );

  const state = useMemo(
    () =>
      data === undefined
        ? isError
          ? null
          : undefined
        : data.state === null
          ? null
          : read(data.state),
    [data, isError, read],
  );

  const latest = useCallback(
    async () => {
      const fresh = await queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0 });
      return fresh.state === null ? null : read(fresh.state);
    },
    // biome-ignore lint/correctness/useExhaustiveDependencies: queryKey and queryFn are derived from scope and workspaceId
    [queryClient, scope, workspaceId, read],
  );

  return { state, failed: data === undefined && isError, save, latest };
}

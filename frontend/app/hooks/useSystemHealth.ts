'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useAuth } from '@/app/hooks/useAuth';
import { getApiErrorStatus } from '@/app/lib/api-error';
import type { AdminSystemHealth } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** Once a minute is enough for "the worker stopped"; React Query skips the tick while the tab is hidden. */
export const SYSTEM_HEALTH_POLL_MS = 60_000;

/**
 * The check itself failed on the server (5xx) or never came back. Signing in
 * reads the user from the database, so with the database down this is all the
 * admin gets; React Query keeps the last good answer, which would say "healthy".
 * A 401 or 403 is about the session, not the server; a contract drift is ours.
 */
const serverFailed = (error: unknown): boolean => {
  if (!isAxiosError(error)) return false;
  const status = getApiErrorStatus(error);
  return status === undefined || status >= 500;
};

/**
 * The server's health, for its instance admins only: nobody else asks (the
 * endpoint would refuse them anyway). The browser's own address goes along, so
 * the server can say whether APP_URL is the address the app is opened at.
 */
export function useSystemHealth(): {
  isAdmin: boolean;
  health: AdminSystemHealth | undefined;
  isPending: boolean;
  isError: boolean;
  unanswered: boolean;
} {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const query = useQuery({
    queryKey: queryKeys.systemHealth(),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/system/health',
        params: { origin: window.location.origin } satisfies ContractInput<'SystemHealthQuery'>,
        signal,
        contract: 'AdminSystemHealth',
      }),
    enabled: isAdmin,
    staleTime: SYSTEM_HEALTH_POLL_MS / 2,
    refetchInterval: SYSTEM_HEALTH_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  return {
    isAdmin,
    health: query.data,
    isPending: query.isPending,
    isError: query.isError,
    unanswered: query.isError && serverFailed(query.error),
  };
}

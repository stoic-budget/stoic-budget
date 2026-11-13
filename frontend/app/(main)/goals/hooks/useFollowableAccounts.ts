'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { GoalAccount } from '@/app/lib/contracts';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { type FollowableAccount, followableAccounts } from '../lib/goal-account';

/** As long as the member list, which rarely changes, is good for elsewhere. */
const MEMBERS_STALE_TIME = 5 * 60 * 1000;

/**
 * The accounts the goal form offers to follow; read only while the form is open.
 * Until the member list has answered (or when it fails) the household is
 * assumed: only shared accounts are offered, never someone else's own.
 */
export function useFollowableAccounts(
  enabled: boolean,
  current: GoalAccount | null,
): FollowableAccount[] {
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const ready = Boolean(workspaceId) && enabled;
  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: ready,
  });
  // The same request and key as the household member list elsewhere.
  const workspace = useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: `/workspaces/${workspaceId}`, signal, contract: 'WorkspaceDetail' }),
    enabled: ready,
    staleTime: MEMBERS_STALE_TIME,
  });
  const members = workspace.data?.members;
  const household = members === undefined || members.length > 1;
  const self = members?.find(member => member.id === user?.id)?.memberId ?? null;
  return followableAccounts(accounts.data ?? [], self, household, current);
}

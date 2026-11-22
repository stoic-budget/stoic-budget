'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The workspace's rule folders, in their order. */
export function useRuleFolders() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.categorizationRuleGroups(workspaceId),
    queryFn: ({ signal }) =>
      apiClient
        .get('/categorization-rule-groups', { signal })
        .then(response =>
          checkContract('RuleGroupList', response.data, '/categorization-rule-groups'),
        )
        .then(list => list.data),
    enabled: Boolean(workspaceId),
  });
}

/** Refreshes the folders and the rules (a deleted folder empties into the list). */
function useRefresh() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.categorizationRuleGroups(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categorizationRules(workspaceId) }),
    ]);
}

/** Makes a folder, or renames one when given its id. */
export function useSaveRuleFolder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string | null; name: string }) => {
      const body = { name } satisfies ContractInput<'CreateRuleGroupBody'>;
      await (id
        ? apiClient.put(`/categorization-rule-groups/${id}`, body)
        : apiClient.post('/categorization-rule-groups', body));
    },
    onSuccess: refresh,
  });
}

/** Deletes a folder; its rules stay, outside any folder. */
export function useDeleteRuleFolder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categorization-rule-groups/${id}`);
    },
    onSuccess: refresh,
  });
}

/** Puts a rule in a folder, or takes it out of every folder with `null`. */
export function useMoveRuleToFolder() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async ({ ruleId, groupId }: { ruleId: string; groupId: string | null }) => {
      await apiClient.put(`/categorization-rules/${ruleId}`, {
        groupId,
      } satisfies ContractInput<'UpdateCategorizationRuleBody'>);
    },
    onSuccess: refresh,
  });
}

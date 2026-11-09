'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type { RulePack } from '@/app/lib/contracts';
import { type ContractInput, checkBody, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/** The most a pack file may weigh: what the API accepts in one request. */
export const PACK_MAX_BYTES = 1024 * 1024;

/** The rules as a pack, saved as a file named after today. */
export function useExportRulePack() {
  return useMutation({
    mutationFn: async (ruleIds: string[]) => {
      const response = await apiClient.post('/categorization-rule-packs/export', {
        ruleIds,
      } satisfies ContractInput<'ExportRulePackBody'>);
      const pack = await checkContract(
        'RulePack',
        response.data,
        '/categorization-rule-packs/export',
      );
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rules-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
  });
}

/**
 * The pack a chosen file holds, or why it holds none: too large, not JSON, or
 * not shaped as a pack. The server checks the shape again before using it.
 */
export async function readPackFile(file: File): Promise<RulePack | 'tooBig' | 'notPack'> {
  if (file.size > PACK_MAX_BYTES) {
    return 'tooBig';
  }
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const shaped =
      typeof parsed === 'object' &&
      parsed !== null &&
      'kind' in parsed &&
      parsed.kind === 'categorization-rules' &&
      'rules' in parsed &&
      Array.isArray(parsed.rules);
    if (!shaped) {
      return 'notPack';
    }
    // Outside production the whole shape is checked here too; the server always checks it.
    const body = await checkBody(
      'ImportRulePackBody',
      { pack: parsed, createMissing: false },
      'pack',
    );
    return body.pack as RulePack;
  } catch {
    return 'notPack';
  }
}

/** What importing the pack would do. Writes nothing. */
export function useRulePackPreview() {
  return useMutation({
    mutationFn: (body: { pack: RulePack; createMissing: boolean }) =>
      apiClient
        .post(
          '/categorization-rule-packs/preview',
          body satisfies ContractInput<'ImportRulePackBody'>,
        )
        .then(response =>
          checkContract('RulePackPreview', response.data, '/categorization-rule-packs/preview'),
        ),
  });
}

/** Imports the pack; the rules, folders, categories and tags it made show up. */
export function useImportRulePack() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { pack: RulePack; createMissing: boolean }) =>
      apiClient
        .post(
          '/categorization-rule-packs/import',
          body satisfies ContractInput<'ImportRulePackBody'>,
        )
        .then(response =>
          checkContract('RulePackImportResult', response.data, '/categorization-rule-packs/import'),
        ),
    onSuccess: () =>
      Promise.all(
        [
          queryKeys.categorizationRules(workspaceId),
          queryKeys.categorizationRuleGroups(workspaceId),
          queryKeys.categories(workspaceId),
          queryKeys.tags(workspaceId),
          ['payees'],
        ].map(queryKey => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

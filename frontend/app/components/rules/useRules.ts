'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import type { CategorizationRuleList } from '@/app/lib/contracts';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import {
  isGroup,
  NUMBER_FIELDS,
  type Rule,
  type RuleCondition,
  type RuleDraftBody,
  type RuleMatchMode,
  type RuleNode,
  VALUELESS_OPERATORS,
  valuesOf,
} from './types';

/** How long the preview waits for typing to stop before asking the server. */
const PREVIEW_DEBOUNCE_MS = 400;

/** Every rule of the workspace, in the order they are tried. */
export function useRulesList() {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.categorizationRules(workspaceId),
    // Not apiQueryDecoded: it would unwrap `data` and drop the total.
    queryFn: ({ signal }) =>
      apiClient
        .get('/categorization-rules', { signal })
        .then(response =>
          checkContract('CategorizationRuleList', response.data, '/categorization-rules'),
        ),
    enabled: Boolean(workspaceId),
  });
}

/** One rule, for its editor page. */
export function useRule(id: string | null) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.categorizationRule(workspaceId, id ?? ''),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/categorization-rules/${id}`,
        signal,
        contract: 'CategorizationRule',
      }),
    enabled: Boolean(workspaceId && id),
  });
}

/**
 * Puts the rules in a new order, first one on top. The list moves at once;
 * a refusal (another member changed the rules meanwhile) puts it back.
 */
export function useReorderRules() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const key = queryKeys.categorizationRules(workspaceId);
  return useMutation({
    mutationFn: (rules: Rule[]) =>
      apiClient
        .put('/categorization-rules/order', {
          ids: rules.map(rule => rule.id),
        } satisfies ContractInput<'ReorderCategorizationRulesBody'>)
        .then(response =>
          checkContract('CategorizationRuleList', response.data, '/categorization-rules/order'),
        ),
    onMutate: async rules => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CategorizationRuleList>(key);
      queryClient.setQueryData<CategorizationRuleList>(key, { data: rules, total: rules.length });
      return { previous };
    },
    onError: (_error, _rules, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Payees filed under the same category by hand again and again: rules worth adding. */
export function useRuleSuggestions(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.categorizationRuleSuggestions(workspaceId),
    // Not apiQueryDecoded: it unwraps `data` while its type keeps the envelope.
    queryFn: ({ signal }) =>
      apiClient
        .get('/categorization-rules/suggestions', { signal })
        .then(response =>
          checkContract(
            'CategorizationRuleSuggestionList',
            response.data,
            '/categorization-rules/suggestions',
          ),
        )
        .then(list => list.data),
    enabled: enabled && Boolean(workspaceId),
  });
}

/** The categories and accounts a rule can name. */
export function useRuleTargets() {
  const workspaceId = useWorkspaceId();
  const categories = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(workspaceId),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  return { categories: categories.data ?? [], wallets: wallets.data ?? [] };
}

function useInvalidateRules() {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.categorizationRules(workspaceId) }),
    [queryClient, workspaceId],
  );
}

export function useSaveRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: RuleDraftBody }) =>
      (id
        ? apiClient.put(
            `/categorization-rules/${id}`,
            body satisfies ContractInput<'UpdateCategorizationRuleBody'>,
          )
        : apiClient.post(
            '/categorization-rules',
            body satisfies ContractInput<'CreateCategorizationRuleBody'>,
          )
      ).then(response =>
        checkContract('CategorizationRule', response.data, '/categorization-rules'),
      ),
    onSuccess: invalidate,
  });
}

export function useToggleRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiClient.put(`/categorization-rules/${id}`, {
        isActive,
      } satisfies ContractInput<'UpdateCategorizationRuleBody'>);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteRule() {
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/categorization-rules/${id}`);
    },
    onSuccess: invalidate,
  });
}

/** Files, tags and moves the rule's existing matches; every figure built from them moves. */
export function useApplyRule() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post(`/categorization-rules/${id}/apply`)
        .then(response =>
          checkContract(
            'CategorizationRuleApplyResult',
            response.data,
            '/categorization-rules/:id/apply',
          ),
        ),
    onSuccess: invalidateFinancialData,
  });
}

/**
 * Conditions the server would accept, as it stores them: a value in every row
 * (blank ones of a list dropped, one left alone a plain value), numbers as
 * numbers, both ends of a range, no value for a blank check, and no group left
 * without a condition.
 */
export function completeConditions(conditions: RuleNode[]): RuleNode[] {
  return conditions.flatMap((node): RuleNode[] => {
    if (!isGroup(node)) {
      return completeCondition(node);
    }
    const inner = node.conditions.flatMap(completeCondition);
    return inner.length > 0 ? [{ matchMode: node.matchMode, conditions: inner }] : [];
  });
}

function completeCondition(condition: RuleCondition): RuleCondition[] {
  if (VALUELESS_OPERATORS.includes(condition.operator)) {
    return [{ field: condition.field, operator: condition.operator, value: '' }];
  }
  const values = valuesOf(condition).filter(value => value.trim() !== '');
  if (values.length === 0) {
    return [];
  }
  if (NUMBER_FIELDS.includes(condition.field)) {
    const { valueTo, ...rest } = condition;
    const range = condition.operator === 'between';
    if (range && valueTo === undefined) {
      return [];
    }
    return [{ ...rest, value: Number(values[0]), ...(range ? { valueTo } : {}) }];
  }
  return [{ ...condition, value: values.length === 1 ? values[0] : values }];
}

/** What a rule would match today: `POST /categorization-rules/test`. */
export function previewRule(
  body: ContractInput<'TestCategorizationRuleBody'>,
  signal?: AbortSignal,
) {
  return apiClient
    .post('/categorization-rules/test', body, { signal })
    .then(response =>
      checkContract('CategorizationRuleTestResult', response.data, '/categorization-rules/test'),
    );
}

/**
 * What the conditions match among the workspace's rows, a moment after typing
 * stops. `ruleId` is the saved rule being edited: rows a rule above it takes
 * come back marked. `walletId` is the account the draft sets: the answer says
 * how many matches would move there. `matchMode` is how the conditions combine.
 */
export function useRulePreview(
  conditions: RuleNode[],
  ruleId: string | null,
  walletId: string | null = null,
  matchMode: RuleMatchMode = 'all',
) {
  const workspaceId = useWorkspaceId();
  const complete = completeConditions(conditions);
  const serialized = JSON.stringify(complete);
  const [settled, setSettled] = useState(serialized);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(serialized), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [serialized]);
  const settledConditions = JSON.parse(settled) as RuleNode[];

  return useQuery({
    queryKey: queryKeys.categorizationRulePreview(
      workspaceId,
      { conditions: settledConditions, matchMode },
      ruleId,
      walletId,
    ),
    queryFn: ({ signal }) =>
      previewRule(
        {
          conditions: settledConditions,
          ...(matchMode === 'any' ? { matchMode } : {}),
          ...(ruleId ? { ruleId } : {}),
          ...(walletId ? { walletId } : {}),
        },
        signal,
      ),
    enabled: Boolean(workspaceId) && settledConditions.length > 0,
    placeholderData: previous => previous,
  });
}

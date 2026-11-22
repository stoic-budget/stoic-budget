'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import type { PaycheckPlanResponse } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export type {
  PaycheckItem,
  PaycheckPeriod,
  PaycheckPlanResponse,
  PaycheckStream,
} from '@/app/lib/contracts';

/** The contract's bound on the buffer. */
export const MAX_BUFFER = 1e12;

/** What the person chose; null = the server's default (main payer, every spending account). */
export type PaycheckChoices = {
  streams: string[] | null;
  walletIds: string[] | null;
  buffer: number;
};

const DEFAULT_CHOICES: PaycheckChoices = { streams: null, walletIds: null, buffer: 0 };

const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every(item => typeof item === 'string') ? value : null;

function readChoices(saved: Readonly<Record<string, unknown>>): PaycheckChoices {
  const buffer = saved.buffer;
  return {
    streams: idList(saved.streams),
    walletIds: idList(saved.walletIds),
    buffer:
      typeof buffer === 'number' && Number.isFinite(buffer) && buffer >= 0 && buffer <= MAX_BUFFER
        ? buffer
        : 0,
  };
}

/** Toggles `id` in the list of selected ids. */
const toggled = (selected: string[], id: string): string[] =>
  selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];

/**
 * The paycheck planner on the forecast page: the plan for the person's
 * choices, which are remembered per person (`/view-preferences/forecast`).
 */
export function usePaycheckPlan() {
  const workspaceId = useWorkspaceId();
  const { state, save } = useViewPreference('forecast', readChoices);
  const choices = state ?? DEFAULT_CHOICES;

  const params = useMemo(
    () =>
      ({
        // An empty choice is sent as a stream no one has: "no payer, use the month".
        ...(choices.streams
          ? { streams: choices.streams.length > 0 ? choices.streams.join(',') : 'none' }
          : {}),
        ...(choices.walletIds?.length ? { walletIds: choices.walletIds.join(',') } : {}),
        ...(choices.buffer > 0 ? { buffer: choices.buffer } : {}),
      }) satisfies ContractInput<'PaycheckPlanQuery'>,
    [choices],
  );

  const query = useQuery({
    queryKey: queryKeys.paycheckPlan({ workspaceId, params: JSON.stringify(params) }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/forecast/paychecks',
        params,
        signal,
        contract: 'PaycheckPlanResponse',
      }),
    // Wait for the saved choices, so the first answer is already the right one.
    enabled: Boolean(workspaceId) && state !== undefined,
    placeholderData: previous => previous,
  });
  const data: PaycheckPlanResponse | null = query.data ?? null;

  // Toggles start from what the answer shows as selected, so what is sent is what was seen.
  const toggleStream = useCallback(
    (id: string) => {
      const selected = (data?.streams ?? []).filter(item => item.selected).map(item => item.id);
      save({ ...choices, streams: toggled(selected, id) });
    },
    [choices, data, save],
  );

  const toggleWallet = useCallback(
    (id: string) => {
      const selected = (data?.accounts ?? []).filter(item => item.selected).map(item => item.id);
      const next = toggled(selected, id);
      // No account at all would be no cash at all; the last one stays.
      if (next.length === 0) return;
      const all = next.length === (data?.accounts.length ?? 0);
      save({ ...choices, walletIds: all ? null : next });
    },
    [choices, data, save],
  );

  const setBuffer = useCallback((buffer: number) => save({ ...choices, buffer }), [choices, save]);

  return {
    data,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    buffer: choices.buffer,
    toggleStream,
    toggleWallet,
    setBuffer,
  };
}

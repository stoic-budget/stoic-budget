'use client';

import { useState } from 'react';
import type { StatementFilterDate } from '@/app/(main)/statements/components/filters/statement-filters';
import {
  buildDateModes,
  buildDatePresets,
  buildFilterLabels,
  type buildFilterOptionLabels,
} from '@/app/(main)/statements/components/StatementsListView.utils';
import { useClearAsOf } from '@/app/hooks/useClearAsOf';
import { dateFilterToRange } from '../lib/review-inbox-model';
import type { UseReviewInboxResult } from './useReviewInbox';

type Options = ReturnType<typeof buildFilterOptionLabels>;
type StatementsText = Parameters<typeof buildFilterLabels>[0];

/**
 * The Review page's Date dropdown: the statements one, so both pages filter by
 * date the same way. Picking a date leaves the dashboard month a link opened
 * the page on, so the strip naming that month goes with it.
 */
export function useReviewDateFilter(
  state: Pick<UseReviewInboxResult, 'initialDateFilter' | 'setFrom' | 'setTo'>,
  options: Options,
  statementsText: StatementsText,
) {
  const clearAsOf = useClearAsOf();
  const datePresets = buildDatePresets(options);
  const dateModes = buildDateModes(options);
  const [dateOpen, setDateOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState<StatementFilterDate | null>(state.initialDateFilter);
  const [dateApplied, setDateApplied] = useState<StatementFilterDate | null>(
    state.initialDateFilter,
  );
  // A link's month read again once the workspace's month rule loaded.
  const [seenInitial, setSeenInitial] = useState(state.initialDateFilter);
  if (seenInitial !== state.initialDateFilter) {
    setSeenInitial(state.initialDateFilter);
    setDateDraft(state.initialDateFilter);
    setDateApplied(state.initialDateFilter);
  }

  const applyDate = (next: StatementFilterDate | null): void => {
    const range = dateFilterToRange(next, new Date());
    setDateDraft(next);
    setDateApplied(next);
    state.setFrom(range.from);
    state.setTo(range.to);
    setDateOpen(false);
    clearAsOf();
  };
  const dateLabel =
    (dateApplied?.preset && datePresets.find(o => o.value === dateApplied.preset)?.label) ||
    (dateApplied?.mode && dateModes.find(o => o.value === dateApplied.mode)?.label) ||
    buildFilterLabels(statementsText).date;

  return {
    datePresets,
    dateModes,
    dateOpen,
    setDateOpen,
    dateDraft,
    setDateDraft,
    dateApplied,
    applyDate,
    dateLabel,
  };
}

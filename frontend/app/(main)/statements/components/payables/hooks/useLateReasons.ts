'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { LATE_REASONS, type LateReason, lateReasonsApi } from '@/app/lib/late-reasons-api';
import type { Payable } from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';

/** The six reasons in the reader's language, in the order the question lists them. */
export function useLateReasonLabels(): Array<{ value: LateReason; label: string }> {
  const t = useIntlayer('lateReasons');
  return LATE_REASONS.map(value => ({ value, label: t[value].value }));
}

/** The year's late bills by reason; kept under the list's key, so a list reload reads it too. */
export function useLatePaymentsSummary(enabled: boolean) {
  const workspaceId = useWorkspaceId();
  return useQuery({
    queryKey: [...queryKeys.payablesList(workspaceId), 'late-summary'],
    queryFn: () => lateReasonsApi.summary(),
    enabled: enabled && Boolean(workspaceId),
    staleTime: 0,
  });
}

/** The "Why was it late?" dialog: which bill it is open on, and saving its answer. */
export function useLateReasonEditor(reload: () => Promise<unknown>) {
  const t = useIntlayer('lateReasons');
  const [editing, setEditing] = useState<Payable | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (reason: LateReason | null, note: string): Promise<void> => {
    if (!editing) return;
    setSaving(true);
    try {
      await lateReasonsApi.set(editing.id, reason, note);
      toast.success(t.saved.value);
      setEditing(null);
      await reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.failed.value));
    } finally {
      setSaving(false);
    }
  };

  return { editing, open: setEditing, close: () => setEditing(null), save, saving };
}

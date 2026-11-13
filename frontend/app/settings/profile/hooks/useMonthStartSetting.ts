'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { usePayPeriods } from '@/app/hooks/usePayPeriods';
import apiClient from '@/app/lib/api';
import type { MonthStartSetting, PayPeriodsResponse } from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { getApiErrorMessage } from '@/app/settings/profile/profileHelpers';

export type UseMonthStartSettingReturn = {
  /** The rule as saved, with the detected salary and holidays the preview needs. */
  data: PayPeriodsResponse | undefined;
  saving: boolean;
  error: string | null;
  saved: boolean;
  save: (monthStart: MonthStartSetting) => Promise<void>;
};

/**
 * Reads and saves the day the workspace's month starts. A change moves every
 * month total in the app, so everything cached is read again after it.
 */
export function useMonthStartSetting(saveErrorText: string): UseMonthStartSettingReturn {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { data } = usePayPeriods();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const workspaceId = currentWorkspace?.id;

  const save = useCallback(
    async (monthStart: MonthStartSetting) => {
      if (!workspaceId) return;
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        await apiClient.patch(`/workspaces/${workspaceId}`, {
          monthStart,
        } satisfies ContractInput<'UpdateWorkspaceBody'>);
        setSaved(true);
        await Promise.all([queryClient.invalidateQueries(), refreshWorkspaces()]);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, saveErrorText));
      } finally {
        setSaving(false);
      }
    },
    [workspaceId, queryClient, refreshWorkspaces, saveErrorText],
  );

  return { data, saving, error, saved, save };
}

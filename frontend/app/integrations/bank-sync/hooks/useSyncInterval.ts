import { useCallback } from 'react';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { BANK_SYNC_BASE } from '../types';

/** Saves how often auto-sync pulls one connection; the caller reloads the list. */
export function useSyncInterval(): (connectionId: string, hours: number) => Promise<void> {
  return useCallback(async (connectionId, hours) => {
    await apiClient.patch(`${BANK_SYNC_BASE}/connections/${connectionId}`, {
      syncIntervalHours: hours,
    } satisfies ContractInput<'UpdateBankSyncConnectionBody'>);
  }, []);
}

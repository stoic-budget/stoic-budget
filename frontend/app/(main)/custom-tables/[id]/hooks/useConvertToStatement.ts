'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { ConvertResult } from '../components/SendToStatementsDialog';

interface ConvertState {
  open: boolean;
  busy: boolean;
  result: ConvertResult | null;
}

export function useConvertToStatement(tableId: string, failedMessage: string) {
  const [convert, setConvert] = useState<ConvertState>({ open: false, busy: false, result: null });
  const runConvert = useCallback(async () => {
    setConvert(prev => ({ ...prev, busy: true }));
    await (async () => {
      const response = await apiClient.post(`/custom-tables/${tableId}/convert-to-statement`);
      const payload = await checkContract(
        'ConvertedToStatement',
        response.data,
        '/custom-tables/:id/convert-to-statement',
      );
      setConvert({ open: true, busy: false, result: payload });
    })().catch(async error => {
      console.error('Failed to convert table:', error);
      toast.error(getApiErrorMessage(error, failedMessage));
      setConvert(prev => ({ ...prev, busy: false }));
    });
  }, [tableId, failedMessage]);
  return { convert, setConvert, runConvert };
}

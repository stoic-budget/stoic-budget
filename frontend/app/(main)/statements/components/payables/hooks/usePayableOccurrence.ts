'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type Payable, payablesApi } from '@/app/lib/payables-api';

export type OccurrenceAction = 'skip' | 'move' | 'amount';

/**
 * One occurrence of a repeating bill: skipped at once, or moved or given an
 * amount of its own through a small dialog. The list is read again after.
 */
export function usePayableOccurrence(reload: () => Promise<unknown>) {
  const t = useIntlayer('payableRecurrence');
  const [editing, setEditing] = useState<{ payable: Payable; action: 'move' | 'amount' } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const send = async (
    payable: Payable,
    body: Parameters<typeof payablesApi.changeOccurrence>[1],
  ) => {
    setSaving(true);
    try {
      await payablesApi.changeOccurrence(payable.id, body);
      toast.success(body.action === 'skip' ? t.skippedToast.value : t.savedToast.value);
      setEditing(null);
      await reload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t.failedToast.value));
    } finally {
      setSaving(false);
    }
  };

  const start = (payable: Payable, action: OccurrenceAction): void => {
    if (action === 'skip') {
      void send(payable, { action: 'skip' });
      return;
    }
    setEditing({ payable, action });
  };

  return {
    editing,
    saving,
    start,
    close: () => setEditing(null),
    move: (dueDate: string) => editing && send(editing.payable, { action: 'move', dueDate }),
    setAmount: (amount: number) => editing && send(editing.payable, { action: 'amount', amount }),
  };
}

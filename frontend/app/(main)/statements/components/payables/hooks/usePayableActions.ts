'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { getApiErrorMessage } from '@/app/lib/api-error';
import {
  type CreatePayableInput,
  type Payable,
  type PayableDirection,
  payablesApi,
  type UpdatePayableInput,
} from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';
import type { MarkPaidResult } from '../MarkPaidDialog';
import type { PayablesLabels } from './usePayablesLabels';

/** Everything a row or the form can do, with the busy state each action shows. */
export function usePayableActions({
  direction,
  reload,
  toasts,
}: {
  direction: PayableDirection;
  /** Reads the list again without the loading skeleton. */
  reload: () => Promise<unknown>;
  toasts: PayablesLabels['toasts'];
}) {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [removingPaymentId, setRemovingPaymentId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // One per opened form: saving it again after a lost answer books the money once.
  const createKey = useRef<string | undefined>(undefined);

  const openCreateDrawer = (): void => {
    createKey.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    setEditingPayable(null);
    setDrawerOpen(true);
  };
  const handleEdit = async (payable: Payable): Promise<void> => {
    await (async () => {
      const fresh = await payablesApi.getOne(payable.id);
      setEditingPayable(fresh);
      setDrawerOpen(true);
    })().catch(async error => {
      toast.error(getApiErrorMessage(error, toasts.loadFailed));
    });
  };

  const handleSave = async (payload: CreatePayableInput | UpdatePayableInput): Promise<void> => {
    setSaving(true);

    await (async () => {
      if (editingPayable) {
        await payablesApi.update(editingPayable.id, payload as UpdatePayableInput);
        toast.success(toasts.updateSuccess);
      } else {
        await payablesApi.create(
          { ...(payload as CreatePayableInput), direction },
          createKey.current,
        );
        toast.success(toasts.createSuccess);
      }

      setDrawerOpen(false);
      setEditingPayable(null);
      await reload();
    })()
      .catch(async error => {
        toast.error(
          getApiErrorMessage(error, editingPayable ? toasts.updateFailed : toasts.createFailed),
        );
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleMarkPaid = async (payable: Payable): Promise<void> => {
    setPayingPayable(payable);
  };

  const confirmMarkPaid = async (payable: Payable, result: MarkPaidResult): Promise<void> => {
    setMarkingPaidId(payable.id);

    await (async () => {
      const updated =
        result.kind === 'full'
          ? await payablesApi.markAsPaid(payable.id, result.payload)
          : result.kind === 'book'
            ? await payablesApi.bookPayment(payable.id, result.paymentId, result.payload)
            : await payablesApi.addPayment(payable.id, result.payload);
      // A bill that is still short keeps the dialog open on its new outstanding
      // amount: instalments arrive one after another.
      setPayingPayable(updated.status === 'partially_paid' ? updated : null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
      });
      toast.success(toasts.markPaidSuccess);
      await reload();
    })()
      .catch(async error => {
        // The payment refusals are coded, so they read in the user's language.
        toast.error(getApiErrorMessage(error, toasts.markPaidFailed));
      })
      .finally(async () => {
        setMarkingPaidId(null);
      });
  };

  const removePayment = async (payable: Payable, paymentId: string): Promise<void> => {
    setRemovingPaymentId(paymentId);

    await (async () => {
      const updated = await payablesApi.removePayment(payable.id, paymentId);
      setPayingPayable(updated);
      queryClient.invalidateQueries({
        queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
      });
      await reload();
    })()
      .catch(async error => {
        toast.error(getApiErrorMessage(error, toasts.markPaidFailed));
      })
      .finally(async () => {
        setRemovingPaymentId(null);
      });
  };

  const handleArchive = async (payable: Payable): Promise<void> => {
    setArchivingId(payable.id);

    await (async () => {
      await payablesApi.archive(payable.id);
      toast.success(toasts.archiveSuccess);
      await reload();
    })()
      .catch(async error => {
        toast.error(getApiErrorMessage(error, toasts.archiveFailed));
      })
      .finally(async () => {
        setArchivingId(null);
      });
  };

  const handleDelete = async (payable: Payable): Promise<void> => {
    const confirmMessage = toasts.deleteConfirm.replace('{vendor}', payable.vendor);
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingId(payable.id);

    await (async () => {
      await payablesApi.delete(payable.id);
      toast.success(toasts.deleteSuccess);
      await reload();
    })()
      .catch(async error => {
        toast.error(getApiErrorMessage(error, toasts.deleteFailed));
      })
      .finally(async () => {
        setDeletingId(null);
      });
  };

  const closeDrawer = (): void => {
    setDrawerOpen(false);
    setEditingPayable(null);
  };

  return {
    drawerOpen,
    editingPayable,
    saving,
    markingPaidId,
    payingPayable,
    setPayingPayable,
    removingPaymentId,
    archivingId,
    deletingId,
    openCreateDrawer,
    closeDrawer,
    handleEdit,
    handleSave,
    handleMarkPaid,
    confirmMarkPaid,
    removePayment,
    handleArchive,
    handleDelete,
  };
}

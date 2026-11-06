'use client';

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { EditableReceiptParsedData } from '@/app/components/receipts/receipt-types';
import { useIntlayer } from '@/app/i18n';
import apiClient, { type ReceiptRecord } from '@/app/lib/api';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { buildInitialForm, buildParsedDataPayload } from '../receipt-form';

/** Saves form edits a moment after the last keystroke, skipping what is already saved. */
export function useReceiptAutosave(
  receipt: ReceiptRecord | null,
  setReceipt: Dispatch<SetStateAction<ReceiptRecord | null>>,
  setFormValue: (value: EditableReceiptParsedData) => void,
) {
  const t = useIntlayer('receiptDocumentPage');
  const lastSavedPayloadRef = useRef<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!receipt) {
      lastSavedPayloadRef.current = null;
      return;
    }

    lastSavedPayloadRef.current = JSON.stringify(buildParsedDataPayload(buildInitialForm(receipt)));
  }, [receipt]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const persistParsedData = useCallback(
    async (nextValue: EditableReceiptParsedData) => {
      if (!receipt) {
        return;
      }

      const nextPayload = buildParsedDataPayload(nextValue);
      const serializedPayload = JSON.stringify(nextPayload);

      if (serializedPayload === lastSavedPayloadRef.current) {
        return;
      }

      await (async () => {
        await apiClient.patch(`/receipts/${receipt.id}`, {
          parsedData: nextPayload,
        } satisfies ContractInput<'UpdateReceiptBody'>);
        lastSavedPayloadRef.current = serializedPayload;
        invalidateDocumentLists();
        setReceipt(currentReceipt =>
          currentReceipt
            ? {
                ...currentReceipt,
                parsedData: {
                  ...currentReceipt.parsedData,
                  ...nextPayload,
                },
              }
            : currentReceipt,
        );
      })().catch(async () => {
        toast.error(t.autosaveFailed.value);
      });
    },
    [receipt, setReceipt, t],
  );

  const handleFormChange = useCallback(
    (nextValue: EditableReceiptParsedData) => {
      setFormValue(nextValue);

      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }

      autosaveTimeoutRef.current = setTimeout(() => {
        void persistParsedData(nextValue);
      }, 250);
    },
    [persistParsedData, setFormValue],
  );

  return { handleFormChange, lastSavedPayloadRef };
}

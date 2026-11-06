'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type {
  EditableReceiptParsedData,
  ReceiptCategoryOption,
} from '@/app/components/receipts/receipt-types';
import { useIntlayer } from '@/app/i18n';
import type { ReceiptRecord } from '@/app/lib/api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { buildInitialForm } from '../receipt-form';

/** The receipt, its categories and the form filled from them. */
export function useReceiptDocument(receiptId: string) {
  const t = useIntlayer('receiptDocumentPage');
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [categories, setCategories] = useState<ReceiptCategoryOption[]>([]);
  const [formValue, setFormValue] = useState<EditableReceiptParsedData>(buildInitialForm(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    await (async () => {
      setLoading(true);
      setError(null);

      const [nextReceipt, nextCategories] = await Promise.all([
        apiQueryDecoded({ url: `/receipts/${receiptId}`, contract: 'ReceiptRecord' }),
        apiQueryDecoded({ url: '/categories', contract: 'CategoryList' }),
      ]);

      setReceipt(nextReceipt);
      setFormValue(buildInitialForm(nextReceipt));
      setCategories(nextCategories);
    })()
      .catch(async loadError => {
        console.error('Failed to load receipt details:', loadError);
        setError(t.loadFailed.value);
        toast.error(t.loadFailed.value);
      })
      .finally(async () => {
        setLoading(false);
      });
  }, [receiptId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    receipt,
    setReceipt,
    categories,
    formValue,
    setFormValue,
    loading,
    error,
    loadData,
  };
}

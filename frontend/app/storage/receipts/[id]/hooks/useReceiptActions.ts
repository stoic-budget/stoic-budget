'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type RefObject, useState } from 'react';
import toast from 'react-hot-toast';
import type { EditableReceiptParsedData } from '@/app/components/receipts/receipt-types';
import { useIntlayer } from '@/app/i18n';
import apiClient, { type ReceiptRecord, receiptsApi } from '@/app/lib/api';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { buildParsedDataPayload, buildReceiptExportData } from '../receipt-form';
import { createTableFromExport, downloadReceiptFile } from '../receipt-requests';

/** Approve, download and export to a table, with the busy state each one shows. */
export function useReceiptActions(
  receipt: ReceiptRecord | null,
  formValue: EditableReceiptParsedData,
  lastSavedPayloadRef: RefObject<string | null>,
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useIntlayer('receiptDocumentPage');
  const [saving, setSaving] = useState(false);
  const [exportingToTable, setExportingToTable] = useState(false);

  const handleApprove = async (options: { transactionId?: string | null } = {}) => {
    if (!receipt) {
      return;
    }
    // Booking it without a date would date the expense today. A bank row to
    // attach to brings its own date.
    if (!(formValue.date || options.transactionId)) {
      toast.error(t.approveNeedsDate.value);
      return;
    }

    setSaving(true);

    await (async () => {
      const currentPayload = buildParsedDataPayload(formValue);
      await apiClient.patch(`/receipts/${receipt.id}`, {
        parsedData: currentPayload,
      } satisfies ContractInput<'UpdateReceiptBody'>);
      lastSavedPayloadRef.current = JSON.stringify(currentPayload);
      await receiptsApi.approveReceipt(receipt.id, options);
      toast.success(t.approved.value);
      // It leaves the Review queue; both lists are cached for 30s.
      invalidateDocumentLists();
      router.push(searchParams.get('from') === 'review' ? '/review' : '/statements/submit');
    })()
      .catch(async () => {
        toast.error(t.approveFailed.value);
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleDownload = async () => {
    if (!receipt) {
      return;
    }

    await downloadReceiptFile(receipt).catch(async downloadError => {
      console.error('Failed to download receipt:', downloadError);
      toast.error(t.downloadFailed.value);
    });
  };

  const handleExportToTable = async () => {
    if (!receipt) {
      toast.error(t.exportUnavailable.value);
      return;
    }

    setExportingToTable(true);

    return await (async () => {
      const exportData = buildReceiptExportData(receipt, formValue, {
        item: t.columns.item.value,
        vendor: t.columns.vendor.value,
        date: t.columns.date.value,
        amount: t.columns.amount.value,
        currency: t.columns.currency.value,
        source: t.columns.source.value,
        status: t.columns.status.value,
      });

      if (!(exportData.columns.length && exportData.rows.length)) {
        toast.error(t.exportNoFields.value);
        return;
      }

      const tableId = await createTableFromExport(
        {
          name: t.tableName.value.replace('{subject}', receipt.subject).slice(0, 120),
          description: t.tableDescription.value.replace(
            '{date}',
            formatStoredDate(receipt.receivedAt),
          ),
        },
        exportData,
      );

      if (!tableId) {
        toast.error(t.exportFailed.value);
        router.push('/custom-tables');
        return;
      }

      toast.success(t.exportSuccess.value);
      router.push(`/custom-tables/${tableId}`);
      return;
    })()
      .catch(async () => {
        toast.error(t.exportFailed.value);
      })
      .finally(async () => {
        setExportingToTable(false);
      });
  };

  return { saving, exportingToTable, handleApprove, handleDownload, handleExportToTable };
}

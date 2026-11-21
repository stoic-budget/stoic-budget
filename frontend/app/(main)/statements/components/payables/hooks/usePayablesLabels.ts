'use client';

import { useCallback, useMemo } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { PayableDirection } from '@/app/lib/payables-api';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

/** The screen's wording for one direction, resolved once from the dictionary. */
export function usePayablesLabels(direction: PayableDirection) {
  const t = useIntlayer('statementsPage');
  const recurrence = useIntlayer('payableRecurrence');
  const tx = useCallback((path: string[]) => resolveLabel(getNestedValue(t, path)), [t]);
  // Receivables reuse the payables screen; only the wording that names the counterparty
  // or the money flow switches, and it lives under the `receivables` content key.
  const dx = useCallback(
    (path: string[]) =>
      direction === 'receivable' ? tx(['receivables', ...path]) : tx(['payables', ...path]),
    [direction, tx],
  );
  const labels = useMemo(
    () => ({
      title: dx(['title']),
      subtitle: dx(['subtitle']),
      add: dx(['add']),
      export: tx(['payables', 'export']),
      summary: {
        toPay: dx(['summary', 'toPay']),
        overdue: tx(['payables', 'summary', 'overdue']),
        dueThisWeek: tx(['payables', 'summary', 'dueThisWeek']),
        paidTotal: dx(['summary', 'paidThisMonth']),
        itemsSuffix: tx(['payables', 'summary', 'itemsSuffix']),
        convertedNote: tx(['payables', 'summary', 'convertedNote']),
      },
      filters: {
        status: tx(['payables', 'filters', 'status']),
        source: tx(['payables', 'filters', 'source']),
        dueFrom: tx(['payables', 'filters', 'dueFrom']),
        dueTo: tx(['payables', 'filters', 'dueTo']),
        sort: tx(['payables', 'filters', 'sort']),
        reset: tx(['payables', 'filters', 'reset']),
        allStatuses: tx(['payables', 'filters', 'allStatuses']),
        allSources: tx(['payables', 'filters', 'allSources']),
        allTags: tx(['payables', 'filters', 'allTags']),
        statusOptions: {
          to_pay: dx(['status', 'toPay']),
          scheduled: tx(['payables', 'status', 'scheduled']),
          partially_paid: dx(['status', 'partiallyPaid']),
          paid: dx(['status', 'paid']),
          overdue: tx(['payables', 'status', 'overdue']),
          archived: tx(['payables', 'status', 'archived']),
        },
        sourceOptions: {
          manual: tx(['payables', 'sources', 'manual']),
          invoice: tx(['payables', 'sources', 'invoice']),
          statement: tx(['payables', 'sources', 'statement']),
        },
        sortOptions: {
          dueDateAsc: tx(['payables', 'sort', 'dueDateAsc']),
          dueDateDesc: tx(['payables', 'sort', 'dueDateDesc']),
          amountDesc: tx(['payables', 'sort', 'amountDesc']),
          vendorAsc: dx(['sort', 'vendorAsc']),
        },
      },
      list: {
        vendor: dx(['list', 'vendor']),
        dueDate: tx(['payables', 'list', 'dueDate']),
        amount: tx(['payables', 'list', 'amount']),
        source: tx(['payables', 'list', 'source']),
        status: tx(['payables', 'list', 'status']),
        actions: tx(['payables', 'list', 'actions']),
        markPaid: dx(['actions', 'markPaid']),
        edit: tx(['payables', 'actions', 'edit']),
        archive: tx(['payables', 'actions', 'archive']),
        delete: tx(['payables', 'actions', 'delete']),
        pageShown: tx(['pagination', 'shown']),
        previous: tx(['pagination', 'previous']),
        next: tx(['pagination', 'next']),
        pageOf: tx(['pagination', 'pageOf']),
        statusLabels: {
          to_pay: dx(['status', 'toPay']),
          scheduled: tx(['payables', 'status', 'scheduled']),
          partially_paid: dx(['status', 'partiallyPaid']),
          paid: dx(['status', 'paid']),
          overdue: tx(['payables', 'status', 'overdue']),
          archived: tx(['payables', 'status', 'archived']),
          // One occurrence of a repeating bill left out; the series goes on.
          skipped: recurrence.skipped.value,
        },
        amountPaid: dx(['list', 'amountPaid']),
        sourceLabels: {
          manual: tx(['payables', 'sources', 'manual']),
          invoice: tx(['payables', 'sources', 'invoice']),
          statement: tx(['payables', 'sources', 'statement']),
        },
      },
      drawer: {
        createTitle: dx(['drawer', 'createTitle']),
        editTitle: dx(['drawer', 'editTitle']),
        vendor: dx(['drawer', 'vendor']),
        amount: tx(['payables', 'drawer', 'amount']),
        currency: tx(['payables', 'drawer', 'currency']),
        dueDate: tx(['payables', 'drawer', 'dueDate']),
        source: tx(['payables', 'drawer', 'source']),
        status: tx(['payables', 'drawer', 'status']),
        comment: tx(['payables', 'drawer', 'comment']),
        save: tx(['payables', 'drawer', 'save']),
        saving: tx(['payables', 'drawer', 'saving']),
        cancel: tx(['payables', 'drawer', 'cancel']),
        sourceOptions: {
          manual: tx(['payables', 'sources', 'manual']),
          invoice: tx(['payables', 'sources', 'invoice']),
          statement: tx(['payables', 'sources', 'statement']),
        },
        statusOptions: {
          to_pay: dx(['status', 'toPay']),
          scheduled: tx(['payables', 'status', 'scheduled']),
          paid: dx(['status', 'paid']),
          overdue: tx(['payables', 'status', 'overdue']),
          archived: tx(['payables', 'status', 'archived']),
        },
      },
      emptyTitle: dx(['empty', 'title']),
      emptyDescription: dx(['empty', 'description']),
      authLoading: tx(['payables', 'auth', 'loading']),
      loginRequired: dx(['auth', 'loginRequired']),
      noWorkspace: dx(['auth', 'workspaceRequired']),
      toasts: {
        loadFailed: dx(['toasts', 'loadFailed']),
        createSuccess: dx(['toasts', 'createSuccess']),
        createFailed: dx(['toasts', 'createFailed']),
        updateSuccess: dx(['toasts', 'updateSuccess']),
        updateFailed: dx(['toasts', 'updateFailed']),
        markPaidSuccess: dx(['toasts', 'markPaidSuccess']),
        markPaidFailed: dx(['toasts', 'markPaidFailed']),
        archiveSuccess: dx(['toasts', 'archiveSuccess']),
        archiveFailed: dx(['toasts', 'archiveFailed']),
        deleteSuccess: dx(['toasts', 'deleteSuccess']),
        deleteFailed: dx(['toasts', 'deleteFailed']),
        deleteConfirm: tx(['payables', 'toasts', 'deleteConfirm']),
      },
    }),
    [dx, tx, recurrence],
  );
  return { labels, tx };
}

export type PayablesLabels = ReturnType<typeof usePayablesLabels>['labels'];

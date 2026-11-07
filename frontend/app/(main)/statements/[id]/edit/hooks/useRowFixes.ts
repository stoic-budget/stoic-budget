import { toast } from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import type { Transaction } from '../editHelpers';

/** A row as the person typed it: money out below zero, money in above. */
export interface RowValues {
  transactionDate: string;
  counterpartyName: string;
  paymentPurpose: string;
  amount: number;
}

/**
 * Corrections of a statement the reading got wrong: a row edited or added by
 * hand, or deleted, and after each the statement's checks against its rows as
 * they now are (`POST /statements/:id/recheck`), so it completes once they add
 * up. `reload` then shows rows and status as they now are.
 */
export function useRowFixes(statementId: string, reload: () => Promise<void>, failed: string) {
  const recheck = async () => {
    const url = `/statements/${statementId}/recheck`;
    await checkContract('StatementRecheck', (await apiClient.post(url)).data, url);
  };

  const saveRow = async (row: Transaction | null, values: RowValues): Promise<boolean> => {
    try {
      if (row) {
        const value = Math.abs(values.amount);
        const out = values.amount < 0;
        await apiClient.put(`/transactions/${row.id}`, {
          transactionDate: values.transactionDate,
          counterpartyName: values.counterpartyName,
          paymentPurpose: values.paymentPurpose,
          debit: out ? value : null,
          credit: out ? null : value,
          amount: value,
          transactionType: out ? 'expense' : 'income',
        } satisfies ContractInput<'UpdateTransactionBody'>);
        await recheck();
      } else {
        const url = `/statements/${statementId}/rows`;
        const response = await apiClient.post(url, {
          ...values,
          paymentPurpose: values.paymentPurpose || null,
        } satisfies ContractInput<'AddStatementRowBody'>);
        await checkContract('StatementRecheck', response.data, url);
      }
      await reload();
      return true;
    } catch {
      toast.error(failed);
      return false;
    }
  };

  /** After a row is deleted the sums change: the checks run again. */
  const afterDelete = async () => {
    await recheck().catch(() => undefined);
    await reload();
  };

  return { saveRow, afterDelete };
}

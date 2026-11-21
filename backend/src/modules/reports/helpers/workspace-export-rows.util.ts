import { currencyCodeOrDefault } from '../../../common/utils/currency.util';
import { formatMoney } from '../../../common/utils/format-money.util';
import { neutralizeSpreadsheetFormulaCell } from '../../../common/utils/spreadsheet-formula.util';
import { type Transaction, TransactionType } from '../../../entities/transaction.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../../categories/uncategorized-category';
import { toDateKey } from './report-values.util';

export interface WorkspaceTransactionExportRow {
  index: number;
  transactionDate: string;
  transactionType: string;
  counterpartyName: string;
  counterpartyBin: string;
  paymentPurpose: string;
  debit: number | null;
  credit: number | null;
  amount: number | null;
  currency: string;
  category: string;
  branch: string;
  wallet: string;
  documentNumber: string;
  comments: string;
}

/** Keeps the export cell inert while preserving the empty-string default. */
const neutralize = (value: string | null | undefined): string =>
  neutralizeSpreadsheetFormulaCell(value || '') as string;

export function mapWorkspaceTransactionRows(
  transactions: Transaction[],
): WorkspaceTransactionExportRow[] {
  return transactions.map((transaction, index) => ({
    index: index + 1,
    transactionDate: transaction.transactionDate
      ? toDateKey(transaction.transactionDate as unknown as Date)
      : '',
    transactionType: transaction.transactionType === TransactionType.INCOME ? 'Приход' : 'Расход',
    // Free-text fields come from parsed statements, receipt OCR and email import, so
    // a value starting with = + - @ would execute as a formula when the CSV or
    // XLSX is opened. Control fields below are ours and stay untouched so the
    // summary can still match on them.
    counterpartyName: neutralize(transaction.counterpartyName),
    counterpartyBin: neutralize(transaction.counterpartyBin),
    paymentPurpose: neutralize(transaction.paymentPurpose),
    debit: transaction.debit != null ? Number(transaction.debit) : null,
    credit: transaction.credit != null ? Number(transaction.credit) : null,
    amount: transaction.amount != null ? Number(transaction.amount) : null,
    currency: currencyCodeOrDefault(transaction.currency),
    category: neutralize(transaction.category?.name) || UNCATEGORIZED_CATEGORY_NAME,
    branch: neutralize(transaction.branch?.name),
    wallet: neutralize(transaction.wallet?.name),
    documentNumber: neutralize(transaction.documentNumber),
    comments: neutralize(transaction.comments),
  }));
}

export function buildWorkspaceSummaryRows(rows: WorkspaceTransactionExportRow[]) {
  const totalIncome = rows.reduce((sum, row) => sum + (row.credit || 0), 0);
  const totalExpense = rows.reduce((sum, row) => sum + (row.debit || 0), 0);
  const incomeCount = rows.filter(row => row.transactionType === 'Приход').length;
  const expenseCount = rows.filter(row => row.transactionType === 'Расход').length;

  return [
    { Показатель: 'Всего транзакций', Значение: rows.length },
    { Показатель: 'Приходы', Значение: incomeCount },
    { Показатель: 'Расходы', Значение: expenseCount },
    { Показатель: 'Сумма приходов', Значение: totalIncome },
    { Показатель: 'Сумма расходов', Значение: totalExpense },
    { Показатель: 'Баланс', Значение: totalIncome - totalExpense },
  ];
}

export function formatWorkspaceAmount(value: number | null): string {
  return formatMoney(value);
}

export function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

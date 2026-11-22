import * as fs from 'fs';
import * as xlsx from 'xlsx';
import type { Transaction } from '../../../entities/transaction.entity';
import {
  buildWorkspaceSummaryRows,
  escapeCsvValue,
  mapWorkspaceTransactionRows,
} from './workspace-export-rows.util';

export async function generateWorkspaceExcel(
  transactions: Transaction[],
  filePath: string,
): Promise<void> {
  const workbook = xlsx.utils.book_new();
  const rows = mapWorkspaceTransactionRows(transactions);
  const transactionSheet = xlsx.utils.json_to_sheet(
    rows.map(row => ({
      '№': row.index,
      Дата: row.transactionDate,
      Тип: row.transactionType,
      Контрагент: row.counterpartyName,
      'БИН/ИИН': row.counterpartyBin,
      'Назначение платежа': row.paymentPurpose,
      Дебет: row.debit,
      Кредит: row.credit,
      Сумма: row.amount,
      Валюта: row.currency,
      Категория: row.category,
      Филиал: row.branch,
      Кошелек: row.wallet,
      '№ документа': row.documentNumber,
      Комментарий: row.comments,
    })),
  );

  transactionSheet['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
    { wch: 16 },
    { wch: 48 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
  ];

  const summarySheet = xlsx.utils.json_to_sheet(buildWorkspaceSummaryRows(rows));
  summarySheet['!cols'] = [{ wch: 24 }, { wch: 18 }];

  xlsx.utils.book_append_sheet(workbook, transactionSheet, 'Транзакции');
  xlsx.utils.book_append_sheet(workbook, summarySheet, 'Сводка');

  xlsx.writeFile(workbook, filePath);
}

export async function generateWorkspaceCsv(
  transactions: Transaction[],
  filePath: string,
): Promise<void> {
  const rows = mapWorkspaceTransactionRows(transactions);
  const headers = [
    '№',
    'Дата',
    'Тип',
    'Контрагент',
    'БИН/ИИН',
    'Назначение платежа',
    'Дебет',
    'Кредит',
    'Сумма',
    'Валюта',
    'Категория',
    'Филиал',
    'Кошелек',
    '№ документа',
    'Комментарий',
  ];

  const csvLines = [
    headers.join(','),
    ...rows.map(row =>
      [
        String(row.index),
        row.transactionDate,
        row.transactionType,
        row.counterpartyName,
        row.counterpartyBin,
        row.paymentPurpose,
        row.debit == null ? '' : String(row.debit),
        row.credit == null ? '' : String(row.credit),
        row.amount == null ? '' : String(row.amount),
        row.currency,
        row.category,
        row.branch,
        row.wallet,
        row.documentNumber,
        row.comments,
      ]
        .map(value => escapeCsvValue(value))
        .join(','),
    ),
  ];

  fs.writeFileSync(filePath, `\uFEFF${csvLines.join('\n')}`, 'utf-8');
}

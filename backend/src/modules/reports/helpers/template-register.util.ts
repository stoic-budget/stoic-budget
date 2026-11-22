import type { ReportDocument } from '../report-document.util';
import { fillLabel } from '../report-template.translations';
import type { TemplateLabels, TemplateReportRow } from '../report-template.types';
import { round2 } from './report-values.util';

/**
 * The one detail-level template: every transaction in the period, with both the
 * converted and the original amount so a foreign-currency line stays auditable,
 * and the id so a line can be traced back to the app.
 */
export function buildTransactionRegisterDocument(
  text: TemplateLabels,
  subtitle: string,
  currency: string,
  rows: TemplateReportRow[],
): ReportDocument {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const net = sorted.reduce((sum, row) => sum + (row.isIncome ? row.amount : -row.amount), 0);

  return {
    title: text.titleTransactionRegister,
    subtitle,
    sections: [
      {
        columns: [
          text.date,
          text.counterparty,
          text.group,
          text.category,
          text.type,
          fillLabel(text.amountInCurrency, { currency }),
          text.original,
          text.account,
          text.comment,
          text.tags,
          text.transactionId,
        ],
        rows: sorted.map(row => [
          row.date,
          row.counterparty,
          row.groupName,
          row.categoryName,
          row.isIncome ? text.income : text.expense,
          round2(row.isIncome ? row.amount : -row.amount),
          `${round2(row.originalAmount)} ${row.originalCurrency}`,
          row.accountName,
          row.comment,
          row.tags.join(', '),
          row.id,
        ]),
        total: [
          text.total,
          '',
          '',
          '',
          fillLabel(text.rowCount, { count: sorted.length }),
          round2(net),
          '',
          '',
          '',
          '',
          '',
        ],
      },
    ],
  };
}

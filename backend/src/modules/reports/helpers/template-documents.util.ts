import type { GenerateReportBody } from '../../../contracts';
import type { ReportDocument } from '../report-document.util';
import type { TemplateLabels, TemplateReportRow } from '../report-template.types';
import { round2 } from './report-values.util';
import { buildCategoryByMonthDocument, monthKeys } from './template-category-by-month.util';
import {
  byGroupThenAmount,
  sumByCategory,
  sumTotals,
  toAmountRows,
} from './template-category-totals.util';
import { buildTransactionRegisterDocument } from './template-register.util';

export function buildTemplateBody(
  dto: GenerateReportBody,
  text: TemplateLabels,
  subtitle: string,
  currency: string,
  rows: TemplateReportRow[],
): ReportDocument {
  if (dto.templateId === 'pnl') {
    return buildPnLDocument(text, subtitle, rows);
  }
  if (dto.templateId === 'cash-flow') {
    return buildCashFlowDocument(text, subtitle, rows, dto.groupBy || 'day');
  }
  if (dto.templateId === 'transaction-register') {
    return buildTransactionRegisterDocument(text, subtitle, currency, rows);
  }
  if (dto.templateId === 'monthly-summary') {
    return buildMonthlySummaryDocument(text, subtitle, rows);
  }
  if (dto.templateId === 'category-by-month') {
    return buildCategoryByMonthDocument(text, subtitle, rows, monthKeys(dto.dateFrom, dto.dateTo));
  }
  return buildExpenseByCategoryDocument(text, subtitle, rows);
}

export function buildPnLDocument(
  text: TemplateLabels,
  subtitle: string,
  rows: TemplateReportRow[],
): ReportDocument {
  const income = byGroupThenAmount(sumByCategory(rows.filter(row => row.isIncome)));
  const expense = byGroupThenAmount(sumByCategory(rows.filter(row => !row.isIncome)));

  const totalRevenue = sumTotals(income);
  const totalExpenses = sumTotals(expense);
  const columns = [text.group, text.category, text.amount];

  return {
    title: text.titlePnl,
    subtitle,
    sections: [
      {
        title: text.revenue,
        columns,
        rows: toAmountRows(income),
        total: [text.totalRevenue, '', round2(totalRevenue)],
      },
      {
        title: text.expenses,
        columns,
        rows: toAmountRows(expense),
        total: [text.totalExpenses, '', round2(totalExpenses)],
      },
    ],
    footer: [[text.netIncome, round2(totalRevenue - totalExpenses)]],
  };
}

/**
 * Collapses an ISO date into its bucket. Weeks are keyed by their Monday, so
 * the key stays sortable as a plain string like the other two.
 */
export function toPeriodKey(dateKey: string, groupBy: 'day' | 'week' | 'month'): string {
  if (groupBy === 'month') {
    return dateKey.slice(0, 7);
  }
  if (groupBy === 'day') {
    return dateKey;
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.toISOString().slice(0, 10);
}

export function buildCashFlowDocument(
  text: TemplateLabels,
  subtitle: string,
  rows: TemplateReportRow[],
  groupBy: 'day' | 'week' | 'month',
): ReportDocument {
  const buckets = new Map<string, { income: number; expense: number }>();

  for (const row of rows) {
    const periodKey = toPeriodKey(row.date, groupBy);
    const bucket = buckets.get(periodKey) ?? { income: 0, expense: 0 };
    if (row.isIncome) {
      bucket.income += row.amount;
    } else {
      bucket.expense += row.amount;
    }
    buckets.set(periodKey, bucket);
  }

  const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  const totalIncome = sorted.reduce((sum, [, bucket]) => sum + bucket.income, 0);
  const totalExpense = sorted.reduce((sum, [, bucket]) => sum + bucket.expense, 0);

  return {
    title: text.titleCashFlow,
    subtitle,
    sections: [
      {
        columns: [
          groupBy === 'day' ? text.date : groupBy === 'week' ? text.weekOf : text.month,
          text.income,
          text.expense,
          text.net,
        ],
        rows: sorted.map(([date, bucket]) => [
          date,
          round2(bucket.income),
          round2(bucket.expense),
          round2(bucket.income - bucket.expense),
        ]),
        total: [
          text.total,
          round2(totalIncome),
          round2(totalExpense),
          round2(totalIncome - totalExpense),
        ],
      },
    ],
  };
}

export function buildExpenseByCategoryDocument(
  text: TemplateLabels,
  subtitle: string,
  rows: TemplateReportRow[],
): ReportDocument {
  const byCategory = byGroupThenAmount(sumByCategory(rows.filter(row => !row.isIncome)));
  const totalExpenses = sumTotals(byCategory);
  const totalCount = byCategory.reduce((sum, entry) => sum + entry.count, 0);

  const categoryRows = byCategory.map(entry => [
    entry.groupName,
    entry.categoryName,
    round2(entry.total),
    entry.count,
    totalExpenses > 0 ? round2((entry.total / totalExpenses) * 100) : 0,
  ]);

  return {
    title: text.titleExpenseByCategory,
    subtitle,
    sections: [
      {
        columns: [
          text.group,
          text.category,
          text.totalAmount,
          text.transactionCount,
          text.percentOfTotal,
        ],
        rows: categoryRows,
        total: [text.total, '', round2(totalExpenses), totalCount, categoryRows.length ? 100 : 0],
      },
    ],
  };
}

export function buildMonthlySummaryDocument(
  text: TemplateLabels,
  subtitle: string,
  rows: TemplateReportRow[],
): ReportDocument {
  const income = rows.filter(row => row.isIncome);
  const expense = rows.filter(row => !row.isIncome);
  const totalIncome = income.reduce((sum, row) => sum + row.amount, 0);
  const totalExpense = expense.reduce((sum, row) => sum + row.amount, 0);

  const topCategories = sumByCategory(expense)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(entry => [entry.categoryName, round2(entry.total)]);

  return {
    title: text.titleMonthlySummary,
    subtitle,
    sections: [
      {
        title: text.totals,
        columns: [text.metric, text.value],
        rows: [
          [text.income, round2(totalIncome)],
          [text.expenses, round2(totalExpense)],
          [text.transactions, rows.length],
          [
            text.savingsRate,
            totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
          ],
        ],
      },
      {
        title: text.topExpenseCategories,
        columns: [text.category, text.amount],
        rows: topCategories,
      },
    ],
    footer: [[text.netTotal, round2(totalIncome - totalExpense)]],
  };
}

import type { ReportDocument } from '../report-document.util';
import type { TemplateLabels, TemplateReportRow } from '../report-template.types';
import { round2 } from './report-values.util';
import { byGroupThenAmount } from './template-category-totals.util';

export function monthKeys(dateFrom: string, dateTo: string): string[] {
  const keys: string[] = [];
  let [year, month] = dateFrom.slice(0, 7).split('-').map(Number);
  const last = dateTo.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > last) {
      return keys;
    }
    keys.push(key);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/**
 * Income and spending per category with a column per month, as YNAB's
 * Income v Expense lays it out: the table people build next year's budget
 * from. Empty months stay as zero columns so every row lines up.
 */
export function buildCategoryByMonthDocument(
  text: TemplateLabels,
  subtitle: string,
  rows: TemplateReportRow[],
  months: string[],
): ReportDocument {
  const column = new Map(months.map((month, index) => [month, index]));
  const net = months.map(() => 0);

  const section = (title: string, sectionRows: TemplateReportRow[], sign: 1 | -1) => {
    const byCategory = new Map<
      string,
      { groupName: string; categoryName: string; perMonth: number[]; total: number }
    >();
    const perMonthTotal = months.map(() => 0);
    for (const row of sectionRows) {
      const index = column.get(row.date.slice(0, 7));
      if (index === undefined) {
        continue;
      }
      const entry = byCategory.get(row.categoryKey) ?? {
        groupName: row.groupName,
        categoryName: row.categoryName,
        perMonth: months.map(() => 0),
        total: 0,
      };
      entry.perMonth[index] += row.amount;
      entry.total += row.amount;
      byCategory.set(row.categoryKey, entry);
      perMonthTotal[index] += row.amount;
      net[index] += sign * row.amount;
    }

    const entries = byGroupThenAmount(Array.from(byCategory.values()));
    const sectionTotal = perMonthTotal.reduce((sum, value) => sum + value, 0);
    return {
      title,
      columns: [text.group, text.category, ...months, text.totalColumn, text.averagePerMonth],
      rows: entries.map(entry => [
        entry.groupName,
        entry.categoryName,
        ...entry.perMonth.map(value => round2(value)),
        round2(entry.total),
        round2(entry.total / months.length),
      ]),
      total: [
        text.total,
        '',
        ...perMonthTotal.map(value => round2(value)),
        round2(sectionTotal),
        round2(sectionTotal / months.length),
      ],
    };
  };

  const income = section(
    text.revenue,
    rows.filter(row => row.isIncome),
    1,
  );
  const expenses = section(
    text.expenses,
    rows.filter(row => !row.isIncome),
    -1,
  );
  const netTotal = net.reduce((sum, value) => sum + value, 0);

  return {
    title: text.titleCategoryByMonth,
    subtitle,
    orientation: 'landscape',
    sections: [
      income,
      expenses,
      {
        title: text.net,
        columns: ['', '', ...months, text.totalColumn, text.averagePerMonth],
        rows: [
          [
            text.netTotal,
            '',
            ...net.map(value => round2(value)),
            round2(netTotal),
            round2(netTotal / months.length),
          ],
        ],
      },
    ],
    footer: [[text.netTotal, round2(netTotal)]],
  };
}

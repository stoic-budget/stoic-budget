import * as fs from 'fs';
import * as xlsx from 'xlsx';
import type { CustomReport } from '../interfaces/custom-report.interface';
import type { DailyReport } from '../interfaces/daily-report.interface';
import type { MonthlyReport } from '../interfaces/monthly-report.interface';
import { renderReportLabels } from '../report-export.translations';

interface CustomReportExportRow {
  group: string;
  date: string | null;
  counterparty: string;
  amount: number;
  category: string;
  branch: string;
  wallet: string;
}

export async function exportToExcel(
  reportData: DailyReport | MonthlyReport | CustomReport,
  filePath: string,
  locale?: string,
): Promise<void> {
  const workbook = xlsx.utils.book_new();

  const L = renderReportLabels(locale);

  if ('date' in reportData) {
    // Daily report
    const dailyData = reportData as DailyReport;
    const ws = xlsx.utils.aoa_to_sheet([
      [L.type, L.amount, L.count],
      [L.income, dailyData.income.totalAmount, dailyData.income.transactionCount],
      [L.expense, dailyData.expense.totalAmount, dailyData.expense.transactionCount],
      [L.difference, dailyData.summary.difference],
    ]);
    xlsx.utils.book_append_sheet(workbook, ws, L.sheetReport);
  } else if ('month' in reportData) {
    // Monthly report
    const monthlyData = reportData as MonthlyReport;
    const ws = xlsx.utils.aoa_to_sheet([
      [L.date, L.income, L.expense],
      ...monthlyData.dailyTrends.map(trend => [trend.date, trend.income, trend.expense]),
    ]);
    xlsx.utils.book_append_sheet(workbook, ws, L.sheetTrends);
  } else {
    // Custom report
    const customData = reportData as CustomReport;
    const rows: CustomReportExportRow[] = [];
    customData.groups.forEach(group => {
      group.transactions.forEach(t => {
        rows.push({
          group: group.label,
          date: t.date,
          counterparty: t.counterparty,
          amount: t.amount,
          category: t.category || '',
          branch: t.branch || '',
          wallet: t.wallet || '',
        });
      });
    });
    const ws = xlsx.utils.aoa_to_sheet([
      [L.group, L.date, L.counterparty, L.amount, L.category, L.branch, L.wallet],
      ...rows.map(r => [r.group, r.date, r.counterparty, r.amount, r.category, r.branch, r.wallet]),
    ]);
    xlsx.utils.book_append_sheet(workbook, ws, L.sheetReport);
  }

  xlsx.writeFile(workbook, filePath);
}

export async function exportToCSV(
  reportData: DailyReport | MonthlyReport | CustomReport,
  filePath: string,
  locale?: string,
): Promise<void> {
  let csvContent = '';
  const L = renderReportLabels(locale);

  if ('date' in reportData) {
    // Daily report
    const dailyData = reportData as DailyReport;
    csvContent = `${L.type},${L.amount},${L.count}\n`;
    csvContent += `${L.income},${dailyData.income.totalAmount},${dailyData.income.transactionCount}\n`;
    csvContent += `${L.expense},${dailyData.expense.totalAmount},${dailyData.expense.transactionCount}\n`;
    csvContent += `${L.difference},${dailyData.summary.difference},\n`;
  } else if ('month' in reportData) {
    // Monthly report
    const monthlyData = reportData as MonthlyReport;
    csvContent = `${L.date},${L.income},${L.expense}\n`;
    monthlyData.dailyTrends.forEach(trend => {
      csvContent += `${trend.date},${trend.income},${trend.expense}\n`;
    });
  } else {
    // Custom report
    const customData = reportData as CustomReport;
    csvContent = `${L.group},${L.date},${L.counterparty},${L.amount},${L.category},${L.branch},${L.wallet}\n`;
    customData.groups.forEach(group => {
      group.transactions.forEach(t => {
        csvContent += `${group.label},${t.date},${t.counterparty},${t.amount},${t.category || ''},${t.branch || ''},${t.wallet || ''}\n`;
      });
    });
  }

  fs.writeFileSync(filePath, csvContent, 'utf-8');
}

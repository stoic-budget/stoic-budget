import { formatMoney } from '../../common/utils/format-money.util';
import type { DailyReport } from '../reports/interfaces/daily-report.interface';
import type { MonthlyReport } from '../reports/interfaces/monthly-report.interface';
import { renderTelegramMessage } from './telegram-translations';

/** The bot's daily and monthly report messages, every amount with its currency. */
export function formatDailyReportMessage(
  locale: string,
  date: string,
  report: DailyReport,
): string {
  const lines: string[] = [];
  const amount = (value: number) => formatAmount(value, locale, report.currency);
  lines.push(renderTelegramMessage(locale, 'daily_header', { date }));
  lines.push(
    renderTelegramMessage(locale, 'income_line', {
      amount: amount(report.income.totalAmount),
      count: report.income.transactionCount,
    }),
  );
  lines.push(
    renderTelegramMessage(locale, 'expense_line', {
      amount: amount(report.expense.totalAmount),
      count: report.expense.transactionCount,
    }),
  );
  lines.push(
    renderTelegramMessage(locale, 'daily_total', {
      amount: amount(report.summary.difference),
    }),
  );

  if (report.income.topCounterparties.length > 0) {
    lines.push('', renderTelegramMessage(locale, 'top_income_header'));
    report.income.topCounterparties.slice(0, 5).forEach((item, idx) => {
      lines.push(
        renderTelegramMessage(locale, 'list_item', {
          index: idx + 1,
          name: item.name,
          amount: amount(item.amount),
          count: item.count,
        }),
      );
    });
  }

  if (report.expense.topCategories.length > 0) {
    lines.push('', renderTelegramMessage(locale, 'top_expense_header'));
    report.expense.topCategories.slice(0, 5).forEach((item, idx) => {
      lines.push(
        renderTelegramMessage(locale, 'list_item', {
          index: idx + 1,
          name: item.categoryName,
          amount: amount(item.amount),
          count: item.count,
        }),
      );
    });
  }

  if (report.missingRates.length > 0) {
    lines.push(
      '',
      renderTelegramMessage(locale, 'report_missing_rates', {
        currencies: report.missingRates.join(', '),
      }),
    );
  }
  return lines.join('\n');
}

export function formatMonthlyReportMessage(
  locale: string,
  year: number,
  month: number,
  report: MonthlyReport,
): string {
  const lines: string[] = [];
  const amount = (value: number) => formatAmount(value, locale, report.currency);
  const period = `${String(month).padStart(2, '0')}.${year}`;
  lines.push(renderTelegramMessage(locale, 'monthly_header', { period }));
  lines.push(
    renderTelegramMessage(locale, 'monthly_income', {
      amount: amount(report.summary.totalIncome),
    }),
  );
  lines.push(
    renderTelegramMessage(locale, 'monthly_expense', {
      amount: amount(report.summary.totalExpense),
    }),
  );
  lines.push(
    renderTelegramMessage(locale, 'monthly_diff', {
      amount: amount(report.summary.difference),
      count: report.summary.transactionCount,
    }),
  );

  if (report.categoryDistribution.length > 0) {
    lines.push('', renderTelegramMessage(locale, 'top_categories_header'));
    report.categoryDistribution.slice(0, 5).forEach((item, idx) => {
      lines.push(
        renderTelegramMessage(locale, 'category_item', {
          index: idx + 1,
          name: item.categoryName,
          amount: amount(item.amount),
          percent: item.percentage.toFixed(1),
        }),
      );
    });
  }

  if (report.counterpartyDistribution.length > 0) {
    lines.push('', renderTelegramMessage(locale, 'top_counterparties_header'));
    report.counterpartyDistribution.slice(0, 5).forEach((item, idx) => {
      lines.push(
        renderTelegramMessage(locale, 'counterparty_item', {
          index: idx + 1,
          name: item.counterpartyName,
          amount: amount(item.amount),
          percent: item.percentage.toFixed(1),
        }),
      );
    });
  }

  if (report.missingRates.length > 0) {
    lines.push(
      '',
      renderTelegramMessage(locale, 'report_missing_rates', {
        currencies: report.missingRates.join(', '),
      }),
    );
  }
  return lines.join('\n');
}

/** With the currency, as a report's amounts are all in one (#598). */
function formatAmount(value: number | null | undefined, locale: string, currency: string): string {
  return `${formatMoney(value || 0, locale)} ${currency}`;
}

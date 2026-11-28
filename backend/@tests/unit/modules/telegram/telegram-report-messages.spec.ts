import type { DailyReport } from '@/modules/reports/interfaces/daily-report.interface';
import type { MonthlyReport } from '@/modules/reports/interfaces/monthly-report.interface';
import {
  formatDailyReportMessage,
  formatMonthlyReportMessage,
} from '@/modules/telegram/telegram-report-messages';

const daily = (missingRates: string[]): DailyReport => ({
  date: '2026-11-02',
  currency: 'EUR',
  missingRates,
  income: { totalAmount: 0, transactionCount: 0, topCounterparties: [] },
  expense: {
    totalAmount: 190,
    transactionCount: 2,
    topCategories: [{ categoryId: 'shop', categoryName: 'Shopping', amount: 190, count: 2 }],
  },
  summary: { incomeTotal: 0, expenseTotal: 190, difference: -190 },
});

describe('Telegram report messages (#598)', () => {
  it('names the currency of every amount', () => {
    const message = formatDailyReportMessage('en', '2026-11-02', daily([]));

    expect(message).toContain('190.00 EUR');
    expect(message).not.toContain('XAU');
  });

  it('says which currencies were left out for want of a rate', () => {
    const message = formatDailyReportMessage('en', '2026-11-02', daily(['XAU', 'ZWL']));

    expect(message).toContain('Left out, no exchange rate: XAU, ZWL');
  });

  it('names the currency in the monthly report too', () => {
    const monthly = {
      month: '10',
      year: 2026,
      currency: 'KZT',
      missingRates: ['XAU'],
      dailyTrends: [],
      categoryDistribution: [],
      counterpartyDistribution: [],
      summary: { totalIncome: 1000, totalExpense: 0, difference: 1000, transactionCount: 1 },
    } as unknown as MonthlyReport;

    const message = formatMonthlyReportMessage('en', 2026, 10, monthly);

    expect(message).toContain('1,000.00 KZT');
    expect(message).toContain('Left out, no exchange rate: XAU');
  });
});

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { SpendOverTimeQuery } from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { applyReportFilters } from './helpers/report-filters.util';
import { countedTransactions } from './helpers/report-query.util';
import {
  formatMonthLabel,
  formatMonthPeriod,
  getIsoWeekInfo,
  toDateKey,
  toEndOfUtcDay,
  toStartOfUtcDay,
} from './helpers/report-values.util';
import type {
  SpendOverTimePoint,
  SpendOverTimeResult,
} from './interfaces/spend-over-time.interface';

/** Income, expense and net per day, week, month, quarter or year, empty periods included. */
@Injectable()
export class SpendOverTimeReport {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async getSpendOverTimeReport(
    workspaceId: string,
    query: SpendOverTimeQuery,
    selfMemberId: string | null = null,
  ): Promise<SpendOverTimeResult> {
    const now = new Date();
    const endDate = query.dateTo ? new Date(query.dateTo) : now;
    const startDate = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(new Date(endDate).setDate(endDate.getDate() - 30));
    const groupBy = query.groupBy || 'day';

    const from = toStartOfUtcDay(startDate);
    const to = toEndOfUtcDay(endDate);

    const qb = countedTransactions(this.transactionRepository, workspaceId)
      // Rows without a statement (cash, approved receipts) are spending too.
      .leftJoin('transaction.statement', 'statement')
      .leftJoin('transaction.category', 'category')
      .andWhere('transaction.transactionDate >= :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to });

    applyReportFilters(qb, query, selfMemberId);

    if (typeof query.exported === 'boolean') {
      if (query.exported) {
        qb.andWhere('statement.processedAt IS NOT NULL');
      } else {
        qb.andWhere('statement.processedAt IS NULL');
      }
    }

    if (typeof query.paid === 'boolean') {
      if (query.paid) {
        qb.andWhere('statement.statementDateTo IS NOT NULL');
      } else {
        qb.andWhere('statement.statementDateTo IS NULL');
      }
    }

    const dayPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY-MM-DD')";
    const monthPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY-MM')";
    const weekPeriodExpr =
      "TO_CHAR(transaction.transactionDate, 'IYYY') || '-W' || TO_CHAR(transaction.transactionDate, 'IW')";
    const quarterPeriodExpr =
      "TO_CHAR(transaction.transactionDate, 'YYYY') || '-Q' || TO_CHAR(transaction.transactionDate, 'Q')";
    const yearPeriodExpr = "TO_CHAR(transaction.transactionDate, 'YYYY')";

    const periodExpr =
      groupBy === 'year'
        ? yearPeriodExpr
        : groupBy === 'quarter'
          ? quarterPeriodExpr
          : groupBy === 'month'
            ? monthPeriodExpr
            : groupBy === 'week'
              ? weekPeriodExpr
              : dayPeriodExpr;

    const rows = await qb
      .select(`${periodExpr}`, 'period')
      .addSelect(
        `SUM(CASE WHEN transaction.transactionType = '${TransactionType.INCOME}' THEN ABS(COALESCE(transaction.amount, 0)) ELSE 0 END)`,
        'income',
      )
      .addSelect(
        `SUM(CASE WHEN transaction.transactionType = '${TransactionType.EXPENSE}' THEN ABS(COALESCE(transaction.amount, 0)) ELSE 0 END)`,
        'expense',
      )
      .addSelect('COUNT(transaction.id)', 'count')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; income: string; expense: string; count: string }>();

    const valuesByPeriod = new Map<string, { income: number; expense: number; count: number }>();
    for (const row of rows) {
      valuesByPeriod.set(row.period, {
        income: Number(row.income || 0),
        expense: Number(row.expense || 0),
        count: Number(row.count || 0),
      });
    }

    const points: SpendOverTimePoint[] = [];

    const cursor = toStartOfUtcDay(from);
    const endCursor = toStartOfUtcDay(to);
    const totals = { income: 0, expense: 0, net: 0, count: 0 };

    while (cursor <= endCursor) {
      let period = '';
      let label = '';

      if (groupBy === 'month') {
        period = formatMonthPeriod(cursor);
        label = formatMonthLabel(cursor);
      } else if (groupBy === 'quarter') {
        const year = cursor.getUTCFullYear();
        const quarter = Math.floor(cursor.getUTCMonth() / 3) + 1;
        period = `${year}-Q${quarter}`;
        label = `Q${quarter} ${year}`;
      } else if (groupBy === 'year') {
        period = `${cursor.getUTCFullYear()}`;
        label = period;
      } else if (groupBy === 'week') {
        const { year, week } = getIsoWeekInfo(cursor);
        const weekString = `${week}`.padStart(2, '0');
        period = `${year}-W${weekString}`;
        label = `Week ${weekString}`;
      } else {
        period = toDateKey(cursor);
        label = period;
      }

      const current = valuesByPeriod.get(period) || { income: 0, expense: 0, count: 0 };
      const net = current.income - current.expense;
      points.push({
        period,
        label,
        income: current.income,
        expense: current.expense,
        net,
        count: current.count,
      });

      totals.income += current.income;
      totals.expense += current.expense;
      totals.net += net;
      totals.count += current.count;

      if (groupBy === 'month') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
      } else if (groupBy === 'quarter') {
        cursor.setUTCMonth(cursor.getUTCMonth() + 3, 1);
      } else if (groupBy === 'year') {
        cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
      } else if (groupBy === 'week') {
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      cursor.setUTCHours(0, 0, 0, 0);
    }

    const avgPerPeriod = points.length ? totals.net / points.length : 0;

    return {
      groupBy,
      dateFrom: from.toISOString().split('T')[0],
      dateTo: to.toISOString().split('T')[0],
      points,
      totals: {
        income: totals.income,
        expense: totals.expense,
        net: totals.net,
        count: totals.count,
        avgPerPeriod,
      },
    };
  }
}

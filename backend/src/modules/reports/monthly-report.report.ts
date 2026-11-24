import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import {
  countedTransactions,
  getReportsVersion,
  logReportGeneration,
} from './helpers/report-query.util';
import { dayOf } from './helpers/report-values.util';
import type { MonthlyReport } from './interfaces/monthly-report.interface';
import { TemplateReportRowsLoader } from './template-report-rows.loader';

/** A calendar month: daily trend, category and counterparty shares, and the change from the month before. */
@Injectable()
export class MonthlyReportGenerator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly auditService: AuditService,
    private readonly rowsLoader: TemplateReportRowsLoader,
  ) {}

  /**
   * Generate monthly report
   */
  async generateMonthlyReport(
    workspaceId: string,
    year: number,
    month: number,
    viewerMemberId: string | null = null,
  ): Promise<MonthlyReport> {
    const version = await getReportsVersion(this.cacheManager, workspaceId);
    // Per viewer: the report names the merchants of the viewer's own private rows.
    const cacheKey = `reports:monthly:${workspaceId}:${version}:${viewerMemberId ?? '-'}:${year}:${month}`;
    const cached = await this.cacheManager.get<MonthlyReport>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Get all transactions for the month
    const transactions = await countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .andWhere('transaction.transactionDate >= :start', { start: startDate })
      .andWhere('transaction.transactionDate <= :end', { end: endDate })
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);
    const money = await this.rowsLoader.toWorkspaceCurrency(workspaceId, transactions);

    // Calculate daily trends
    const dailyMap = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const dateKey = dayOf(t.transactionDate);
      const existing = dailyMap.get(dateKey) || { income: 0, expense: 0 };
      if (t.transactionType === TransactionType.INCOME) {
        existing.income += Number(t.amount ?? 0);
      } else {
        existing.expense += Number(t.amount ?? 0);
      }
      dailyMap.set(dateKey, existing);
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate category distribution
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .forEach(t => {
        const categoryId = t.categoryId || 'uncategorized';
        const categoryName = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 };
        categoryMap.set(categoryId, {
          name: categoryName,
          amount: existing.amount + Number(t.amount ?? 0),
          count: existing.count + 1,
        });
      });

    const totalExpense = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.amount, 0);
    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate counterparty distribution
    const counterpartyMap = new Map<string, { amount: number; count: number }>();
    transactions.forEach(t => {
      const existing = counterpartyMap.get(t.counterpartyName) || { amount: 0, count: 0 };
      counterpartyMap.set(t.counterpartyName, {
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const totalAmount = Array.from(counterpartyMap.values()).reduce((sum, c) => sum + c.amount, 0);
    const counterpartyDistribution = Array.from(counterpartyMap.entries())
      .map(([counterpartyName, data]) => ({
        counterpartyName,
        amount: data.amount,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20);

    // Calculate comparison with previous period
    const previousStartDate = new Date(year, month - 2, 1);
    const previousEndDate = new Date(year, month - 1, 0, 23, 59, 59, 999);

    const previousTransactions = await countedTransactions(this.transactionRepository, workspaceId)
      .andWhere('transaction.transactionDate >= :start', { start: previousStartDate })
      .andWhere('transaction.transactionDate <= :end', { end: previousEndDate })
      .getMany();
    await this.rowsLoader.toWorkspaceCurrency(workspaceId, previousTransactions);

    const currentIncome = transactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const currentExpense = transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const currentDifference = currentIncome - currentExpense;

    const previousIncome = previousTransactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const previousExpense = previousTransactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const previousDifference = previousIncome - previousExpense;

    const incomeChange = currentIncome - previousIncome;
    const expenseChange = currentExpense - previousExpense;
    const differenceChange = currentDifference - previousDifference;

    const report: MonthlyReport = {
      month: month.toString(),
      year,
      ...money,
      dailyTrends,
      categoryDistribution,
      counterpartyDistribution,
      comparison: {
        currentPeriod: {
          income: currentIncome,
          expense: currentExpense,
          difference: currentDifference,
        },
        previousPeriod: {
          income: previousIncome,
          expense: previousExpense,
          difference: previousDifference,
        },
        change: {
          incomeChange,
          expenseChange,
          differenceChange,
          incomeChangePercent: previousIncome > 0 ? (incomeChange / previousIncome) * 100 : 0,
          expenseChangePercent: previousExpense > 0 ? (expenseChange / previousExpense) * 100 : 0,
          differenceChangePercent:
            previousDifference !== 0 ? (differenceChange / Math.abs(previousDifference)) * 100 : 0,
        },
      },
      summary: {
        totalIncome: currentIncome,
        totalExpense: currentExpense,
        difference: currentDifference,
        transactionCount: transactions.length,
      },
    };

    // Log to audit
    await logReportGeneration(
      this.auditService,
      workspaceId,
      'monthly',
      `${year}-${month.toString().padStart(2, '0')}`,
    );

    return report;
  }
}

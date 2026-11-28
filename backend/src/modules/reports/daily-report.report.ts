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
import type { DailyReport } from './interfaces/daily-report.interface';
import { TemplateReportRowsLoader } from './template-report-rows.loader';

/** One day's income by counterparty and expense by category; the latest day by default. */
@Injectable()
export class DailyReportGenerator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly auditService: AuditService,
    private readonly rowsLoader: TemplateReportRowsLoader,
  ) {}

  async generateDailyReport(
    workspaceId: string,
    date: string,
    viewerMemberId: string | null = null,
  ): Promise<DailyReport> {
    const version = await getReportsVersion(this.cacheManager, workspaceId);
    // Per viewer: the report names the merchants of the viewer's own private rows.
    const cacheKey = `reports:daily:${workspaceId}:${version}:${viewerMemberId ?? '-'}:${date || 'latest'}`;
    const cached = await this.cacheManager.get<DailyReport>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolvedDate = date || (await this.getLatestTransactionDate(workspaceId));
    const reportDate = resolvedDate ? new Date(resolvedDate) : new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get income transactions
    const incomeTransactions = await countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionType = :type', { type: TransactionType.INCOME })
      .andWhere('transaction.transactionDate >= :start', { start: startOfDay })
      .andWhere('transaction.transactionDate <= :end', { end: endOfDay })
      .getMany();

    // Get expense transactions
    const expenseTransactions = await countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionType = :type', { type: TransactionType.EXPENSE })
      .andWhere('transaction.transactionDate >= :start', { start: startOfDay })
      .andWhere('transaction.transactionDate <= :end', { end: endOfDay })
      .getMany();
    redactPrivateRows(incomeTransactions, viewerMemberId);
    redactPrivateRows(expenseTransactions, viewerMemberId);
    const money = await this.rowsLoader.toWorkspaceCurrency(workspaceId, [
      ...incomeTransactions,
      ...expenseTransactions,
    ]);

    // Calculate income block
    const incomeTotal = incomeTransactions.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const counterpartyMap = new Map<string, { amount: number; count: number }>();
    incomeTransactions.forEach(t => {
      const existing = counterpartyMap.get(t.counterpartyName) || { amount: 0, count: 0 };
      counterpartyMap.set(t.counterpartyName, {
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const topCounterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Calculate expense block
    const expenseTotal = expenseTransactions.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    expenseTransactions.forEach(t => {
      const categoryId = t.categoryId || 'uncategorized';
      const categoryName = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
      const existing = categoryMap.get(categoryId) || { name: categoryName, amount: 0, count: 0 };
      categoryMap.set(categoryId, {
        name: categoryName,
        amount: existing.amount + Number(t.amount ?? 0),
        count: existing.count + 1,
      });
    });

    const topCategories = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const report: DailyReport = {
      date: date,
      ...money,
      income: {
        totalAmount: incomeTotal,
        transactionCount: incomeTransactions.length,
        topCounterparties,
      },
      expense: {
        totalAmount: expenseTotal,
        transactionCount: expenseTransactions.length,
        topCategories,
      },
      summary: {
        incomeTotal,
        expenseTotal,
        difference: incomeTotal - expenseTotal,
      },
    };

    // Log to audit
    await logReportGeneration(this.auditService, workspaceId, 'daily', date);

    return report;
  }

  /**
   * Returns latest transaction date for user (YYYY-MM-DD) and month/year pair
   */
  async getLatestTransactionPeriod(
    workspaceId: string,
  ): Promise<{ date: string | null; year: number | null; month: number | null }> {
    const latest = await this.getLatestTransactionDate(workspaceId);
    if (!latest) {
      return { date: null, year: null, month: null };
    }
    const dt = new Date(latest);
    return {
      date: latest,
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
    };
  }

  /**
   * Latest transaction date in ISO (YYYY-MM-DD) or null
   */
  async getLatestTransactionDate(workspaceId: string): Promise<string | null> {
    const latest = await countedTransactions(this.transactionRepository, workspaceId)
      .orderBy('transaction.transactionDate', 'DESC')
      .select('transaction.transactionDate', 'transactionDate')
      .getRawOne<{ transactionDate: Date | string }>();

    if (!latest?.transactionDate) {
      return null;
    }
    return dayOf(latest.transactionDate);
  }
}

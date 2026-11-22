import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type { CustomReportBody } from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { ReportGroupBy } from './dto/custom-report.dto';
import { countedTransactions, logReportGeneration } from './helpers/report-query.util';
import { dayOf } from './helpers/report-values.util';
import type { CustomReport, CustomReportGroup } from './interfaces/custom-report.interface';

/** Transactions in a date range, filtered and grouped the way the request asks. */
@Injectable()
export class CustomReportGenerator {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generate custom report
   */
  async generateCustomReport(
    workspaceId: string,
    dto: CustomReportBody,
    viewerMemberId: string | null = null,
  ): Promise<CustomReport> {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);

    // Build query
    const queryBuilder = countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.branch', 'branch')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .andWhere('transaction.transactionDate >= :dateFrom', { dateFrom })
      .andWhere('transaction.transactionDate <= :dateTo', { dateTo });

    // Apply filters
    if (dto.categoryId) {
      queryBuilder.andWhere('transaction.categoryId = :categoryId', { categoryId: dto.categoryId });
    }
    if (dto.branchId) {
      queryBuilder.andWhere('transaction.branchId = :branchId', { branchId: dto.branchId });
    }
    if (dto.walletId) {
      queryBuilder.andWhere('transaction.walletId = :walletId', { walletId: dto.walletId });
    }

    const transactions = redactPrivateRows(await queryBuilder.getMany(), viewerMemberId);

    // Group transactions
    const groupMap = new Map<string, CustomReportGroup>();
    const groupBy = dto.groupBy || ReportGroupBy.DAY;

    transactions.forEach(t => {
      let key: string;
      let label: string;

      switch (groupBy) {
        case ReportGroupBy.CATEGORY:
          key = t.categoryId || 'uncategorized';
          label = t.category?.name || UNCATEGORIZED_CATEGORY_NAME;
          break;
        case ReportGroupBy.COUNTERPARTY:
          key = t.counterpartyName;
          label = t.counterpartyName;
          break;
        case ReportGroupBy.BRANCH:
          key = t.branchId || 'unassigned';
          label = t.branch?.name || 'Не назначен';
          break;
        case ReportGroupBy.WALLET:
          key = t.walletId || 'unassigned';
          label = t.wallet?.name || 'Не назначен';
          break;
        case ReportGroupBy.DAY: {
          key = dayOf(t.transactionDate);
          const [year, month, day] = key.split('-');
          label = `${day}.${month}.${year}`;
          break;
        }
        case ReportGroupBy.MONTH: {
          const [year, month] = dayOf(t.transactionDate).split('-');
          key = `${year}-${month}`;
          label = `${month}.${year}`;
          break;
        }
        default:
          key = 'all';
          label = 'Все';
      }

      const existing = groupMap.get(key) || {
        key,
        label,
        totalAmount: 0,
        transactionCount: 0,
        transactions: [],
      };

      existing.totalAmount += Number(t.amount ?? 0);
      existing.transactionCount += 1;
      existing.transactions.push({
        id: t.id,
        date: dayOf(t.transactionDate),
        counterparty: t.counterpartyName,
        amount: Number(t.amount ?? 0),
        category: t.category?.name,
        branch: t.branch?.name,
        wallet: t.wallet?.name,
      });

      groupMap.set(key, existing);
    });

    const groups = Array.from(groupMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    const totalIncome = transactions
      .filter(t => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
    const totalExpense = transactions
      .filter(t => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

    const report: CustomReport = {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      groupBy,
      groups,
      summary: {
        totalIncome,
        totalExpense,
        difference: totalIncome - totalExpense,
        transactionCount: transactions.length,
      },
    };

    // Log to audit
    await logReportGeneration(
      this.auditService,
      workspaceId,
      'custom',
      `${dto.dateFrom}_${dto.dateTo}`,
    );

    return report;
  }
}

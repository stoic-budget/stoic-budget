import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type { TopCategoriesQuery } from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { applyReportFilters } from './helpers/report-filters.util';
import { countedTransactions } from './helpers/report-query.util';
import { round2 } from './helpers/report-values.util';
import type { TopCategoriesReport as TopCategoriesResult } from './interfaces/top-categories-report.interface';
import { TemplateReportRowsLoader } from './template-report-rows.loader';

/** Where the money went: the largest categories, banks and counterparties in a period. */
@Injectable()
export class TopCategoriesReport {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly rowsLoader: TemplateReportRowsLoader,
  ) {}

  async getTopCategoriesReport(
    workspaceId: string,
    query: TopCategoriesQuery,
    selfMemberId: string | null = null,
  ): Promise<TopCategoriesResult> {
    const safeLimit = Number.isFinite(query.limit)
      ? Math.min(Math.max(query.limit || 20, 1), 100)
      : 20;
    const now = new Date();
    const to = query.dateTo ? new Date(query.dateTo) : now;
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(new Date(to).setDate(to.getDate() - 30));

    const qb = countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('transaction.statement', 'statement')
      .andWhere('transaction.transactionDate >= :from', { from })
      .andWhere('transaction.transactionDate <= :to', { to });

    applyReportFilters(qb, query, selfMemberId);

    if (query.has) {
      const hasTokens = query.has
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      if (hasTokens.includes('errors')) {
        qb.andWhere('(statement.status = :errorStatus OR statement.errorMessage IS NOT NULL)', {
          errorStatus: 'error',
        });
      }
      if (hasTokens.includes('transactions')) {
        qb.andWhere('COALESCE(statement.totalTransactions, 0) > 0');
      }
      if (hasTokens.includes('dateRange')) {
        qb.andWhere(
          '(statement.statementDateFrom IS NOT NULL OR statement.statementDateTo IS NOT NULL)',
        );
      }
      if (hasTokens.includes('currency')) {
        qb.andWhere('statement.currency IS NOT NULL');
      }
    }

    // Every row of the period: a cap on the most recently changed ones understated the totals (#598).
    const transactions = redactPrivateRows(
      await qb.orderBy('transaction.updatedAt', 'DESC').getMany(),
      selfMemberId,
    );
    const money = await this.rowsLoader.toWorkspaceCurrency(workspaceId, transactions);

    const totals = {
      income: 0,
      expense: 0,
      net: 0,
      transactions: transactions.length,
    };

    const categoryMap = new Map<
      string,
      {
        id: string | null;
        name: string;
        amount: number;
        transactions: number;
        type: TransactionType;
        color?: string | null;
        icon?: string | null;
      }
    >();
    const bankMap = new Map<string, { bankName: string; amount: number; statements: number }>();
    const counterpartyMap = new Map<
      string,
      {
        name: string;
        amount: number;
        transactions: number;
        type: TransactionType;
      }
    >();

    transactions.forEach(transaction => {
      const amount = Math.abs(Number(transaction.amount || 0));
      if (!amount) {
        return;
      }

      if (transaction.transactionType === TransactionType.INCOME) {
        totals.income += amount;
      } else {
        totals.expense += amount;
      }

      const categoryKey = transaction.category?.id || 'without-category';
      const categoryName =
        (transaction.category?.name || UNCATEGORIZED_CATEGORY_NAME).trim() ||
        UNCATEGORIZED_CATEGORY_NAME;
      const categoryCurrent = categoryMap.get(categoryKey) || {
        id: transaction.category?.id || null,
        name: categoryName,
        amount: 0,
        transactions: 0,
        type: transaction.transactionType,
        color: transaction.category?.color,
        icon: transaction.category?.icon,
      };
      categoryCurrent.amount += amount;
      categoryCurrent.transactions += 1;
      categoryMap.set(categoryKey, categoryCurrent);

      const bankName = (transaction.statement?.bankName || 'Unknown').trim() || 'Unknown';
      const bankCurrent = bankMap.get(bankName) || {
        bankName,
        amount: 0,
        statements: 0,
      };
      bankCurrent.amount += amount;
      bankCurrent.statements += 1;
      bankMap.set(bankName, bankCurrent);

      const counterpartyName =
        (transaction.counterpartyName || 'Без названия').trim() || 'Без названия';
      const counterpartyCurrent = counterpartyMap.get(counterpartyName) || {
        name: counterpartyName,
        amount: 0,
        transactions: 0,
        type: transaction.transactionType,
      };
      counterpartyCurrent.amount += amount;
      counterpartyCurrent.transactions += 1;
      counterpartyMap.set(counterpartyName, counterpartyCurrent);
    });

    // Converted amounts add up with float tails: every figure is to the cent.
    totals.income = round2(totals.income);
    totals.expense = round2(totals.expense);
    totals.net = round2(totals.income - totals.expense);

    const totalFlow = totals.income + totals.expense;
    const categories = Array.from(categoryMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        amount: round2(item.amount),
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    const banks = Array.from(bankMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        amount: round2(item.amount),
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    const counterparties = Array.from(counterpartyMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, safeLimit)
      .map(item => ({
        ...item,
        amount: round2(item.amount),
        percentage: totalFlow > 0 ? Number(((item.amount / totalFlow) * 100).toFixed(2)) : 0,
      }));

    return {
      ...money,
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
      totals,
      categories,
      banks,
      counterparties,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { countedTransactions } from './helpers/report-query.util';
import { round2, toDateKey } from './helpers/report-values.util';
import type { StatementsSummaryResponse } from './interfaces/statements-summary.interface';
import { TemplateReportRowsLoader } from './template-report-rows.loader';

/** Income, expense and their top categories and counterparties over the last `days`. */
@Injectable()
export class StatementsSummaryReport {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly rowsLoader: TemplateReportRowsLoader,
  ) {}

  async getStatementsSummary(
    workspaceId: string,
    days = 30,
    viewerMemberId: string | null = null,
  ): Promise<StatementsSummaryResponse> {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : 30;
    const since = new Date();
    since.setDate(since.getDate() - safeDays);
    since.setHours(0, 0, 0, 0);

    const transactions = await countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .andWhere('transaction.transactionDate >= :since', { since })
      .orderBy('transaction.updatedAt', 'DESC')
      // Every row of the period: a cap on the most recently changed ones understated the totals (#598).
      .getMany();
    redactPrivateRows(transactions, viewerMemberId);
    const money = await this.rowsLoader.toWorkspaceCurrency(workspaceId, transactions);

    const totals = { income: 0, expense: 0, net: 0, rows: transactions.length };
    const timeseriesMap = new Map<string, { income: number; expense: number }>();
    const categoryMap = new Map<string, { amount: number; rows: number }>();
    const counterpartyMap = new Map<string, { amount: number; rows: number }>();

    const recent = transactions
      .slice(0, 50)
      .map(t => {
        const amount = Number(t.amount || 0);
        const abs = Math.abs(amount);
        const signedAmount = t.transactionType === TransactionType.INCOME ? abs : -abs;
        return {
          id: t.id,
          amount: signedAmount,
          category: t.category?.name || null,
          counterparty: t.counterpartyName || null,
          updatedAt: (t.updatedAt || t.createdAt).toISOString(),
        };
      })
      .slice(0, 20);

    transactions.forEach(t => {
      const amount = Number(t.amount || 0);
      const abs = Math.abs(amount);
      const dateKey = toDateKey(t.transactionDate);
      const ts = timeseriesMap.get(dateKey) || { income: 0, expense: 0 };

      if (t.transactionType === TransactionType.INCOME) {
        ts.income += abs;
        const counterparty = (t.counterpartyName || 'Без названия').trim() || 'Без названия';
        const existing = counterpartyMap.get(counterparty) || { amount: 0, rows: 0 };
        counterpartyMap.set(counterparty, {
          amount: existing.amount + abs,
          rows: existing.rows + 1,
        });
        totals.income += abs;
      } else {
        ts.expense += abs;
        const category =
          (t.category?.name || UNCATEGORIZED_CATEGORY_NAME).trim() || UNCATEGORIZED_CATEGORY_NAME;
        const existing = categoryMap.get(category) || { amount: 0, rows: 0 };
        categoryMap.set(category, { amount: existing.amount + abs, rows: existing.rows + 1 });
        totals.expense += abs;
      }

      timeseriesMap.set(dateKey, ts);
    });

    // Converted amounts add up with float tails: every figure is to the cent.
    totals.income = round2(totals.income);
    totals.expense = round2(totals.expense);
    totals.net = round2(totals.income - totals.expense);

    const timeseries = Array.from(timeseriesMap.entries())
      .map(([date, values]) => ({
        date,
        income: round2(values.income),
        expense: round2(values.expense),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, amount: round2(data.amount), rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const counterparties = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, amount: round2(data.amount), rows: data.rows }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return { ...money, totals, timeseries, categories, counterparties, recent };
  }
}

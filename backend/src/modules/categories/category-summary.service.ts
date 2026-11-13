import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { onlyFlows } from '../../common/utils/counted-transactions.util';
import {
  PRIVACY_VIEWER_PARAM,
  readablePrivateSql,
} from '../../common/utils/transaction-privacy.util';
import type { CategorySummary } from '../../contracts';
import { Category, CategoryType } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { lastDayOf, monthsTo } from '../payees/payee-flows';
import { isNettedRefund } from '../reports/refund.util';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { branchesOf, round2, type SummaryRow, summarize } from './category-summary.util';

/**
 * The category page: twelve months of one category and its subcategories,
 * counted the way the reports' cash flow counts a category, so the two agree:
 * `onlyFlows`, no transfers, the debit of an expense or the credit of an
 * income, each converted at its own day's rate, and refunds netted when the
 * Reports switch is on. Another member's private rows
 * count (they sit in the Private category for everybody), but never name a
 * payee.
 */
@Injectable()
export class CategorySummaryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  async summary(
    workspaceId: string,
    categoryId: string,
    viewerMemberId: string | null,
    netRefunds = false,
    today = new Date().toISOString().slice(0, 10),
  ): Promise<CategorySummary> {
    const categories = await this.categoryRepository.find({
      where: { workspaceId },
      select: { id: true, name: true, parentId: true, type: true },
    });
    const root = categories.find(category => category.id === categoryId);
    if (!root) {
      throw new NotFoundException(appError('CATEGORY_NOT_FOUND'));
    }
    const nodes = categories.map(({ id, name, parentId }) => ({
      id,
      name,
      parentId: parentId ?? null,
    }));
    const income = root.type === CategoryType.INCOME;
    const months = monthsTo(new Date(today)).reverse();
    const expenseCategories = new Set(
      categories.filter(category => category.type === CategoryType.EXPENSE).map(({ id }) => id),
    );

    // Both directions: the other one is either a netted refund or named apart.
    const query = this.transactionRepository
      .createQueryBuilder('transaction')
      .select(`to_char(transaction.transactionDate, 'YYYY-MM-DD')`, 'day')
      .addSelect('transaction.transactionType', 'type')
      .addSelect('transaction.currency', 'currency')
      .addSelect('transaction.categoryId', 'categoryId')
      .addSelect(
        `CASE WHEN ${readablePrivateSql('transaction')} THEN transaction.payeeId END`,
        'payeeId',
      )
      .addSelect('COUNT(*)', 'count')
      // The debit of an expense, the credit of an income, as the reports read them.
      .addSelect(
        `SUM(ABS(COALESCE(CASE WHEN transaction.transactionType = :income THEN transaction.credit ELSE transaction.debit END, 0)))`,
        'amount',
      )
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.categoryId IN (:...ids)', {
        ids: [...branchesOf(root.id, nodes).keys()],
      })
      .andWhere('transaction.transferPairId IS NULL')
      .andWhere('transaction.transactionDate >= :first', { first: `${months[0]}-01` })
      .andWhere('transaction.transactionDate <= :last', { last: lastDayOf(months[11]) })
      .setParameter('income', TransactionType.INCOME)
      .setParameter(PRIVACY_VIEWER_PARAM, viewerMemberId);
    const raw = await onlyFlows(query, 'transaction')
      .groupBy('1')
      .addGroupBy('2')
      .addGroupBy('3')
      .addGroupBy('4')
      .addGroupBy('5')
      .getRawMany<{
        day: string;
        type: TransactionType;
        currency: string;
        categoryId: string;
        payeeId: string | null;
        count: string;
        amount: string;
      }>();

    const target = normalizeCurrencyCode(await this.workspaceCurrency.resolve(workspaceId));
    const converter = await CurrencyConverter.load(
      this.exchangeRates,
      target,
      raw.map(row => ({ currency: normalizeCurrencyCode(row.currency), date: row.day })),
      workspaceId,
    );
    const direction = income ? TransactionType.INCOME : TransactionType.EXPENSE;
    const rows: SummaryRow[] = [];
    let otherDirection = 0;
    for (const row of raw) {
      const amount = converter.convert(
        Number(row.amount),
        normalizeCurrencyCode(row.currency),
        row.day,
      );
      const refund = isNettedRefund(
        {
          type: row.type === TransactionType.INCOME ? 'income' : 'expense',
          isTransfer: false,
          categoryId: row.categoryId,
        },
        netRefunds,
        id => expenseCategories.has(id),
      );
      if (row.type === direction || refund) {
        rows.push({
          day: row.day,
          categoryId: row.categoryId,
          payeeId: row.payeeId,
          count: Number(row.count),
          amount: refund ? -amount : amount,
        });
      } else {
        otherDirection += amount;
      }
    }

    const payeeIds = [...new Set(rows.flatMap(row => (row.payeeId ? [row.payeeId] : [])))];
    const payees = payeeIds.length
      ? await this.transactionRepository.manager.find(Payee, {
          where: { id: In(payeeIds), workspaceId },
          select: { id: true, name: true },
        })
      : [];

    return {
      currency: target,
      direction: income ? 'income' : 'expense',
      ...summarize(
        nodes.find(node => node.id === root.id) as (typeof nodes)[number],
        nodes,
        rows,
        months,
        new Map(payees.map(payee => [payee.id, payee.name])),
      ),
      otherDirection: otherDirection > 0 ? { amount: round2(otherDirection) } : null,
      missingRates: converter.missing,
    };
  }
}

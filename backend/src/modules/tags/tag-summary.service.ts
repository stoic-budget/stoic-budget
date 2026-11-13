import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { TagSummary } from '../../contracts';
import { Category } from '../../entities/category.entity';
import { Payee } from '../../entities/payee.entity';
import { Tag } from '../../entities/tag.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { buildRateMap, convertWith, normalizeCurrency } from '../goals/goal-money.util';
import { countedFlowsQuery, perTag } from '../reports/tag-flows.util';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { summarizeTag } from './tag-summary.util';

interface RawRow {
  day: string;
  type: TransactionType;
  currency: string | null;
  categoryId: string | null;
  payeeId: string | null;
  count: string;
  amount: string;
}

/**
 * The tag page: everything a tag ever counted, read through the same query
 * and the same conversion as Reports' By tag, so the page and the report show
 * one total for the same days. Reports' By tag does not net refunds, so
 * neither does this page: money back on a trip is received, and lowers the net.
 */
@Injectable()
export class TagSummaryService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  async summary(
    workspaceId: string,
    tagId: string,
    viewerMemberId: string | null,
  ): Promise<TagSummary> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId, workspaceId } });
    if (!tag) {
      throw new NotFoundException(appError('STORAGE_TAG_NOT_FOUND'));
    }

    const raw = await perTag(
      countedFlowsQuery(this.transactionRepository, workspaceId, viewerMemberId),
    )
      .andWhere('tp.tag_id = :tagId', { tagId })
      .andWhere('t.transaction_type IN (:...types)', {
        types: [TransactionType.INCOME, TransactionType.EXPENSE],
      })
      .select(`to_char(t.transaction_date, 'YYYY-MM-DD')`, 'day')
      .addSelect('t.transaction_type', 'type')
      .addSelect('t.currency', 'currency')
      .addSelect('t.category_id', 'categoryId')
      .addSelect('t.payee_id', 'payeeId')
      .addSelect('COUNT(*)', 'count')
      // The amount Reports' By tag sums.
      .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'amount')
      .groupBy('1')
      .addGroupBy('2')
      .addGroupBy('3')
      .addGroupBy('4')
      .addGroupBy('5')
      .getRawMany<RawRow>();

    const target = normalizeCurrency(await this.workspaceCurrency.resolve(workspaceId));
    const rates = await buildRateMap(
      this.exchangeRates,
      raw.map(row => normalizeCurrency(row.currency ?? target)),
      target,
      workspaceId,
    );
    const missingRates = new Set<string>();
    const rows = raw.map(row => {
      const currency = normalizeCurrency(row.currency ?? target);
      if (!rates.has(currency)) {
        missingRates.add(currency);
      }
      return {
        day: row.day,
        type: row.type === TransactionType.INCOME ? ('income' as const) : ('expense' as const),
        categoryId: row.categoryId,
        payeeId: row.payeeId,
        count: Number(row.count),
        amount: convertWith(rates, row.amount, currency),
      };
    });

    const categoryIds = [...new Set(rows.flatMap(row => (row.categoryId ? [row.categoryId] : [])))];
    const payeeIds = [...new Set(rows.flatMap(row => (row.payeeId ? [row.payeeId] : [])))];
    const [categories, payees] = await Promise.all([
      categoryIds.length
        ? this.tagRepository.manager.find(Category, {
            where: { id: In(categoryIds), workspaceId },
            select: { id: true, name: true },
          })
        : [],
      payeeIds.length
        ? this.tagRepository.manager.find(Payee, {
            where: { id: In(payeeIds), workspaceId },
            select: { id: true, name: true },
          })
        : [],
    ]);

    return {
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color ?? null,
        description: tag.description ?? null,
        tagDate: tag.tagDate ?? null,
      },
      currency: target,
      ...summarizeTag(rows, {
        categories: new Map(categories.map(category => [category.id, category.name])),
        payees: new Map(payees.map(payee => [payee.id, payee.name])),
      }),
      missingRates: [...missingRates].sort(),
    };
  }
}

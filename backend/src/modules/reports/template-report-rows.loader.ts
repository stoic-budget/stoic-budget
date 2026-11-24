import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type { GenerateReportBody } from '../../contracts';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import {
  type DayConvert,
  loadDayConverter,
  loadDayRangeConverter,
} from '../exchange-rates/day-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { countedTransactions } from './helpers/report-query.util';
import { round2, toDateKey } from './helpers/report-values.util';
import type { TemplateReportRow } from './report-template.types';

/** The rows a template report reads, converted into the workspace currency. */
@Injectable()
export class TemplateReportRowsLoader {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  private normalizeCurrency(currency: string | null | undefined): string {
    return currencyCodeOrDefault(currency);
  }

  async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    return this.normalizeCurrency(workspace?.currency);
  }

  /**
   * Puts loaded rows' amounts into the workspace's currency, each at its own
   * day's rate, so a report sums one currency (#598): 100 USD and 100 EUR are
   * not "200". A row in a currency with no rate counts 0 and its currency is
   * named. The rows are the report's own copies and are never saved.
   */
  async toWorkspaceCurrency(
    workspaceId: string,
    rows: Transaction[],
  ): Promise<{ currency: string; missingRates: string[] }> {
    const { currency, convert } = await this.dayConverter(
      workspaceId,
      rows.map(row => ({ currency: row.currency, day: toDateKey(row.transactionDate) })),
    );
    for (const row of rows) {
      row.amount = round2(convert(row.amount, row.currency, toDateKey(row.transactionDate)));
    }
    return { currency, missingRates: convert.missing };
  }

  /** Converts sums read per currency and day into the workspace's currency. */
  async dayConverter(
    workspaceId: string,
    needed: Array<{ currency: string | null | undefined; day: string }>,
  ): Promise<{ currency: string; convert: DayConvert }> {
    const currency = await this.getWorkspaceCurrency(workspaceId);
    // Past a month of days, one rate curve per currency: per-day lookups over
    // years of rows are thousands of round trips.
    const load =
      new Set(needed.map(row => row.day)).size > 31 ? loadDayRangeConverter : loadDayConverter;
    return {
      currency,
      convert: await load(this.exchangeRatesService, currency, needed, workspaceId),
    };
  }

  async loadReportRows(
    workspaceId: string,
    dto: GenerateReportBody,
  ): Promise<{ currency: string; rows: TemplateReportRow[]; missingRates: string[] }> {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = new Date(dto.dateTo);
    dateTo.setUTCHours(23, 59, 59, 999);

    // The same rows every other figure counts (transfers already left out).
    // Category group, account and tags are register columns of the templates.
    const query = countedTransactions(this.transactionRepository, workspaceId)
      .leftJoinAndSelect('transaction.category', 'category')
      .leftJoinAndSelect('category.parent', 'categoryParent')
      .leftJoinAndSelect('transaction.wallet', 'wallet')
      .leftJoinAndSelect('transaction.tags', 'tags')
      .andWhere('transaction.transactionDate BETWEEN :dateFrom AND :dateTo', { dateFrom, dateTo });
    // An empty list would compile to `IN ()` and match nothing: an unset filter adds no condition.
    if (dto.walletIds?.length) {
      query.andWhere('transaction.walletId IN (:...walletIds)', { walletIds: dto.walletIds });
    }
    if (dto.categoryIds?.length) {
      query.andWhere('transaction.categoryId IN (:...categoryIds)', {
        categoryIds: dto.categoryIds,
      });
    }
    const [transactions, currency] = await Promise.all([
      query.getMany(),
      this.getWorkspaceCurrency(workspaceId),
    ]);
    // A generated report stays in the workspace's history and schedules e-mail
    // it, so it carries nobody's private details — its author's included, and
    // the preview shows what the file will.
    redactPrivateRows(transactions, null);

    // Each amount converts at its own day's rate, and a currency without one is
    // left out rather than counted 1:1 — a silent 1:1 would turn 1,000 USD into
    // 1,000 KZT in a document someone sends to their accountant.
    const rows: TemplateReportRow[] = transactions.map(transaction => {
      const categoryName = transaction.category?.name || UNCATEGORIZED_CATEGORY_NAME;
      return {
        id: transaction.id,
        date: toDateKey(transaction.transactionDate),
        categoryKey: transaction.categoryId ?? '',
        categoryName,
        groupName: transaction.category?.parent?.name ?? '',
        counterparty: transaction.counterpartyName || '',
        accountName: transaction.wallet?.name ?? '',
        comment: transaction.comments ?? '',
        tags: (transaction.tags ?? []).map(tag => tag.name),
        isIncome: transaction.transactionType === TransactionType.INCOME,
        amount: 0,
        originalAmount: Math.abs(Number(transaction.amount || 0)),
        originalCurrency: normalizeCurrencyCode(transaction.currency),
      };
    });

    const converter = await CurrencyConverter.load(
      this.exchangeRatesService,
      currency,
      rows.map(row => ({ currency: row.originalCurrency, date: row.date })),
      workspaceId,
    );
    for (const row of rows) {
      row.amount = converter.convert(row.originalAmount, row.originalCurrency, row.date);
    }

    return { currency, rows, missingRates: converter.missing };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { onlyCounted } from '../../common/utils/counted-transactions.util';
import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';
import { Category } from '../../entities/category.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { VatStatus, Workspace } from '../../entities/workspace.entity';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { toDateOnly } from './jurisdictions.service';
import { salesCategorySql } from './sales-categories';
import { TaxReturnsService } from './tax-returns.service';
import { WorkspaceTaxSettingsService } from './workspace-tax-settings.service';

/** Income that is not earnings: moving money, borrowing, wages already taxed at source, tax refunds. */
const NOT_EARNINGS: ReadonlySet<string> = new Set(['transfer', 'loan', 'salary', 'tax']);

export interface TaxReserve {
  /** The workspace currency; every figure below is in it. */
  currency: string;
  year: number;
  asOf: string;
  /**
   * VAT of the year so far: collected minus reclaimable. NULL when the
   * workspace does not charge VAT or has no country.
   */
  vat: { net: number; outputTax: number; inputTax: number } | null;
  /** The user's share of the year's earnings, NULL until a share is set. */
  incomeTax: { percent: number; earnings: number; amount: number } | null;
  /** Tax of the years before still unpaid on last 31 December: owed this year as well. */
  carriedOver: number;
  /** Tax already paid this year, read from the payments category. */
  payments: { categoryId: string | null; amount: number; count: number };
  /** What should still be held back: VAT + share of earnings + carried over − payments, never below zero. */
  total: number;
  /** Currencies whose rows were left out for want of an exchange rate. */
  missingRateCurrencies: string[];
}

/**
 * How much of the money in the account is really the tax office's.
 *
 * Counted over the calendar year so far: the VAT the year collected, plus the
 * user's share of what the year earned, plus what last year left unpaid at its
 * end (a running balance since the books began), minus every tax payment the
 * year has already made. Paying a quarterly VAT return or an income-tax advance lowers
 * the reserve by exactly what left the account, so the reserve and the
 * balance never count the same money twice.
 *
 * It is an amount set aside by the user's own rule, not a tax calculation:
 * the share is theirs, and so is the category their tax payments go to.
 */
@Injectable()
export class TaxReserveService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly taxReturnsService: TaxReturnsService,
    private readonly settingsService: WorkspaceTaxSettingsService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  async getReserve(workspaceId: string, today: Date = new Date()): Promise<TaxReserve> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: { taxJurisdiction: true },
    });
    const currency = (workspace?.currency ?? 'EUR').toUpperCase();
    const year = today.getFullYear();
    const yearStart = `${year}-01-01`;
    const asOf = toDateOnly(today);
    const settings = await this.settingsService.getReserveSettings(workspaceId);
    const missing = new Set<string>();
    const convert = this.converter(workspaceId, currency, missing);
    const registered =
      workspace?.vatStatus === VatStatus.REGISTERED && Boolean(workspace.taxJurisdiction);

    const thisYear = await this.held(
      workspaceId,
      settings,
      registered,
      yearStart,
      asOf,
      convert,
      missing,
    );
    // One running balance: what the books owed before this year, less every
    // payment in that time, is owed now too. So a January payment of last
    // year's tax settles that first, not this year's, and the same holds every
    // year after (each January pays the year before). It starts the year before
    // the reserve was set up (that year's tax may still be due), never before
    // the books: today's share is not laid over years the user never kept it for.
    const setUp = await this.settingsService.reserveSetUpOn(workspaceId);
    const firstYear = Math.max(
      (await this.firstBookYear(workspaceId)) ?? year,
      (setUp?.getFullYear() ?? year) - 1,
    );
    let carriedOver = 0;
    if (firstYear < year) {
      const before = await this.held(
        workspaceId,
        settings,
        registered,
        `${firstYear}-01-01`,
        `${year - 1}-12-31`,
        convert,
        missing,
      );
      const owedBefore = (before.vat?.net ?? 0) + (before.incomeTax?.amount ?? 0);
      carriedOver = round(Math.max(0, owedBefore - before.payments.amount));
    }

    const { vat, incomeTax, payments } = thisYear;
    const owed = (vat?.net ?? 0) + (incomeTax?.amount ?? 0) + carriedOver;
    return {
      currency,
      year,
      asOf,
      vat,
      incomeTax,
      carriedOver,
      payments: { categoryId: settings.paymentsCategoryId, ...payments },
      // Nothing to hold back when nothing was set up: no VAT and no share.
      total: vat || incomeTax ? round(Math.max(0, owed - payments.amount)) : 0,
      missingRateCurrencies: [...missing],
    };
  }

  /** What a stretch of time owes in tax (VAT, the user's share of earnings) and paid. */
  private async held(
    workspaceId: string,
    settings: { percent: number | null; paymentsCategoryId: string | null },
    registered: boolean,
    from: string,
    to: string,
    convert: Converter,
    missing: Set<string>,
  ): Promise<{
    vat: TaxReserve['vat'];
    incomeTax: TaxReserve['incomeTax'];
    payments: { amount: number; count: number };
  }> {
    let vat: TaxReserve['vat'] = null;
    if (registered) {
      const totals = await this.taxReturnsService.computeTotals(workspaceId, from, to);
      for (const row of totals.missingRates) {
        missing.add(row.currency);
      }
      const factor = (await convert(1, totals.currency, to)) ?? 0;
      vat = {
        outputTax: round(totals.outputTax * factor),
        inputTax: round(totals.inputTax * factor),
        net: round(totals.netPayable * factor),
      };
    }

    let incomeTax: TaxReserve['incomeTax'] = null;
    if (settings.percent !== null) {
      const earnings = await this.earnings(workspaceId, from, to, convert);
      incomeTax = {
        percent: settings.percent,
        earnings,
        amount: round((earnings * settings.percent) / 100),
      };
    }

    const payments = await this.payments(
      workspaceId,
      settings.paymentsCategoryId,
      from,
      to,
      convert,
    );
    return { vat, incomeTax, payments };
  }

  /** The year's earnings, net of the VAT they carried. */
  private async earnings(
    workspaceId: string,
    from: string,
    to: string,
    convert: Converter,
  ): Promise<number> {
    const rows = await this.yearRows(workspaceId, from, to)
      .andWhere('t.transactionType = :income', { income: TransactionType.INCOME })
      .andWhere('(t.transactionNature IS NULL OR t.transactionNature NOT IN (:...natures))', {
        natures: [...NOT_EARNINGS],
      })
      // Earned: not wages, not a loan or a transfer left in Uncategorized. Interest
      // is income here, and a client payment recorded with no category counts.
      .andWhere(salesCategorySql('t', { interest: true, uncategorizedRows: true }))
      .getMany();

    let total = 0;
    for (const row of rows) {
      const gross = Math.abs(Number(row.amount ?? row.credit ?? 0));
      // VAT collected is the tax office's money, counted on the VAT side.
      const amount =
        row.taxAmount !== null && row.taxNetAmount !== null && !row.taxReverseCharge
          ? Math.abs(Number(row.taxNetAmount))
          : gross;
      const converted = await convert(amount, row.currency, toDateOnly(row.transactionDate));
      total += converted ?? 0;
    }
    return round(total);
  }

  private async payments(
    workspaceId: string,
    categoryId: string | null,
    from: string,
    to: string,
    convert: Converter,
  ): Promise<{ amount: number; count: number }> {
    if (!categoryId) {
      return { amount: 0, count: 0 };
    }
    const children = await this.categoryRepository.find({
      where: { workspaceId, parentId: categoryId },
      select: { id: true },
    });
    const rows = await this.yearRows(workspaceId, from, to)
      .andWhere('t.transactionType = :expense', { expense: TransactionType.EXPENSE })
      .andWhere('t.categoryId IN (:...categoryIds)', {
        categoryIds: [categoryId, ...children.map(child => child.id)],
      })
      .getMany();

    let total = 0;
    for (const row of rows) {
      const amount = Math.abs(Number(row.amount ?? row.debit ?? 0));
      total += (await convert(amount, row.currency, toDateOnly(row.transactionDate))) ?? 0;
    }
    return { amount: round(total), count: rows.length };
  }

  /** The year of the first counted row: where the books, and so the balance, begin. */
  private async firstBookYear(workspaceId: string): Promise<number | null> {
    const row = await onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .select('MIN(t.transactionDate)', 'first')
        .where('t.workspaceId = :workspaceId', { workspaceId }),
      't',
    ).getRawOne<{ first: string | Date | null }>();
    if (!row?.first) {
      return null;
    }
    return Number(toDateOnly(row.first).slice(0, 4));
  }

  private yearRows(workspaceId: string, from: string, to: string) {
    return onlyCounted(
      this.transactionRepository
        .createQueryBuilder('t')
        .where('t.workspaceId = :workspaceId', { workspaceId })
        .andWhere('t.transferPairId IS NULL')
        .andWhere('t.transactionDate BETWEEN :from AND :to', { from, to }),
      't',
    );
  }

  /** Converts at the rate of the row's own day; a missing rate is recorded, not guessed. */
  private converter(workspaceId: string, to: string, missing: Set<string>): Converter {
    const cache = new Map<string, number | null>();
    return async (amount, from, date) => {
      const source = (from || to).toUpperCase();
      if (source === to) {
        return amount;
      }
      const key = `${source}:${date}`;
      if (!cache.has(key)) {
        cache.set(
          key,
          await this.exchangeRatesService.getRateOrNull(source, to, date, workspaceId),
        );
      }
      const rate = cache.get(key) ?? null;
      if (rate === null) {
        missing.add(source);
        return null;
      }
      return amount * rate;
    };
  }
}

type Converter = (amount: number, from: string, date: string) => Promise<number | null>;

function round(value: number): number {
  return fromMinor(roundHalfAwayFromZero(toMinor(value)));
}

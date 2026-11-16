import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type {
  CustomReportBody,
  CustomTablesReportBody,
  CustomTablesReportDrillDownBody,
  CustomTablesSummaryBody,
  ExportReportBody,
  GenerateReportBody,
  SpendOverTimeQuery,
  TopCategoriesQuery,
} from '../../contracts';
import { ReportHistory } from '../../entities/report-history.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Workspace } from '../../entities/workspace.entity';
import { BalanceService } from '../balance/balance.service';
import { BalanceExportFormat } from '../balance/dto/export-balance.dto';
import { UNCATEGORIZED_CATEGORY_NAME } from '../categories/uncategorized-category';
import { CurrencyConverter, normalizeCurrencyCode } from '../exchange-rates/currency-converter';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { BudgetVsActualReport } from './budget-vs-actual.report';
import { CustomReportGenerator } from './custom-report.report';
import { CustomTablesDrillDownReport } from './custom-tables-drilldown.report';
import { CustomTablesReport } from './custom-tables-report.report';
import { CustomTablesSummaryReport } from './custom-tables-summary.report';
import { DailyReportGenerator } from './daily-report.report';
import { ExportFormat } from './dto/export-report.dto';
import { WorkspaceExportFormat } from './dto/workspace-export.dto';
import { exportToCSV, exportToExcel } from './helpers/report-export-writers.util';
import { countedTransactions } from './helpers/report-query.util';
import { round2, toDateKey } from './helpers/report-values.util';
import { resolveReportsDir } from './helpers/reports-dir.util';
import { HoldingsSnapshotReport } from './holdings-snapshot.report';
import type { CustomReport } from './interfaces/custom-report.interface';
import type {
  AvailableCustomTable,
  CustomTablesReportDrillDownResponse,
  CustomTablesReportResponse,
  CustomTablesSummaryResponse,
} from './interfaces/custom-tables-report.interface';
import type { DailyReport } from './interfaces/daily-report.interface';
import type { MonthlyReport } from './interfaces/monthly-report.interface';
import type { SpendOverTimeResult } from './interfaces/spend-over-time.interface';
import type { StatementsSummaryResponse } from './interfaces/statements-summary.interface';
import type { TopCategoriesReport as TopCategoriesResult } from './interfaces/top-categories-report.interface';
import { MonthlyReportGenerator } from './monthly-report.report';
import {
  type ReportCell,
  type ReportDocument,
  type ReportFile,
  type ReportFileFormat,
  writeReportFile,
} from './report-document.util';
import { ReportHistoryService } from './report-history.service';
import { fillLabel, renderTemplateLabels } from './report-template.translations';
import type { TemplateLabels, TemplateReportRow } from './report-template.types';
import { SpendOverTimeReport } from './spend-over-time.report';
import { StatementsSummaryReport } from './statements-summary.report';
import { TopCategoriesReport } from './top-categories.report';
import { WorkspaceExportReport } from './workspace-export.report';

/**
 * Where a category sorts: under its group, or — for a top-level category,
 * whose group cell is empty — under its own name, so it sits beside its children.
 */
function groupSortKey(entry: { groupName: string; categoryName: string }): string {
  return entry.groupName || entry.categoryName;
}

/**
 * Largest group first and largest category first within it: a flat category
 * tree reads as before, largest first, and a nested one keeps groups together.
 */
function byGroupThenAmount<T extends { groupName: string; categoryName: string; total: number }>(
  entries: T[],
): T[] {
  const groupTotal = new Map<string, number>();
  for (const entry of entries) {
    const key = groupSortKey(entry);
    groupTotal.set(key, (groupTotal.get(key) ?? 0) + entry.total);
  }
  return [...entries].sort(
    (a, b) =>
      (groupTotal.get(groupSortKey(b)) ?? 0) - (groupTotal.get(groupSortKey(a)) ?? 0) ||
      groupSortKey(a).localeCompare(groupSortKey(b)) ||
      b.total - a.total,
  );
}

interface CategoryTotal {
  groupName: string;
  categoryName: string;
  total: number;
  count: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepo: Repository<ReportHistory>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly balanceService: BalanceService,
    private readonly budgetVsActualReport: BudgetVsActualReport,
    private readonly holdingsSnapshotReport: HoldingsSnapshotReport,
    private readonly customTablesSummaryReport: CustomTablesSummaryReport,
    private readonly customTablesReport: CustomTablesReport,
    private readonly customTablesDrillDownReport: CustomTablesDrillDownReport,
    private readonly dailyReportGenerator: DailyReportGenerator,
    private readonly monthlyReportGenerator: MonthlyReportGenerator,
    private readonly customReportGenerator: CustomReportGenerator,
    private readonly statementsSummaryReport: StatementsSummaryReport,
    private readonly reportHistoryService: ReportHistoryService,
    private readonly workspaceExportReport: WorkspaceExportReport,
    private readonly topCategoriesReport: TopCategoriesReport,
    private readonly spendOverTimeReport: SpendOverTimeReport,
  ) {}

  getCustomTablesSummary(
    workspaceId: string,
    dto: CustomTablesSummaryBody,
  ): Promise<CustomTablesSummaryResponse> {
    return this.customTablesSummaryReport.getCustomTablesSummary(workspaceId, dto);
  }

  getCustomTablesReport(
    workspaceId: string,
    dto: CustomTablesReportBody,
  ): Promise<CustomTablesReportResponse> {
    return this.customTablesReport.getCustomTablesReport(workspaceId, dto);
  }

  getCustomTablesReportDrillDown(
    workspaceId: string,
    dto: CustomTablesReportDrillDownBody,
  ): Promise<CustomTablesReportDrillDownResponse> {
    return this.customTablesDrillDownReport.getCustomTablesReportDrillDown(workspaceId, dto);
  }

  getAvailableCustomTables(workspaceId: string): Promise<AvailableCustomTable[]> {
    return this.customTablesSummaryReport.getAvailableCustomTables(workspaceId);
  }

  generateDailyReport(
    workspaceId: string,
    date: string,
    viewerMemberId: string | null = null,
  ): Promise<DailyReport> {
    return this.dailyReportGenerator.generateDailyReport(workspaceId, date, viewerMemberId);
  }

  generateMonthlyReport(
    workspaceId: string,
    year: number,
    month: number,
    viewerMemberId: string | null = null,
  ): Promise<MonthlyReport> {
    return this.monthlyReportGenerator.generateMonthlyReport(
      workspaceId,
      year,
      month,
      viewerMemberId,
    );
  }

  getLatestTransactionPeriod(
    workspaceId: string,
  ): Promise<{ date: string | null; year: number | null; month: number | null }> {
    return this.dailyReportGenerator.getLatestTransactionPeriod(workspaceId);
  }

  getLatestTransactionDate(workspaceId: string): Promise<string | null> {
    return this.dailyReportGenerator.getLatestTransactionDate(workspaceId);
  }

  generateCustomReport(
    workspaceId: string,
    dto: CustomReportBody,
    viewerMemberId: string | null = null,
  ): Promise<CustomReport> {
    return this.customReportGenerator.generateCustomReport(workspaceId, dto, viewerMemberId);
  }

  /**
   * Export report to Excel or CSV
   */
  async exportReport(
    workspaceId: string,
    dto: ExportReportBody,
    reportData: DailyReport | MonthlyReport | CustomReport,
    locale?: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report-${timestamp}.${dto.format === ExportFormat.EXCEL ? 'xlsx' : 'csv'}`;
    const filePath = path.join(resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);

    if (dto.format === ExportFormat.EXCEL) {
      await exportToExcel(reportData, filePath, locale);
    } else {
      await exportToCSV(reportData, filePath, locale);
    }

    return { filePath, fileName };
  }

  exportWorkspaceTransactions(
    workspaceId: string,
    format: WorkspaceExportFormat,
    viewerMemberId: string | null = null,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    return this.workspaceExportReport.exportWorkspaceTransactions(
      workspaceId,
      format,
      viewerMemberId,
    );
  }

  getStatementsSummary(
    workspaceId: string,
    days = 30,
    viewerMemberId: string | null = null,
  ): Promise<StatementsSummaryResponse> {
    return this.statementsSummaryReport.getStatementsSummary(workspaceId, days, viewerMemberId);
  }

  getTopCategoriesReport(
    workspaceId: string,
    query: TopCategoriesQuery,
    selfMemberId: string | null = null,
  ): Promise<TopCategoriesResult> {
    return this.topCategoriesReport.getTopCategoriesReport(workspaceId, query, selfMemberId);
  }

  getSpendOverTimeReport(
    workspaceId: string,
    query: SpendOverTimeQuery,
    selfMemberId: string | null = null,
  ): Promise<SpendOverTimeResult> {
    return this.spendOverTimeReport.getSpendOverTimeReport(workspaceId, query, selfMemberId);
  }

  /** Display names persisted on report history rows. */
  private static readonly TEMPLATE_NAMES: Record<string, string> = {
    pnl: 'Profit & Loss (P&L)',
    'cash-flow': 'Cash Flow Statement',
    'expense-by-category': 'Expense by Category',
    'balance-sheet': 'Balance Sheet',
    'transaction-register': 'Transaction Register',
    'monthly-summary': 'Monthly Summary',
    'category-by-month': 'Categories by Month',
    'budget-vs-actual': 'Budget vs Actual',
    'investment-holdings': 'Investment Holdings',
  };

  /**
   * A month per column: past a year a PDF page cannot hold the table legibly,
   * and past three years a spreadsheet is the wrong place to read it too.
   */
  private static readonly MAX_MONTHS = { pdf: 12, other: 36 };

  /** The formats each template can be written in; the Balance Sheet has no CSV renderer. */
  private static readonly TEMPLATE_FORMATS: Record<string, readonly ReportFileFormat[]> = {
    'balance-sheet': ['pdf', 'excel'],
  };

  /**
   * Rejects a template or format the generator cannot produce. Schedules call
   * this when they are created, so a bad pair fails at once rather than on
   * its first run days later.
   */
  static assertTemplateFormat(templateId: string, format: string): void {
    const template = ReportsService.TEMPLATE_NAMES[templateId];
    if (!template) {
      throw new BadRequestException(appError('REPORT_TEMPLATE_UNKNOWN', { id: templateId }));
    }
    const formats = ReportsService.TEMPLATE_FORMATS[templateId] ?? ['pdf', 'excel', 'csv'];
    if (!formats.includes(format as ReportFileFormat)) {
      throw new BadRequestException(
        appError('REPORT_TEMPLATE_FORMATS', { template, formats: formats.join(' and ') }),
      );
    }
  }

  async generateFromTemplate(
    workspaceId: string,
    userId: string,
    dto: GenerateReportBody,
  ): Promise<ReportFile> {
    ReportsService.assertTemplateFormat(dto.templateId, dto.format);
    const templateName = ReportsService.TEMPLATE_NAMES[dto.templateId];

    const baseName = `${dto.templateId}-${dto.dateFrom}-${dto.dateTo}`;
    const file =
      dto.templateId === 'balance-sheet'
        ? await this.writeBalanceSheetFile(workspaceId, dto, baseName)
        : await writeReportFile(
            await this.buildTemplateDocument(workspaceId, dto),
            dto.format as ReportFileFormat,
            baseName,
            resolveReportsDir(workspaceId),
          );

    await this.reportHistoryRepo.save({
      workspaceId,
      userId,
      templateId: dto.templateId,
      templateName,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      format: dto.format,
      fileName: file.fileName,
      filePath: file.filePath,
      fileSize: fs.statSync(file.filePath).size,
    });

    return file;
  }

  /**
   * The document behind a report, without writing a file. Costs one query, so the
   * generator can show what it is about to download.
   */
  async previewTemplate(
    workspaceId: string,
    dto: GenerateReportBody,
    maxRowsPerSection = 20,
  ): Promise<ReportDocument & { truncated: boolean }> {
    if (!ReportsService.TEMPLATE_NAMES[dto.templateId]) {
      throw new BadRequestException(appError('REPORT_TEMPLATE_UNKNOWN', { id: dto.templateId }));
    }
    if (dto.templateId === 'balance-sheet') {
      throw new BadRequestException(appError('REPORT_BALANCE_SHEET_ON_SCREEN'));
    }

    const document = await this.buildTemplateDocument(workspaceId, dto);
    const truncated = document.sections.some(section => section.rows.length > maxRowsPerSection);

    return {
      ...document,
      truncated,
      sections: document.sections.map(section => ({
        ...section,
        rows: section.rows.slice(0, maxRowsPerSection),
      })),
    };
  }

  /**
   * Balance Sheet reuses BalanceService's own renderers, which localize account
   * names from the account tree — a generic table would lose that.
   */
  private async writeBalanceSheetFile(
    workspaceId: string,
    dto: GenerateReportBody,
    baseName: string,
  ): Promise<ReportFile> {
    // The chart of accounts is named in ru, en and kk only; any other reader
    // gets English rather than Russian account names under English headers.
    const locale = dto.locale === 'ru' || dto.locale === 'kk' ? dto.locale : 'en';
    const payload = await this.balanceService.exportBalanceSheet(
      workspaceId,
      { date: dto.dateTo, format: dto.format as BalanceExportFormat },
      locale,
    );

    const fileName = `${baseName}.${dto.format === 'pdf' ? 'pdf' : 'xlsx'}`;
    const filePath = path.join(resolveReportsDir(workspaceId), `${randomUUID()}-${fileName}`);
    fs.writeFileSync(filePath, payload.buffer);

    return { filePath, fileName, contentType: payload.contentType };
  }

  private async buildTemplateDocument(
    workspaceId: string,
    dto: GenerateReportBody,
  ): Promise<ReportDocument> {
    const labels = renderTemplateLabels(dto.locale);
    if (dto.templateId === 'category-by-month') {
      this.assertMonthColumns(dto);
    }
    if (dto.templateId === 'investment-holdings') {
      // A snapshot of today: positions have no history, so no rows and no period.
      const currency = await this.getWorkspaceCurrency(workspaceId);
      const { document, missingRates } = await this.holdingsSnapshotReport.build(
        workspaceId,
        labels,
        currency,
      );
      return this.withRateNote(document, labels, missingRates, currency);
    }

    const { currency, rows, missingRates } = await this.loadReportRows(workspaceId, dto);
    const subtitle = `${dto.dateFrom} — ${dto.dateTo} · ${currency}`;

    if (dto.templateId === 'budget-vs-actual') {
      const result = await this.budgetVsActualReport.build(
        workspaceId,
        dto,
        labels,
        subtitle,
        currency,
        rows,
      );
      const missing = Array.from(new Set([...missingRates, ...result.missingRates])).sort();
      return this.withRateNote(result.document, labels, missing, currency);
    }

    const document = this.buildTemplateBody(dto, labels, subtitle, currency, rows);
    return this.withRateNote(document, labels, missingRates, currency);
  }

  /**
   * Said once, at the top and before the template's own caveats: totals below
   * are short by whatever could not be converted, and the reader can see which
   * currencies those were.
   */
  private withRateNote(
    document: ReportDocument,
    labels: TemplateLabels,
    missingRates: string[],
    currency: string,
  ): ReportDocument {
    if (!missingRates.length) {
      return document;
    }
    const note = fillLabel(labels.missingRateNote, {
      currencies: missingRates.join(', '),
      currency,
    });
    return { ...document, notes: [note, ...(document.notes ?? [])] };
  }

  private assertMonthColumns(dto: GenerateReportBody): void {
    const months = this.monthKeys(dto.dateFrom, dto.dateTo).length;
    const limit =
      dto.format === 'pdf' ? ReportsService.MAX_MONTHS.pdf : ReportsService.MAX_MONTHS.other;
    if (months > limit) {
      throw new BadRequestException(
        appError(dto.format === 'pdf' ? 'REPORT_PDF_MONTH_LIMIT' : 'REPORT_MONTH_LIMIT', { limit }),
      );
    }
  }

  /** Every calendar month the period touches, as YYYY-MM, including empty ones. */
  private monthKeys(dateFrom: string, dateTo: string): string[] {
    const keys: string[] = [];
    let [year, month] = dateFrom.slice(0, 7).split('-').map(Number);
    const last = dateTo.slice(0, 7);
    for (;;) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (key > last) {
        return keys;
      }
      keys.push(key);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  private buildTemplateBody(
    dto: GenerateReportBody,
    text: TemplateLabels,
    subtitle: string,
    currency: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    if (dto.templateId === 'pnl') {
      return this.buildPnLDocument(text, subtitle, rows);
    }
    if (dto.templateId === 'cash-flow') {
      return this.buildCashFlowDocument(text, subtitle, rows, dto.groupBy || 'day');
    }
    if (dto.templateId === 'transaction-register') {
      return this.buildTransactionRegisterDocument(text, subtitle, currency, rows);
    }
    if (dto.templateId === 'monthly-summary') {
      return this.buildMonthlySummaryDocument(text, subtitle, rows);
    }
    if (dto.templateId === 'category-by-month') {
      return this.buildCategoryByMonthDocument(
        text,
        subtitle,
        rows,
        this.monthKeys(dto.dateFrom, dto.dateTo),
      );
    }
    return this.buildExpenseByCategoryDocument(text, subtitle, rows);
  }

  private normalizeCurrency(currency: string | null | undefined): string {
    return currencyCodeOrDefault(currency);
  }

  private async getWorkspaceCurrency(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: {
        currency: true,
      },
    });
    return this.normalizeCurrency(workspace?.currency);
  }

  private async loadReportRows(
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

  /**
   * Totals per category, keyed by id: two categories may share a name under
   * different parents, and summing by name would fold them into one line.
   */
  private sumByCategory(rows: TemplateReportRow[]): CategoryTotal[] {
    const totals = new Map<string, CategoryTotal>();

    for (const row of rows) {
      const entry = totals.get(row.categoryKey) ?? {
        groupName: row.groupName,
        categoryName: row.categoryName,
        total: 0,
        count: 0,
      };
      entry.total += row.amount;
      entry.count += 1;
      totals.set(row.categoryKey, entry);
    }

    return Array.from(totals.values());
  }

  private buildPnLDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const income = byGroupThenAmount(this.sumByCategory(rows.filter(row => row.isIncome)));
    const expense = byGroupThenAmount(this.sumByCategory(rows.filter(row => !row.isIncome)));

    const totalRevenue = this.sumTotals(income);
    const totalExpenses = this.sumTotals(expense);
    const columns = [text.group, text.category, text.amount];

    return {
      title: text.titlePnl,
      subtitle,
      sections: [
        {
          title: text.revenue,
          columns,
          rows: this.toAmountRows(income),
          total: [text.totalRevenue, '', round2(totalRevenue)],
        },
        {
          title: text.expenses,
          columns,
          rows: this.toAmountRows(expense),
          total: [text.totalExpenses, '', round2(totalExpenses)],
        },
      ],
      footer: [[text.netIncome, round2(totalRevenue - totalExpenses)]],
    };
  }

  /**
   * Collapses an ISO date into its bucket. Weeks are keyed by their Monday, so
   * the key stays sortable as a plain string like the other two.
   */
  private toPeriodKey(dateKey: string, groupBy: 'day' | 'week' | 'month'): string {
    if (groupBy === 'month') {
      return dateKey.slice(0, 7);
    }
    if (groupBy === 'day') {
      return dateKey;
    }

    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const dayOfWeek = (date.getUTCDay() + 6) % 7; // Monday = 0
    date.setUTCDate(date.getUTCDate() - dayOfWeek);
    return date.toISOString().slice(0, 10);
  }

  private buildCashFlowDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
    groupBy: 'day' | 'week' | 'month',
  ): ReportDocument {
    const buckets = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const periodKey = this.toPeriodKey(row.date, groupBy);
      const bucket = buckets.get(periodKey) ?? { income: 0, expense: 0 };
      if (row.isIncome) {
        bucket.income += row.amount;
      } else {
        bucket.expense += row.amount;
      }
      buckets.set(periodKey, bucket);
    }

    const sorted = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
    const totalIncome = sorted.reduce((sum, [, bucket]) => sum + bucket.income, 0);
    const totalExpense = sorted.reduce((sum, [, bucket]) => sum + bucket.expense, 0);

    return {
      title: text.titleCashFlow,
      subtitle,
      sections: [
        {
          columns: [
            groupBy === 'day' ? text.date : groupBy === 'week' ? text.weekOf : text.month,
            text.income,
            text.expense,
            text.net,
          ],
          rows: sorted.map(([date, bucket]) => [
            date,
            round2(bucket.income),
            round2(bucket.expense),
            round2(bucket.income - bucket.expense),
          ]),
          total: [
            text.total,
            round2(totalIncome),
            round2(totalExpense),
            round2(totalIncome - totalExpense),
          ],
        },
      ],
    };
  }

  private buildExpenseByCategoryDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const byCategory = byGroupThenAmount(this.sumByCategory(rows.filter(row => !row.isIncome)));
    const totalExpenses = this.sumTotals(byCategory);
    const totalCount = byCategory.reduce((sum, entry) => sum + entry.count, 0);

    const categoryRows = byCategory.map(entry => [
      entry.groupName,
      entry.categoryName,
      round2(entry.total),
      entry.count,
      totalExpenses > 0 ? round2((entry.total / totalExpenses) * 100) : 0,
    ]);

    return {
      title: text.titleExpenseByCategory,
      subtitle,
      sections: [
        {
          columns: [
            text.group,
            text.category,
            text.totalAmount,
            text.transactionCount,
            text.percentOfTotal,
          ],
          rows: categoryRows,
          total: [text.total, '', round2(totalExpenses), totalCount, categoryRows.length ? 100 : 0],
        },
      ],
    };
  }

  /**
   * The one detail-level template: every transaction in the period, with both the
   * converted and the original amount so a foreign-currency line stays auditable,
   * and the id so a line can be traced back to the app.
   */
  private buildTransactionRegisterDocument(
    text: TemplateLabels,
    subtitle: string,
    currency: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const net = sorted.reduce((sum, row) => sum + (row.isIncome ? row.amount : -row.amount), 0);

    return {
      title: text.titleTransactionRegister,
      subtitle,
      sections: [
        {
          columns: [
            text.date,
            text.counterparty,
            text.group,
            text.category,
            text.type,
            fillLabel(text.amountInCurrency, { currency }),
            text.original,
            text.account,
            text.comment,
            text.tags,
            text.transactionId,
          ],
          rows: sorted.map(row => [
            row.date,
            row.counterparty,
            row.groupName,
            row.categoryName,
            row.isIncome ? text.income : text.expense,
            round2(row.isIncome ? row.amount : -row.amount),
            `${round2(row.originalAmount)} ${row.originalCurrency}`,
            row.accountName,
            row.comment,
            row.tags.join(', '),
            row.id,
          ]),
          total: [
            text.total,
            '',
            '',
            '',
            fillLabel(text.rowCount, { count: sorted.length }),
            round2(net),
            '',
            '',
            '',
            '',
            '',
          ],
        },
      ],
    };
  }

  /** P&L condensed to one screen: the headline numbers plus where the money went. */
  private buildMonthlySummaryDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
  ): ReportDocument {
    const income = rows.filter(row => row.isIncome);
    const expense = rows.filter(row => !row.isIncome);
    const totalIncome = income.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expense.reduce((sum, row) => sum + row.amount, 0);

    const topCategories = this.sumByCategory(expense)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(entry => [entry.categoryName, round2(entry.total)]);

    return {
      title: text.titleMonthlySummary,
      subtitle,
      sections: [
        {
          title: text.totals,
          columns: [text.metric, text.value],
          rows: [
            [text.income, round2(totalIncome)],
            [text.expenses, round2(totalExpense)],
            [text.transactions, rows.length],
            [
              text.savingsRate,
              totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
            ],
          ],
        },
        {
          title: text.topExpenseCategories,
          columns: [text.category, text.amount],
          rows: topCategories,
        },
      ],
      footer: [[text.netTotal, round2(totalIncome - totalExpense)]],
    };
  }

  /**
   * Income and spending per category with a column per month, as YNAB's
   * Income v Expense lays it out: the table people build next year's budget
   * from. Empty months stay as zero columns so every row lines up.
   */
  private buildCategoryByMonthDocument(
    text: TemplateLabels,
    subtitle: string,
    rows: TemplateReportRow[],
    months: string[],
  ): ReportDocument {
    const column = new Map(months.map((month, index) => [month, index]));
    const net = months.map(() => 0);

    const section = (title: string, sectionRows: TemplateReportRow[], sign: 1 | -1) => {
      const byCategory = new Map<
        string,
        { groupName: string; categoryName: string; perMonth: number[]; total: number }
      >();
      const perMonthTotal = months.map(() => 0);
      for (const row of sectionRows) {
        const index = column.get(row.date.slice(0, 7));
        if (index === undefined) {
          continue;
        }
        const entry = byCategory.get(row.categoryKey) ?? {
          groupName: row.groupName,
          categoryName: row.categoryName,
          perMonth: months.map(() => 0),
          total: 0,
        };
        entry.perMonth[index] += row.amount;
        entry.total += row.amount;
        byCategory.set(row.categoryKey, entry);
        perMonthTotal[index] += row.amount;
        net[index] += sign * row.amount;
      }

      const entries = byGroupThenAmount(Array.from(byCategory.values()));
      const sectionTotal = perMonthTotal.reduce((sum, value) => sum + value, 0);
      return {
        title,
        columns: [text.group, text.category, ...months, text.totalColumn, text.averagePerMonth],
        rows: entries.map(entry => [
          entry.groupName,
          entry.categoryName,
          ...entry.perMonth.map(value => round2(value)),
          round2(entry.total),
          round2(entry.total / months.length),
        ]),
        total: [
          text.total,
          '',
          ...perMonthTotal.map(value => round2(value)),
          round2(sectionTotal),
          round2(sectionTotal / months.length),
        ],
      };
    };

    const income = section(
      text.revenue,
      rows.filter(row => row.isIncome),
      1,
    );
    const expenses = section(
      text.expenses,
      rows.filter(row => !row.isIncome),
      -1,
    );
    const netTotal = net.reduce((sum, value) => sum + value, 0);

    return {
      title: text.titleCategoryByMonth,
      subtitle,
      orientation: 'landscape',
      sections: [
        income,
        expenses,
        {
          title: text.net,
          columns: ['', '', ...months, text.totalColumn, text.averagePerMonth],
          rows: [
            [
              text.netTotal,
              '',
              ...net.map(value => round2(value)),
              round2(netTotal),
              round2(netTotal / months.length),
            ],
          ],
        },
      ],
      footer: [[text.netTotal, round2(netTotal)]],
    };
  }

  private sumTotals(entries: CategoryTotal[]): number {
    return entries.reduce((sum, entry) => sum + entry.total, 0);
  }

  private toAmountRows(entries: CategoryTotal[]): ReportCell[][] {
    return entries.map(entry => [entry.groupName, entry.categoryName, round2(entry.total)]);
  }

  getReportHistory(workspaceId: string): Promise<ReportHistory[]> {
    return this.reportHistoryService.getReportHistory(workspaceId);
  }

  downloadHistoryReport(workspaceId: string, reportId: string): Promise<ReportFile> {
    return this.reportHistoryService.downloadHistoryReport(workspaceId, reportId);
  }
}

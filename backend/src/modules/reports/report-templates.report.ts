import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { GenerateReportBody } from '../../contracts';
import { ReportHistory } from '../../entities/report-history.entity';
import { BalanceService } from '../balance/balance.service';
import { BalanceExportFormat } from '../balance/dto/export-balance.dto';
import { BudgetVsActualReport } from './budget-vs-actual.report';
import { resolveReportsDir } from './helpers/reports-dir.util';
import { monthKeys } from './helpers/template-category-by-month.util';
import { buildTemplateBody } from './helpers/template-documents.util';
import { HoldingsSnapshotReport } from './holdings-snapshot.report';
import {
  type ReportDocument,
  type ReportFile,
  type ReportFileFormat,
  writeReportFile,
} from './report-document.util';
import { fillLabel, renderTemplateLabels } from './report-template.translations';
import type { TemplateLabels } from './report-template.types';
import { TemplateReportRowsLoader } from './template-report-rows.loader';

/** The report templates: a document per template, written as a file or shown as a preview. */
@Injectable()
export class ReportTemplateGenerator {
  constructor(
    @InjectRepository(ReportHistory)
    private readonly reportHistoryRepo: Repository<ReportHistory>,
    private readonly balanceService: BalanceService,
    private readonly budgetVsActualReport: BudgetVsActualReport,
    private readonly holdingsSnapshotReport: HoldingsSnapshotReport,
    private readonly templateReportRowsLoader: TemplateReportRowsLoader,
  ) {}

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
    const template = ReportTemplateGenerator.TEMPLATE_NAMES[templateId];
    if (!template) {
      throw new BadRequestException(appError('REPORT_TEMPLATE_UNKNOWN', { id: templateId }));
    }
    const formats = ReportTemplateGenerator.TEMPLATE_FORMATS[templateId] ?? ['pdf', 'excel', 'csv'];
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
    ReportTemplateGenerator.assertTemplateFormat(dto.templateId, dto.format);
    const templateName = ReportTemplateGenerator.TEMPLATE_NAMES[dto.templateId];

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
    if (!ReportTemplateGenerator.TEMPLATE_NAMES[dto.templateId]) {
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
      const currency = await this.templateReportRowsLoader.getWorkspaceCurrency(workspaceId);
      const { document, missingRates } = await this.holdingsSnapshotReport.build(
        workspaceId,
        labels,
        currency,
      );
      return this.withRateNote(document, labels, missingRates, currency);
    }

    const { currency, rows, missingRates } = await this.templateReportRowsLoader.loadReportRows(
      workspaceId,
      dto,
    );
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

    const document = buildTemplateBody(dto, labels, subtitle, currency, rows);
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
    const months = monthKeys(dto.dateFrom, dto.dateTo).length;
    const limit =
      dto.format === 'pdf'
        ? ReportTemplateGenerator.MAX_MONTHS.pdf
        : ReportTemplateGenerator.MAX_MONTHS.other;
    if (months > limit) {
      throw new BadRequestException(
        appError(dto.format === 'pdf' ? 'REPORT_PDF_MONTH_LIMIT' : 'REPORT_MONTH_LIMIT', { limit }),
      );
    }
  }

  /** Every calendar month the period touches, as YYYY-MM, including empty ones. */
}

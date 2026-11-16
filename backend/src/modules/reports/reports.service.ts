import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
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
import { CustomReportGenerator } from './custom-report.report';
import { CustomTablesDrillDownReport } from './custom-tables-drilldown.report';
import { CustomTablesReport } from './custom-tables-report.report';
import { CustomTablesSummaryReport } from './custom-tables-summary.report';
import { DailyReportGenerator } from './daily-report.report';
import { ExportFormat } from './dto/export-report.dto';
import { WorkspaceExportFormat } from './dto/workspace-export.dto';
import { exportToCSV, exportToExcel } from './helpers/report-export-writers.util';
import { resolveReportsDir } from './helpers/reports-dir.util';
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
import { type ReportDocument, type ReportFile } from './report-document.util';
import { ReportHistoryService } from './report-history.service';
import { ReportTemplateGenerator } from './report-templates.report';
import { SpendOverTimeReport } from './spend-over-time.report';
import { StatementsSummaryReport } from './statements-summary.report';
import { TopCategoriesReport } from './top-categories.report';
import { WorkspaceExportReport } from './workspace-export.report';

@Injectable()
export class ReportsService {
  constructor(
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
    private readonly reportTemplateGenerator: ReportTemplateGenerator,
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

  /**
   * Rejects a template or format the generator cannot produce. Report
   * schedules call it when they are created.
   */
  static assertTemplateFormat(templateId: string, format: string): void {
    ReportTemplateGenerator.assertTemplateFormat(templateId, format);
  }

  generateFromTemplate(
    workspaceId: string,
    userId: string,
    dto: GenerateReportBody,
  ): Promise<ReportFile> {
    return this.reportTemplateGenerator.generateFromTemplate(workspaceId, userId, dto);
  }

  previewTemplate(
    workspaceId: string,
    dto: GenerateReportBody,
    maxRowsPerSection = 20,
  ): Promise<ReportDocument & { truncated: boolean }> {
    return this.reportTemplateGenerator.previewTemplate(workspaceId, dto, maxRowsPerSection);
  }

  getReportHistory(workspaceId: string): Promise<ReportHistory[]> {
    return this.reportHistoryService.getReportHistory(workspaceId);
  }

  downloadHistoryReport(workspaceId: string, reportId: string): Promise<ReportFile> {
    return this.reportHistoryService.downloadHistoryReport(workspaceId, reportId);
  }
}

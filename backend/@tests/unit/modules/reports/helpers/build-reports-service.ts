import { CustomTablesReport } from '@/modules/reports/custom-tables-report.report';
import { CustomTablesDrillDownReport } from '@/modules/reports/custom-tables-drilldown.report';
import { CustomTablesSummaryReport } from '@/modules/reports/custom-tables-summary.report';
import { CustomReportGenerator } from '@/modules/reports/custom-report.report';
import { DailyReportGenerator } from '@/modules/reports/daily-report.report';
import { MonthlyReportGenerator } from '@/modules/reports/monthly-report.report';
import { ReportHistoryService } from '@/modules/reports/report-history.service';
import { ReportsService } from '@/modules/reports/reports.service';
import { SpendOverTimeReport } from '@/modules/reports/spend-over-time.report';
import { StatementsSummaryReport } from '@/modules/reports/statements-summary.report';
import { TopCategoriesReport } from '@/modules/reports/top-categories.report';
import { WorkspaceExportReport } from '@/modules/reports/workspace-export.report';

/**
 * ReportsService with every collaborator stubbed; a spec passes only the ones
 * its case reads, by name, so a constructor change touches this file alone.
 */
export interface ReportsServiceDeps {
  transactionRepository: unknown;
  customTableRepository: unknown;
  customTableColumnRepository: unknown;
  customTableRowRepository: unknown;
  cacheManager: unknown;
  auditService: unknown;
  reportHistoryRepo: unknown;
  workspaceRepository: unknown;
  exchangeRatesService: unknown;
  balanceService: unknown;
  budgetVsActualReport: unknown;
  holdingsSnapshotReport: unknown;
}

export function buildReportsService(overrides: Partial<ReportsServiceDeps> = {}): ReportsService {
  const deps: ReportsServiceDeps = {
    transactionRepository: {},
    customTableRepository: {},
    customTableColumnRepository: {},
    customTableRowRepository: {},
    cacheManager: { get: vi.fn(), set: vi.fn() },
    auditService: { createEvent: vi.fn() },
    reportHistoryRepo: {},
    workspaceRepository: { findOne: vi.fn(async () => ({ currency: 'EUR' })) },
    exchangeRatesService: { getRate: vi.fn(async () => 1) },
    balanceService: { exportBalanceSheet: vi.fn() },
    budgetVsActualReport: {},
    holdingsSnapshotReport: {},
    ...overrides,
  };
  const tables = deps.customTableRepository as any;
  const columns = deps.customTableColumnRepository as any;
  const rows = deps.customTableRowRepository as any;
  const transactions = deps.transactionRepository as any;
  const cache = deps.cacheManager as any;
  const audit = deps.auditService as any;
  return new ReportsService(
    transactions,
    deps.reportHistoryRepo as any,
    deps.workspaceRepository as any,
    deps.exchangeRatesService as any,
    deps.balanceService as any,
    deps.budgetVsActualReport as any,
    deps.holdingsSnapshotReport as any,
    new CustomTablesSummaryReport(cache, tables, columns, rows),
    new CustomTablesReport(cache, tables, columns, rows),
    new CustomTablesDrillDownReport(tables, columns, rows),
    new DailyReportGenerator(cache, transactions, audit),
    new MonthlyReportGenerator(cache, transactions, audit),
    new CustomReportGenerator(transactions, audit),
    new StatementsSummaryReport(transactions),
    new ReportHistoryService(deps.reportHistoryRepo as any),
    new WorkspaceExportReport(transactions, audit),
    new TopCategoriesReport(transactions),
    new SpendOverTimeReport(transactions),
  );
}

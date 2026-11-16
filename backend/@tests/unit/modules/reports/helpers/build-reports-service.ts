import { CustomTablesReport } from '@/modules/reports/custom-tables-report.report';
import { CustomTablesDrillDownReport } from '@/modules/reports/custom-tables-drilldown.report';
import { CustomTablesSummaryReport } from '@/modules/reports/custom-tables-summary.report';
import { ReportsService } from '@/modules/reports/reports.service';

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
  return new ReportsService(
    deps.transactionRepository as any,
    deps.cacheManager as any,
    deps.auditService as any,
    deps.reportHistoryRepo as any,
    deps.workspaceRepository as any,
    deps.exchangeRatesService as any,
    deps.balanceService as any,
    deps.budgetVsActualReport as any,
    deps.holdingsSnapshotReport as any,
    new CustomTablesSummaryReport(deps.cacheManager as any, tables, columns, rows),
    new CustomTablesReport(deps.cacheManager as any, tables, columns, rows),
    new CustomTablesDrillDownReport(tables, columns, rows),
  );
}

import type { CustomTablesReportBody } from '../../../contracts';
import type { CustomTable } from '../../../entities/custom-table.entity';
import { CustomTableReportSortKey } from '../dto/custom-tables-report.dto';
import type {
  CustomTablesReportResponse,
  CustomTablesReportRow,
} from '../interfaces/custom-tables-report.interface';

/** One custom-table row the report counts. */
export interface CustomTableReportRecord {
  rowId: string;
  tableId: string;
  tableName: string;
  source: 'manual';
  counterparty: string;
  amount: number;
  date: string | null;
  category: string | null;
  currency: string | null;
  flow: 'expense' | 'income';
}

export function emptyCustomTablesReportResponse(): CustomTablesReportResponse {
  return {
    totals: { total: 0, manualTotal: 0, operations: 0 },
    comparison: {
      totalDelta: 0,
      totalPercentage: 0,
      totalTrend: 'flat',
      manualDelta: 0,
      manualPercentage: 0,
      manualTrend: 'flat',
      operationsDelta: 0,
      operationsPercentage: 0,
      operationsTrend: 'flat',
    },
    timeseries: [],
    sourceSplit: { manual: 0 },
    aggregatedRows: [],
    tables: [],
  };
}

/**
 * Totals, the comparison with the previous period of the same length, the daily
 * series and one line per counterparty, sorted by `sortBy` and cut to `limit`.
 */
export function aggregateCustomTablesReport(
  tables: CustomTable[],
  records: CustomTableReportRecord[],
  previousRecords: CustomTableReportRecord[],
  sortBy: NonNullable<CustomTablesReportBody['sortBy']> | CustomTableReportSortKey,
  limit: number,
): CustomTablesReportResponse {
  const totals = { total: 0, manualTotal: 0, operations: 0 };
  const previousTotals = { total: 0, manualTotal: 0, operations: 0 };
  const timeseriesMap = new Map<string, number>();
  const aggregateMap = new Map<
    string,
    {
      counterparty: string;
      source: 'manual';
      tableId: string;
      tableName: string;
      count: number;
      total: number;
      lastDate: string | null;
      currency: string | null;
    }
  >();
  const tableTotalsMap = new Map<string, { total: number; rows: number }>();

  for (const record of records) {
    totals.total += record.amount;
    totals.operations += 1;
    totals.manualTotal += record.amount;

    if (record.date) {
      timeseriesMap.set(record.date, (timeseriesMap.get(record.date) || 0) + record.amount);
    }

    const aggregateKey = `${record.source}:${record.currency || ''}:${record.counterparty.toLowerCase()}`;
    const current = aggregateMap.get(aggregateKey);
    if (current) {
      current.count += 1;
      current.total += record.amount;
      if (record.date && (!current.lastDate || record.date > current.lastDate)) {
        current.lastDate = record.date;
      }
    } else {
      aggregateMap.set(aggregateKey, {
        counterparty: record.counterparty,
        source: record.source,
        tableId: record.tableId,
        tableName: record.tableName,
        count: 1,
        total: record.amount,
        lastDate: record.date,
        currency: record.currency,
      });
    }

    const tableMetrics = tableTotalsMap.get(record.tableId) || { total: 0, rows: 0 };
    tableMetrics.total += record.amount;
    tableMetrics.rows += 1;
    tableTotalsMap.set(record.tableId, tableMetrics);
  }

  for (const record of previousRecords) {
    previousTotals.total += record.amount;
    previousTotals.operations += 1;
    previousTotals.manualTotal += record.amount;
  }

  const toComparison = (current: number, previous: number) => {
    const delta = current - previous;
    const percentage =
      previous === 0 ? (current > 0 ? 100 : 0) : Math.round((delta / previous) * 100);
    const trend: 'up' | 'down' | 'flat' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return { delta, percentage, trend };
  };

  const totalCmp = toComparison(totals.total, previousTotals.total);
  const manualCmp = toComparison(totals.manualTotal, previousTotals.manualTotal);
  const operationsCmp = toComparison(totals.operations, previousTotals.operations);

  let aggregatedRows: CustomTablesReportRow[] = Array.from(aggregateMap.values()).map(item => ({
    counterparty: item.counterparty,
    source: item.source,
    tableId: item.tableId,
    tableName: item.tableName,
    count: item.count,
    total: item.total,
    average: item.count > 0 ? item.total / item.count : 0,
    lastDate: item.lastDate,
    currency: item.currency,
  }));

  if (sortBy === CustomTableReportSortKey.AVERAGE) {
    aggregatedRows.sort((a, b) => b.average - a.average);
  } else if (sortBy === CustomTableReportSortKey.OPERATIONS) {
    aggregatedRows.sort((a, b) => b.count - a.count);
  } else {
    aggregatedRows.sort((a, b) => b.total - a.total);
  }
  aggregatedRows = aggregatedRows.slice(0, limit);

  const timeseries = Array.from(timeseriesMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const response: CustomTablesReportResponse = {
    totals,
    comparison: {
      totalDelta: totalCmp.delta,
      totalPercentage: totalCmp.percentage,
      totalTrend: totalCmp.trend,
      manualDelta: manualCmp.delta,
      manualPercentage: manualCmp.percentage,
      manualTrend: manualCmp.trend,
      operationsDelta: operationsCmp.delta,
      operationsPercentage: operationsCmp.percentage,
      operationsTrend: operationsCmp.trend,
    },
    timeseries,
    sourceSplit: {
      manual: totals.manualTotal,
    },
    aggregatedRows,
    tables: tables
      .map(table => {
        const metrics = tableTotalsMap.get(table.id) || { total: 0, rows: 0 };
        return {
          id: table.id,
          name: table.name,
          source: table.source,
          total: metrics.total,
          rows: metrics.rows,
        };
      })
      .filter(table => table.rows > 0)
      .sort((a, b) => b.total - a.total),
  };
  return response;
}

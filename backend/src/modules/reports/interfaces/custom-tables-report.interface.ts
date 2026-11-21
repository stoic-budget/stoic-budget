export interface CustomTablesSummaryResponse {
  totals: {
    income: number;
    expense: number;
    net: number;
    rows: number;
  };
  timeseries: Array<{ date: string; income: number; expense: number }>;
  categories: Array<{ name: string; amount: number; rows: number }>;
  counterparties: Array<{ name: string; amount: number; rows: number }>;
  recent: Array<{
    id: string;
    tableId: string;
    tableName: string;
    rowNumber: number;
    amount: number;
    category: string | null;
    counterparty: string | null;
    updatedAt: string;
  }>;
  tables: Array<{
    id: string;
    name: string;
    income: number;
    expense: number;
    net: number;
    rows: number;
  }>;
}

export interface CustomTablesReportRow {
  counterparty: string;
  source: 'manual';
  tableId: string;
  tableName: string;
  count: number;
  total: number;
  average: number;
  lastDate: string | null;
  currency: string | null;
}

export interface CustomTablesReportResponse {
  totals: {
    total: number;
    manualTotal: number;
    operations: number;
  };
  comparison: {
    totalDelta: number;
    totalPercentage: number;
    totalTrend: 'up' | 'down' | 'flat';
    manualDelta: number;
    manualPercentage: number;
    manualTrend: 'up' | 'down' | 'flat';
    operationsDelta: number;
    operationsPercentage: number;
    operationsTrend: 'up' | 'down' | 'flat';
  };
  timeseries: Array<{ date: string; amount: number }>;
  sourceSplit: { manual: number };
  aggregatedRows: CustomTablesReportRow[];
  tables: Array<{
    id: string;
    name: string;
    source: 'manual';
    total: number;
    rows: number;
  }>;
}

export interface CustomTablesReportDrillDownResponse {
  counterparty: string;
  items: Array<{
    rowId: string;
    tableId: string;
    tableName: string;
    source: 'manual';
    date: string | null;
    amount: number;
    category: string | null;
    currency: string | null;
  }>;
}

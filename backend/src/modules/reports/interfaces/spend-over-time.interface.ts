export interface SpendOverTimePoint {
  period: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface SpendOverTimeResult {
  groupBy: string;
  dateFrom: string;
  dateTo: string;
  points: SpendOverTimePoint[];
  totals: {
    income: number;
    expense: number;
    net: number;
    count: number;
    avgPerPeriod: number;
  };
}

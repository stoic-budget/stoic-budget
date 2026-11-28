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
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
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

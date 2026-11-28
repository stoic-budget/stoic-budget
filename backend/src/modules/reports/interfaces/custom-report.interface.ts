export interface CustomReportGroup {
  key: string;
  label: string;
  totalAmount: number;
  transactionCount: number;
  transactions: Array<{
    id: string;
    date: string;
    counterparty: string;
    amount: number;
    category?: string;
    branch?: string;
    wallet?: string;
  }>;
}

export interface CustomReport {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
  groups: CustomReportGroup[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    difference: number;
    transactionCount: number;
  };
}

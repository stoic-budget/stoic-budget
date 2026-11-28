export interface StatementsSummaryResponse {
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
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
    amount: number;
    category: string | null;
    counterparty: string | null;
    updatedAt: string;
  }>;
}

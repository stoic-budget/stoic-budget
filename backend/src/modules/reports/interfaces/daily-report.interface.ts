export interface DailyIncomeBlock {
  totalAmount: number;
  transactionCount: number;
  topCounterparties: Array<{
    name: string;
    amount: number;
    count: number;
  }>;
}

export interface DailyExpenseBlock {
  totalAmount: number;
  transactionCount: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    count: number;
  }>;
}

export interface DailySummaryBlock {
  incomeTotal: number;
  expenseTotal: number;
  difference: number;
  balance?: number;
}

export interface DailyReport {
  date: string;
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
  income: DailyIncomeBlock;
  expense: DailyExpenseBlock;
  summary: DailySummaryBlock;
}

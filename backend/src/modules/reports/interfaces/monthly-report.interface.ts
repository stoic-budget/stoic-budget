export interface DailyTrend {
  date: string;
  income: number;
  expense: number;
}

export interface CategoryDistribution {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface CounterpartyDistribution {
  counterpartyName: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface PeriodComparison {
  currentPeriod: {
    income: number;
    expense: number;
    difference: number;
  };
  previousPeriod: {
    income: number;
    expense: number;
    difference: number;
  };
  change: {
    incomeChange: number;
    expenseChange: number;
    differenceChange: number;
    incomeChangePercent: number;
    expenseChangePercent: number;
    differenceChangePercent: number;
  };
}

export interface MonthlyReport {
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
  month: string;
  year: number;
  dailyTrends: DailyTrend[];
  categoryDistribution: CategoryDistribution[];
  counterpartyDistribution: CounterpartyDistribution[];
  comparison: PeriodComparison;
  summary: {
    totalIncome: number;
    totalExpense: number;
    difference: number;
    transactionCount: number;
  };
}

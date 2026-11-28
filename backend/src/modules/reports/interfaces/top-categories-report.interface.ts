import type { TransactionType } from '../../../entities/transaction.entity';

export interface TopCategoriesReport {
  /** The workspace's currency every amount is in, at each row's own day's rate. */
  currency: string;
  /** Currencies with no rate to it: their rows are left out, not counted one to one. */
  missingRates: string[];
  period: {
    from: string;
    to: string;
  };
  totals: {
    income: number;
    expense: number;
    net: number;
    transactions: number;
  };
  categories: Array<{
    id: string | null;
    name: string;
    amount: number;
    percentage: number;
    transactions: number;
    type: TransactionType;
    color?: string | null;
    icon?: string | null;
  }>;
  banks: Array<{
    bankName: string;
    amount: number;
    percentage: number;
    statements: number;
  }>;
  counterparties: Array<{
    name: string;
    amount: number;
    percentage: number;
    transactions: number;
    type: TransactionType;
  }>;
}

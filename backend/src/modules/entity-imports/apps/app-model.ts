import type { WalletType } from '../../../entities/wallet.entity';

/** Apps whose export format was confirmed against their documentation or source. */
export type AppName = 'ynab' | 'actual' | 'firefly';

/** `register`: transactions; `plan`: amounts assigned per month and category. */
export type AppFileKind = 'register' | 'plan';

/** One row of money as the source app recorded it, before it meets the workspace. */
export interface AppTxn {
  fileName: string;
  /** Row of the file as a spreadsheet numbers it (the header is row 1), for problems. */
  row: number;
  /** The source app's account name. */
  account: string;
  /** ISO date. */
  date: string;
  /** Signed, in the account's currency: below zero is money out. */
  amount: number;
  payee: string;
  memo: string;
  group: string | null;
  category: string | null;
  /** The other account of a transfer, by its name in the source app. */
  transferTo: string | null;
  /** Actual names a transfer only by the other account, as the payee. */
  payeeMayBeAccount: boolean;
  /** One row that carries both legs (Firefly): the amount that arrived, in the other account's currency. */
  arrived: { amount: number; currency: string | null } | null;
  /** Rows sharing a key are the parts of one split. */
  splitKey: string | null;
  /** The account's opening balance rather than a transaction. */
  opening: boolean;
  /** The account's currency when the file says (Firefly). */
  currency: string | null;
  accountType: WalletType | null;
}

/** One category's assigned amount in one month (YNAB plan). */
export interface AppBudgetRow {
  fileName: string;
  row: number;
  /** `YYYY-MM`. */
  month: string;
  group: string | null;
  category: string;
  assigned: number;
}

export interface AppProblem {
  fileName: string;
  row: number;
  reason: string;
}

export interface ParsedAppFile {
  fileName: string;
  app: AppName | null;
  kind: AppFileKind | null;
  txns: AppTxn[];
  budgets: AppBudgetRow[];
  problems: AppProblem[];
}

/** A transaction row with every field but the ones a parser fills itself. */
export const appTxn = (
  base: Pick<AppTxn, 'fileName' | 'row' | 'account' | 'date' | 'amount' | 'payee' | 'memo'> &
    Partial<AppTxn>,
): AppTxn => ({
  group: null,
  category: null,
  transferTo: null,
  payeeMayBeAccount: false,
  arrived: null,
  splitKey: null,
  opening: false,
  currency: null,
  accountType: null,
  ...base,
});

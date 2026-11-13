import type { PaymentType } from '../../../contracts/transactions/payment-type';

export interface ParsedTransaction {
  transactionDate: Date;
  documentNumber?: string;
  counterpartyName: string;
  counterpartyBin?: string;
  counterpartyAccount?: string;
  counterpartyBank?: string;
  debit?: number;
  credit?: number;
  paymentPurpose: string;
  paymentType?: PaymentType;
  currency?: string;
  exchangeRate?: number;
  amountForeign?: number;
  /** The category the file itself filed the row under; levels joined by ':' ("Food:Groceries"). */
  categoryName?: string;
  /**
   * The parts the file split the row into, each in the row's own direction and
   * together its whole amount. Absent for a row the file did not split.
   */
  splits?: ParsedSplit[];
  /** The account the file says the money moved to or from, by its name in the file. */
  transferAccount?: string;
}

export interface ParsedSplit {
  /** Positive, in the row's currency. */
  amount: number;
  categoryName?: string;
  memo?: string;
}

export interface ParsedStatementMetadata {
  accountNumber: string;
  dateFrom: Date;
  dateTo: Date;
  balanceStart?: number;
  balanceEnd?: number;
  currency: string;
  rawHeader?: string;
  normalizedHeader?: string;
  periodLabel?: string;
  institution?: string;
  locale?: string;

  // Enhanced header information for display
  headerDisplay?: {
    title?: string;
    subtitle?: string;
    periodDisplay?: string;
    accountDisplay?: string;
    institutionDisplay?: string;
    currencyDisplay?: string;
  };
}

/**
 * What a parser checked its own reading against: the running balance printed
 * on each row, the totals and balances the statement prints, its period.
 */
import type { StatementLayout } from '../helpers/pdf-layout-fingerprint.helper';

export type ParseCheckCode =
  | 'balance_chain'
  | 'printed_totals'
  | 'section_totals'
  | 'printed_balances'
  | 'dates_in_period';

export interface ParseCheck {
  code: ParseCheckCode;
  passed: boolean;
  /** Where it failed: never a description or a name, only figures and a row's place. */
  detail?: {
    /** 1-based, in the order the rows were read. */
    row?: number;
    date?: string;
    side?: 'credits' | 'debits' | 'start' | 'end';
    expected?: number;
    actual?: number;
  };
}

export interface ParsedStatement {
  metadata: ParsedStatementMetadata;
  transactions: ParsedTransaction[];
  /** Checks of the reading that apply to this statement; none for most formats. */
  checks?: ParseCheck[];
  /** The file's layout as words (pdf-layout-fingerprint.helper), when the parser reads one. */
  layout?: StatementLayout;
  /** What the parser left out or had to guess, for the statement's warnings. */
  warnings?: string[];
  /**
   * Further accounts printed in the same file (an HKD and a USD account on one
   * statement), each with its own metadata and rows. `metadata` and
   * `transactions` above are the first account.
   */
  otherAccounts?: Array<Pick<ParsedStatement, 'metadata' | 'transactions' | 'checks' | 'warnings'>>;
}

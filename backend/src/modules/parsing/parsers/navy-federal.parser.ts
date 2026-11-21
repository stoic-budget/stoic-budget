import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The credit union's web address and its mailing name. */
const NFCU_SITE = /\bnavyfederal\.org\b/i;
const NFCU_NAME = /\bNavy Federal\b|\bNFCU\b/;

export function isNavyFederalStatement(text: string): boolean {
  return NFCU_SITE.test(text) && NFCU_NAME.test(text);
}

const ITEMS_PAID = /^Items Paid$/i;
const isHeader = (row: PdfTextRow) => /^Date\b.*\bTransaction Detail\b/i.test(row.text);

/**
 * "Items Paid" sums the debits already listed, two to a line ("06-28  POS
 * 33.04  07-06  POS 6.98"): it is left out, up to the next account's table.
 */
export function withoutItemsPaid(rows: PdfTextRow[]): PdfTextRow[] {
  let skipping = false;
  return [...rows]
    .sort((a, b) => a.page - b.page || a.y - b.y)
    .filter(row => {
      if (ITEMS_PAID.test(row.text.trim())) {
        skipping = true;
      } else if (skipping && (isHeader(row) || /^(?:Checking|Savings)$/i.test(row.text.trim()))) {
        skipping = false;
      }
      return !skipping;
    });
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^POS (?:Debit|Credit Adjustment)\b/i, 'card'],
  [/^ATM (?:Withdrawal|Rebate)\b|^Cash Withdrawal\b/i, 'cash'],
  [/\bFee\b/i, 'fee'],
  [/^Dividend\b/i, 'interest'],
  [/^(?:Deposit|Paid To|Transfer)\b/i, 'transfer'],
];

/** "POS Debit- Debit Card 1000 06-26-21 ACME Store Sampletown CA": the shop after the card and day. */
const CARD_SHOP =
  /^POS (?:Debit|Credit Adjustment)\s*-?\s*(?:Debit Card )?\d{4}(?: Transaction)? \d{2}-\d{2}-\d{2} (.+)$/i;
/** "Deposit - ACH Paid From ACME Payroll 01Afd2": the payer. */
const PAID_FROM = /^Deposit - ACH Paid From (.+?)(?: \w*\d\w*)?$/i;

export function navyFederalEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (!kind) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = CARD_SHOP.exec(text)?.[1] ?? PAID_FROM.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Navy Federal Credit Union (US) statement of account: a summary of the
 * deposit accounts, then each account's Date, Transaction Detail, Amount
 * (a debit ends with "-") and Balance from its beginning to its ending
 * balance, a checking account's "Items Paid" after it. This names the
 * credit union, leaves "Items Paid" out and types the rows; the generic
 * layout reading does the tables and the accounts.
 */
export class NavyFederalParser extends BankPdfParser {
  protected readonly bank = BankName.NAVY_FEDERAL;

  protected recognises(text: string): boolean {
    return isNavyFederalStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withoutItemsPaid(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return navyFederalEntry(row);
  }
}

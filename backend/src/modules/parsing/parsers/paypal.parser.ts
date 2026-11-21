import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The statement's title and its "PayPal Account ID" label. */
const PAYPAL_TITLE = /\bPayPal (?:Savings |Balance |Business )?(?:Account )?Statement\b/i;
const PAYPAL_ID = /\bPayPal Account ID\b/i;

export function isPaypalStatement(text: string): boolean {
  return PAYPAL_TITLE.test(text) && PAYPAL_ID.test(text);
}

/** "Beginning PayPal Savings account balance": the summary's balances, no movements. */
const BALANCE_LINE = /^(?:Beginning|Ending)\b.*\bbalance$/i;

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\bInterest\b/i, 'interest'],
  [/\bFee\b/i, 'fee'],
  [/\b(?:Transfer|Deposit|Withdrawal|Payment)\b/i, 'transfer'],
];

export function paypalEntry(row: ParsedTransaction): ParsedTransaction {
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
  return { ...row, paymentType };
}

/**
 * PayPal Savings statement (banking by Synchrony Bank): the period, the
 * PayPal account ID and the account number, a summary from the beginning to
 * the ending balance, then Transaction Date, Posting Date, Type,
 * Description, Amount and Totals. The generic layout reading does the
 * tables; this names PayPal, leaves the summary's balance lines out and
 * types the rows.
 */
export class PaypalParser extends BankPdfParser {
  protected readonly bank = BankName.PAYPAL;

  protected recognises(text: string): boolean {
    return isPaypalStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super
      .readTransactions(rows, reading)
      .filter(row => !BALANCE_LINE.test(row.description.trim()));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return paypalEntry(row);
  }
}

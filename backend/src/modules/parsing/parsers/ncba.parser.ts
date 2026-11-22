import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { withSidesFromBalances } from '../helpers/pdf-layout-swapped-sides.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name, or its e-statement title with the payments summary. */
const NCBA_NAME = /\bNCBA\b/;
const NCBA_LAYOUT = /\be-Statement Of Account\b[\s\S]*\bPayments In\b[\s\S]*\bPayments Out\b/i;

export function isNcbaStatement(text: string): boolean {
  return NCBA_NAME.test(text) || NCBA_LAYOUT.test(text);
}

/** "Opening Balance   23,101.68" in the summary box. */
function openingBalance(rows: PdfTextRow[]): number | undefined {
  for (const row of rows) {
    const match = /\bOpening Balance\s+(\S+)$/i.exec(row.text.trim());
    const value = match ? parseStatementAmount(match[1]) : null;
    if (value !== null) {
      return value;
    }
  }
  return undefined;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\b(?:Mobile Payments|MPESA|Transfer|Pesalink|RTGS|EFT)\b/i, 'transfer'],
  [/\bATM\b|\bCash\b/i, 'cash'],
  [/\b(?:Charge|Fee|Excise Duty)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/\b(?:POS|Card)\b/i, 'card'],
];

export function ncbaEntry(read: ParsedTransaction): ParsedTransaction {
  // The value date, its heading over two lines, is read into the text: "… Payments 01/08/2024 FTC…".
  const text = read.paymentPurpose
    .replace(/\s+/g, ' ')
    .replace(/ \d{2}\/\d{2}\/\d{4}\b/, '')
    .trim();
  const row = { ...read, paymentPurpose: text, counterpartyName: text };
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
 * NCBA (Kenya) e-statement of account: a summary from the opening to the
 * closing balance with payments in and out, then Date, Transaction Type and
 * Details, Value Date, Debit, Credit and Balance, each row's reference on
 * the line below. The debits run past the "Credit" heading, so each row's
 * side is taken from its running balance; the generic layout reading does
 * the rest.
 */
export class NcbaParser extends BankPdfParser {
  protected readonly bank = BankName.NCBA;

  protected recognises(text: string): boolean {
    return isNcbaStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return withSidesFromBalances(super.readTransactions(rows, reading), openingBalance(rows));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ncbaEntry(row);
  }
}

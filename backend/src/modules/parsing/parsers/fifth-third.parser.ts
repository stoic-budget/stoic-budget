import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The product line under the address ("Fifth Third Business Plus") and the statement's title. */
const FIFTH_THIRD_NAME = /\bFifth Third\b/;
const FIFTH_THIRD_TITLE = /\bSTATEMENT OF ACCOUNT\b/;

export function isFifthThirdStatement(text: string): boolean {
  return FIFTH_THIRD_NAME.test(text) && FIFTH_THIRD_TITLE.test(text);
}

/** The lists' headings: money in, money out. */
const MONEY_IN = /^(?:ELECTRONIC )?DEPOSITS$|^OTHER CREDITS$/i;
const MONEY_OUT =
  /^(?:ELECTRONIC PAYMENTS|OTHER WITHDRAWS|OTHER WITHDRAWALS|WITHDRAWALS|CHECKS|SERVICE CHARGES)$/i;
const SUBTOTAL = /\s*\bSubtotal:?\s*$/i;

const before = (a: { page: number; y: number }, b: { page: number; y: number }) =>
  a.page < b.page || (a.page === b.page && a.y < b.y);

/**
 * The sign of each row from the list it is printed in: the last heading above
 * it. A row printed off its line (the date a line above or below its amount)
 * may close the generic reading's section before the list ends.
 */
export function signByHeading(
  rows: PdfTextRow[],
  transactions: LayoutTransaction[],
): LayoutTransaction[] {
  const headings = rows
    .map(row => ({
      at: { page: row.page, y: row.y },
      sign: MONEY_IN.test(row.text.trim()) ? 1 : MONEY_OUT.test(row.text.trim()) ? -1 : 0,
    }))
    .filter(heading => heading.sign !== 0);
  return transactions
    .filter(transaction => !/^Subtotal:?$/i.test(transaction.description.trim()))
    .map(transaction => {
      const at = transaction.at;
      const heading = at
        ? headings
            .filter(found => before(found.at, at))
            .sort((a, b) => (before(a.at, b.at) ? -1 : 1))
            .at(-1)
        : undefined;
      const value = Math.abs(transaction.debit ?? transaction.credit ?? transaction.amount ?? 0);
      const description = transaction.description.replace(SUBTOTAL, '');
      if (!heading) {
        return { ...transaction, description };
      }
      const { debit: _debit, credit: _credit, amount: _amount, ...rest } = transaction;
      return { ...rest, description, ...(heading.sign > 0 ? { credit: value } : { debit: value }) };
    });
}

const KINDS: [RegExp, PaymentType][] = [
  [/^DEBIT CARD PURCHASE\b|^DOA PURCHASE\b/i, 'card'],
  [/\bATM CASH WITHDRAW\b|^(?:DOA )?WITHDRAW\b|^CASH DEPOSIT\b/i, 'cash'],
  [/^ACH DEBIT\b/i, 'direct_debit'],
];

export function fifthThirdEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = /\bTransfer\b/i.test(text)
    ? Number(row.credit) > 0
      ? 'bank_transfer_in'
      : 'bank_transfer_out'
    : KINDS.find(([pattern]) => pattern.test(text))?.[1];
  return kind ? { ...row, paymentType: kind } : row;
}

/**
 * Fifth Third Bank (US) statement of account: an account summary, then lists
 * of deposits, electronic deposits, electronic payments and other
 * withdrawals, each with posting date, description and an unsigned amount,
 * closed by a subtotal. The generic layout reading does the rows; this names
 * the bank, signs every row by the list it is printed in and types it.
 */
export class FifthThirdParser extends BankPdfParser {
  protected readonly bank = BankName.FIFTH_THIRD;

  protected recognises(text: string): boolean {
    return isFifthThirdStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return fifthThirdEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return signByHeading(rows, super.readTransactions(rows));
  }
}

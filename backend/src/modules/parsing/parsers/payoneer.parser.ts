import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The company's footer: "© 2005-2024 Payoneer, All Rights Reserved | www.payoneer.com". */
const PAYONEER_FOOTER = /\bPayoneer, All Rights Reserved\b|\bwww\.payoneer\.com\b/i;
const TRANSACTIONS = /\bTransactions\b[\s\S]*\bDate\s+Description\s+Amount\s+Status\b/i;

export function isPayoneerStatement(text: string): boolean {
  return PAYONEER_FOOTER.test(text) && TRANSACTIONS.test(text);
}

/** The customer number printed alone under the address. */
const ACCOUNT = /^\s*(\d{9,15})\s*$/m;

/** A payment that never moved money: its status says so at the end of its row. */
const NOT_DONE = /\b(?:Canceled|Cancelled|Failed|Declined|Rejected)$/i;

export function withoutUndoneRows(rows: PdfTextRow[]): PdfTextRow[] {
  return rows.filter(row => !NOT_DONE.test(row.text.trim()));
}

/** "Payment from ACME - XX-100000 (ACME LTD)", "Withdrawal to ACME Bank (1000)", "Payment to Member One". */
const PARTY =
  /^(?:Payment (?:from|to)|Withdrawal to|Transfer (?:from|to))\s+(.+?)(?:\s+-\s+XX-\d+.*|\s+\(\d{4}\))?$/i;

export function payoneerEntry(row: ParsedTransaction): ParsedTransaction {
  // The amount's currency code is printed past the amount column, into the text.
  const text = row.paymentPurpose
    .replace(/\s+/g, ' ')
    .replace(/ [A-Z]{3}$/, '')
    .trim();
  const party = PARTY.exec(text)?.[1];
  const incoming = Number(row.credit) > 0;
  return {
    ...row,
    paymentPurpose: text,
    counterpartyName: party ?? text,
    paymentType: incoming ? 'bank_transfer_in' : 'bank_transfer_out',
  };
}

/**
 * Payoneer transactions statement: the holder, the period and the customer
 * number, then Date, Description, Amount (signed, its currency after it)
 * and Status, newest first, with no balances. This names the company,
 * leaves out canceled and failed payments, and reads each row's party.
 */
export class PayoneerParser extends BankPdfParser {
  protected readonly bank = BankName.PAYONEER;

  protected recognises(text: string): boolean {
    return isPayoneerStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withoutUndoneRows(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return payoneerEntry(row);
  }
}

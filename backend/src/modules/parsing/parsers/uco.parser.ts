import { BankName } from '../../../entities/statement.entity';
import { indianRailType } from '../helpers/statement-india-rails.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's IFSC prefix and the statement's title line. */
const UCO_IFSC = /\bUCBA0\d{6}\b/;
const UCO_TITLE = /\bStatement for A\/c \d+ Between\b/i;

export function isUcoStatement(text: string): boolean {
  return UCO_IFSC.test(text) && UCO_TITLE.test(text);
}

const ACCOUNT = /\bStatement for A\/c (\d{8,20})\b/i;

/** "MPAY/UPI/TRTR/…": the mobile banking prefix before the rail. */
export function ucoEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const rail = text.replace(/^MPAY\//i, '').replace(/^IMPSI\b/i, 'IMPS');
  const paymentType = indianRailType(rail, Number(row.credit) > 0);
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * UCO Bank (India) account statement: the client, branch and IFSC, then
 * Date, Particulars, Instrument No, Withdrawals, Deposits and Balance,
 * newest first, each narration over two lines. The generic layout reading
 * does the table; this names the bank, takes the account number from the
 * title and reads the payment rails behind the mobile banking prefix.
 */
export class UcoParser extends BankPdfParser {
  protected readonly bank = BankName.UCO;

  protected recognises(text: string): boolean {
    return isUcoStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ucoEntry(row);
  }
}

import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { joinAmountLines } from '../helpers/pdf-layout-amount-lines.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's phone lines for personal and business accounts, and its BSB label. */
const NAB_PHONE = /\b13 22 65\b/;
const NAB_BSB = /\bBSB number\b/i;
const NAB_NAME = /\bNAB\b|\bNational Australia Bank\b/;

export function isNabStatement(text: string): boolean {
  return NAB_NAME.test(text) && NAB_PHONE.test(text) && NAB_BSB.test(text);
}

export function nabEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (/\bInternet Transfer\b|\bTransfer\b/i.test(text)) {
    return {
      ...row,
      paymentType: Number(row.credit) > 0 ? 'bank_transfer_in' : 'bank_transfer_out',
    };
  }
  if (/^Interest\b/i.test(text)) {
    return { ...row, paymentType: 'interest' };
  }
  return /\bFee\b/i.test(text) ? { ...row, paymentType: 'fee' } : row;
}

/**
 * National Australia Bank (NAB) account statement: an account balance
 * summary, then Date, Particulars, Debits, Credits and Balance ("Cr"), each
 * row's particulars over a dot leader to its amount on the line below, the
 * balance once a day. This names the bank, joins each amount line to its
 * particulars before the generic layout reading, and types the rows.
 */
export class NabParser extends BankPdfParser {
  protected readonly bank = BankName.NAB;

  protected recognises(text: string): boolean {
    return isNabStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(joinAmountLines(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return nabEntry(row);
  }
}

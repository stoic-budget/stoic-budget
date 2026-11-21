import { BankName } from '../../../entities/statement.entity';
import { indianRailType } from '../helpers/statement-india-rails.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's IFSC prefix and the statement's title. */
const UNION_IFSC = /\bUBIN0\d{6}\b/;
const UNION_TITLE = /\bDETAILS OF STATEMENT\b/i;

export function isUnionBankStatement(text: string): boolean {
  return UNION_IFSC.test(text) && UNION_TITLE.test(text);
}

/** The bank's own prefixes for the rails: "UPIAR/…" and "UPIAB/…" are UPI, "MOBFT" a mobile transfer. */
export function unionBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const rail = text.replace(/^UPIA[RB]\//i, 'UPI/').replace(/^MOBFT\b/i, 'IMPS');
  const paymentType = /^MAND DR\b/i.test(text)
    ? 'direct_debit'
    : /\bCharges? Recovery\b/i.test(text)
      ? 'fee'
      : indianRailType(rail, Number(row.credit) > 0);
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * Union Bank of India statement: the customer's details, IFSC and period,
 * then Tran Id, Tran Date, Remarks, Amount ("300.00 (Dr)") and Balance,
 * newest first, each remark over two lines. The generic layout reading
 * does the table; this names the bank and reads the payment rails behind
 * the bank's own prefixes.
 */
export class UnionBankOfIndiaParser extends BankPdfParser {
  protected readonly bank = BankName.UNION_BANK_OF_INDIA;

  protected recognises(text: string): boolean {
    return isUnionBankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return unionBankEntry(row);
  }
}

import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site in the letterhead, and the account line ("FNB Aspire Current Account : 6305…"). */
const FNB_SITE = /\bfnb\.co\.za\b/i;
const FNB_ACCOUNT = /\bFNB [A-Za-z ]*Account\s*:\s*\d{6,}/;

export function isFnbStatement(text: string): boolean {
  return FNB_SITE.test(text) && FNB_ACCOUNT.test(text);
}

/** What a row's first words say, and the party they name; a card purchase names the shop. */
const KINDS: [RegExp, PaymentType][] = [
  [/^(?:POS|Fuel) Purchase (.+?)(?:\s+\d{6}\*\d{4}\b.*)?$/i, 'card'],
  [/^ATM Cash\b()/i, 'cash'],
  [/^FNB App (?:Payment|Transfer) From (.+)$/i, 'bank_transfer_in'],
  [/^(?:FNB OB Pmt|Int-Banking Pmt Frm|Rtc Credit|Magtape Credit) (.+)$/i, 'bank_transfer_in'],
  [/^FNB App (?:Payment|Transfer) To (.+?)(?:\s+\d{9,})?$/i, 'bank_transfer_out'],
  [/^Send Money\b()/i, 'bank_transfer_out'],
  [/^#?(?:Service|Monthly Account|Cash Deposit|Cash Handling) Fees?\b()/i, 'fee'],
];

export function fnbEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/**
 * FNB (First National Bank, South Africa) current account statement:
 * "Transactions in RAND (ZAR)" with Date, Description, Amount, Balance and
 * Accrued Bank Charges, money in and credit balances marked "Cr", money out
 * and an overdrawn balance unmarked. The generic layout reading does the
 * table, the marks and the balances; this names the bank and reads each
 * row's kind and party.
 */
export class FnbParser extends BankPdfParser {
  protected readonly bank = BankName.FNB;

  protected recognises(text: string): boolean {
    return isFnbStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return fnbEntry(row);
  }
}

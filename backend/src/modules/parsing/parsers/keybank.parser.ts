import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's registered name in the contact box, and its phone line. */
const KEYBANK_NAME = /\bKeyBank National Association\b/i;
const KEYBANK_PHONE = /\b1-800-KEY2YOU\b/i;

export function isKeybankStatement(text: string): boolean {
  return KEYBANK_NAME.test(text) && KEYBANK_PHONE.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  [/^POS\s+(.+)$/i, 'card'],
  [/^ATM\b()/i, 'cash'],
  [/\bTreas\b.*\bTax Ref\b()/i, 'bank_transfer_in'],
  [/\bFee\b()/i, 'fee'],
];

export function keybankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  // A card purchase away from a Key terminal prints only the shop, its city and "USA".
  return / USA$/.test(text) && Number(row.debit) > 0 ? { ...row, paymentType: 'card' } : row;
}

/**
 * KeyBank (US) statement: the balance on the period's first and last day
 * with the additions and deductions between, then lists of deposits and
 * withdrawals, each with its total. The generic layout reading does the
 * lists and the balances; this names the bank and types the rows.
 */
export class KeybankParser extends BankPdfParser {
  protected readonly bank = BankName.KEYBANK;

  protected recognises(text: string): boolean {
    return isKeybankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return keybankEntry(row);
  }
}

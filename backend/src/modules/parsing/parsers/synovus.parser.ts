import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's mailing address in the letterhead and its web address. */
const SYNOVUS_ADDRESS = /\bP\.O\. Box 2646-R, Columbus, GA 31902\b/i;
const SYNOVUS_NAME = /\bSYNOVUS(?:\.COM| BANK)\b/i;

export function isSynovusStatement(text: string): boolean {
  return (
    SYNOVUS_ADDRESS.test(text) ||
    (SYNOVUS_NAME.test(text) && /\bStatement of Account\b/i.test(text))
  );
}

/** The Transaction Type column's words open the text: "Check Card Purchase  MERCHANT PURCHASE TERMINAL 100000  ACME". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:Check Card Purchase|POS Purchase)\b/i, 'card'],
  [/^Preauthorized Wd\b/i, 'direct_debit'],
  [/^(?:ATM Cash Deposit|ATM Withdrawal|ATM)\b/i, 'cash'],
  [/^(?:Overdraft|Service Charge|.*\bFee)\b/i, 'fee'],
  [
    /^(?:Preauthorized Credit|A2A Trsf Credit|Mobile Deposit|Deposit|Credit|Debit|Transfer)\b/i,
    'transfer',
  ],
];

/** "MERCHANT PURCHASE TERMINAL 449216 ACME STORE SAMPLETOWN CA TRAN DATE …": the shop after the terminal. */
const CARD_SHOP = /\bPURCHASE TERMINAL \S+ (.+?)(?: TRAN DATE\b.*)?$/i;

export function synovusEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, kind] of TYPES) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      const party = CARD_SHOP.exec(text)?.[1] ?? text.slice(match[0].length).trim();
      return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
    }
  }
  return row;
}

/**
 * Synovus (Georgia, US) statement of account: a summary of the accounts and
 * of each account's balances, then lists under their headings ("Deposits/
 * Other Credits", "Other Debits") with Date, Transaction Type, Description
 * and Amount, then the daily balances. The generic layout reading does the
 * lists; this names the bank and reads each row's type and party.
 */
export class SynovusParser extends BankPdfParser {
  protected readonly bank = BankName.SYNOVUS;

  protected recognises(text: string): boolean {
    return isSynovusStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return synovusEntry(row);
  }
}

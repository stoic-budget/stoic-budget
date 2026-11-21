import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the contact box and its web address. */
const SOFI_NAME = /\bSoFi Bank, N\.A\./i;
const SOFI_SITE = /\bwww\.sofi\.com\b/i;

export function isSofiStatement(text: string): boolean {
  return SOFI_NAME.test(text) && SOFI_SITE.test(text);
}

/** The Type column's words open the text: "Pay a Friend  Member One  Sender: …  Transaction ID: 33-1". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [/^Interest Earned\b/i, 'interest'],
  [/^Debit Card\b/i, 'card'],
  [/^(?:ATM|Cash)\b/i, 'cash'],
  [/^(?:Fee|Charge)\b/i, 'fee'],
  [/^(?:Pay a Friend|Deposit|Withdrawal|Direct Deposit|Transfer|Bill Pay)\b/i, 'transfer'],
];

export function sofiEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose
    .replace(/\s+/g, ' ')
    .replace(/ Transaction ID: \S+$/i, '')
    .trim();
  for (const [pattern, kind] of TYPES) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      const party = text
        .slice(match[0].length)
        .replace(/ Sender: .*$/i, '')
        .trim();
      return {
        ...row,
        paymentPurpose: text,
        paymentType,
        ...(party ? { counterpartyName: party } : {}),
      };
    }
  }
  return { ...row, paymentPurpose: text };
}

/**
 * SoFi (US) bank statement: the holder, account number and period, each
 * account's balances and interest, then Date, Type, Description, Amount and
 * Balance, newest first, each row's sender and transaction ID under it.
 * The generic layout reading does the table; this names the bank and reads
 * each row's type and party.
 */
export class SofiParser extends BankPdfParser {
  protected readonly bank = BankName.SOFI;

  protected recognises(text: string): boolean {
    return isSofiStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return sofiEntry(row);
  }
}

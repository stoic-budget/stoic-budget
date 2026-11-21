import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its US entity in the contact box. */
const UBS_SITE = /\bwww\.ubs\.com\b/i;
const UBS_NAME = /\bUBS (?:US AG|AG|Switzerland AG|Bank)\b/i;

export function isUbsStatement(text: string): boolean {
  return UBS_SITE.test(text) && UBS_NAME.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Purchase authorized\b/i, 'card'],
  [/\b(?:ATM|Cash) Withdrawal\b/i, 'cash'],
  [/\bFees?\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/^(?:Deposit|Transfer|Online Transfer|ACH|Wire)\b/i, 'transfer'],
];

export function ubsEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const check = /^(\d{3,6}) Check$/i.exec(text)?.[1];
  if (check) {
    return { ...row, documentNumber: check, counterpartyName: `Check ${check}` };
  }
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
 * UBS (US) bank statement of accounts: a summary of the accounts, then each
 * account's activity summary and transaction history with Date, Check
 * Number, Description, Deposits/Credits, Withdrawals/Debits and Ending
 * daily balance. The generic layout reading does the table; this names the
 * bank, reads checks by their number and types the rows.
 */
export class UbsParser extends BankPdfParser {
  protected readonly bank = BankName.UBS;

  protected recognises(text: string): boolean {
    return isUbsStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ubsEntry(row);
  }
}

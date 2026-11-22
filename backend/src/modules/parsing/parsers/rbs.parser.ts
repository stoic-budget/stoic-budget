import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal line and its BIC. */
const RBS_NAME = /\bRoyal Bank of Scotland\b/i;
const RBS_BIC = /\bRBOSGB2L\b|\bGB\d{2}\s?RBOS\b/;

export function isRbsStatement(text: string): boolean {
  return RBS_NAME.test(text) && RBS_BIC.test(text);
}

/** The Type column's words, before the description: "Faster Payment  ACME Store". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:DD|Direct Debit)\b/i, 'direct_debit'],
  [/^(?:SO|Standing Order)\b/i, 'standing_order'],
  [/^(?:Card|POS|Debit Card)\b/i, 'card'],
  [/^(?:ATM|Cash)\b/i, 'cash'],
  [/^Int\.? Bank\b|^Interest\b/i, 'interest'],
  [/^(?:Charges?|Fee)\b/i, 'fee'],
  [/^(?:Faster Payment|BACS|CHAPS|DIGITAL BANKING|AUTOMATED PAY IN|Transfer|CHQ)\b/i, 'transfer'],
];

export function rbsEntry(row: ParsedTransaction): ParsedTransaction {
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
      const party = text.slice(match[0].length).trim();
      return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
    }
  }
  return row;
}

/**
 * Royal Bank of Scotland (UK) current account statement, laid out as the
 * NatWest group's: account details, a summary from the previous to the new
 * balance, then Date, Type, Description, Paid In, Paid Out and Balance from
 * the balance brought forward. The generic layout reading does the table;
 * this names the bank and reads each row's type and party.
 */
export class RbsParser extends BankPdfParser {
  protected readonly bank = BankName.RBS;

  protected recognises(text: string): boolean {
    return isRbsStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return rbsEntry(row);
  }
}

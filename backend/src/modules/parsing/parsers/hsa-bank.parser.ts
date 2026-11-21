import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's line at the foot of every page and its client assistance center. */
const HSA_DIVISION = /\bHSA Bank\b.{0,5} is a division of Webster Bank\b/i;
const HSA_CENTER = /\bHSA Bank Client Assistance Center\b/i;
/** "Participant Account ID: xxxxxx0533". */
const PARTICIPANT = /\bParticipant Account ID:\s*([xX*\d]{4,})/;

export function isHsaBankStatement(text: string): boolean {
  return HSA_DIVISION.test(text) && HSA_CENTER.test(text);
}

/** The Method column ("EFT", "Debit Card") opens the text, then what the row is. */
const KINDS: [RegExp, PaymentType][] = [
  [/\bContribution\b/i, 'bank_transfer_in'],
  [/\bDistribution\b/i, 'bank_transfer_out'],
  [/^Debit Card\b/i, 'card'],
  [/\bInterest\b/i, 'interest'],
  [/\bFee\b/i, 'fee'],
];

export function hsaBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * HSA Bank (Webster Bank, US) health savings account statement: balances and
 * a summary of the cash account, then Date, Method, Description, Deposits,
 * Withdrawals, Balance and Notes. The generic layout reading does the table
 * and the balances; this names the bank, takes the participant account and
 * types contributions, distributions and card payments.
 */
export class HsaBankParser extends BankPdfParser {
  protected readonly bank = BankName.HSA_BANK;

  protected recognises(text: string): boolean {
    return isHsaBankStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return PARTICIPANT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return hsaBankEntry(row);
  }
}

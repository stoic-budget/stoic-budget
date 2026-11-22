import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The issuing bank's name and Marcus's web address in the letterhead. */
const GOLDMAN_NAME = /\bGoldman Sachs Bank USA\b/i;
const MARCUS_SITE = /\bMarcus\.com\b/i;

export function isMarcusStatement(text: string): boolean {
  return GOLDMAN_NAME.test(text) && MARCUS_SITE.test(text);
}

/** "ACH Deposit Internet transfer from ACME BANK, NA SAV account *** 1000": the bank across. */
const TRANSFER =
  /^ACH (Deposit|Withdrawal)\b.*?\b(?:from|to)\s+(.+?)(?:\s+(?:SAV|CHK|DDA)\b|\s+account\b|$)/i;

export function marcusEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const transfer = TRANSFER.exec(text);
  if (transfer) {
    const paymentType = /deposit/i.test(transfer[1]) ? 'bank_transfer_in' : 'bank_transfer_out';
    return { ...row, paymentType, counterpartyName: transfer[2].replace(/,$/, '') };
  }
  return /^Interest Paid\b/i.test(text) ? { ...row, paymentType: 'interest' } : row;
}

/**
 * Marcus by Goldman Sachs (US) online savings statement: a summary, then
 * Date, Description, Credits, Debits and Balance from the beginning balance
 * on, the month's interest last. The generic layout reading does the table;
 * this names the bank and reads the transfers' other bank.
 */
export class MarcusParser extends BankPdfParser {
  protected readonly bank = BankName.MARCUS;

  protected recognises(text: string): boolean {
    return isMarcusStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return marcusEntry(row);
  }
}

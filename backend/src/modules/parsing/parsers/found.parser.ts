import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** Every page's footer: Found is no bank, its partner bank holds the money. */
const FOUND_FOOTER = /\bFound is a financial technology company, not a bank\b/i;
/** "Statement period  Routing number  Account number" over the figures: the account is last. */
const ACCOUNT_UNDER_LABEL = /\bAccount number\s*\n[^\n]*?((?:\d{4} ?){3})\s*$/m;

export function isFoundStatement(text: string): boolean {
  return FOUND_FOOTER.test(text);
}

/** "Walmart (Sampletown, NC, USA) - TXN387777": the shop before the place. */
const CARD = /^(.+?) \([^)]*\) - TXN\d+$/;
const CHECK_DEPOSIT = /^Check Deposit from (.+?) - Check #(\d+)$/i;
const PAYROLL = /^Payroll Deduction - (.+?) - (.+)$/i;

export function foundEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const check = CHECK_DEPOSIT.exec(text);
  if (check) {
    return {
      ...row,
      counterpartyName: check[1],
      documentNumber: check[2],
      paymentType: 'bank_transfer_in',
    };
  }
  const payroll = PAYROLL.exec(text);
  if (payroll) {
    return { ...row, counterpartyName: payroll[2], paymentType: 'bank_transfer_out' };
  }
  const card = CARD.exec(text);
  return card ? { ...row, counterpartyName: card[1], paymentType: 'card' } : row;
}

/**
 * Found (US business banking, held at its partner bank) account statement: a
 * summary, then Date, Description, a signed Amount and Balance. The generic
 * layout reading does the table and the balances; this names the service,
 * takes the account number printed under its label and reads each row's party.
 */
export class FoundParser extends BankPdfParser {
  protected readonly bank = BankName.FOUND;

  protected recognises(text: string): boolean {
    return isFoundStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT_UNDER_LABEL.exec(text)?.[1].trim() ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return foundEntry(row);
  }
}

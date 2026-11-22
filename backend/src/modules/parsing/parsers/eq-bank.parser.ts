import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The card's name in the header and the bank's legal name in every page's footer. */
const EQ_CARD = /\bEQ Bank\b/;
const EQ_FOOTER = /\bEquitable Bank\b/;
/** "EQ Bank Cash Card - Ending in 3548". */
const CARD_ENDING = /\bEnding in (\d{4})\b/i;

export function isEqBankStatement(text: string): boolean {
  return EQ_CARD.test(text) && EQ_FOOTER.test(text);
}

const LINKED_TRANSFER = /^Transfer (?:from|to) Linked account\b/i;
const FEE_REBATE = /\bFee Rebate\b/i;

/**
 * A transfer from or to the linked account names no one; a rebate of an ATM
 * fee is money back; anything else taken from the card is a card payment,
 * named "ACME STORE, SAMPLETOWN, ON" (the shop, then where).
 */
export function eqBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (LINKED_TRANSFER.test(text)) {
    return {
      ...row,
      paymentType: Number(row.credit) > 0 ? 'bank_transfer_in' : 'bank_transfer_out',
    };
  }
  if (FEE_REBATE.test(text)) {
    return { ...row, paymentType: 'fee' };
  }
  return Number(row.debit) > 0 ? { ...row, paymentType: 'card' } : row;
}

/**
 * EQ Bank (Equitable Bank, Canada) Cash Card statement: "Activity details"
 * with Date, Description, Withdrawals and Deposits, newest first, dates
 * without a year, no balances. The generic layout reading does the table;
 * this names the bank, takes the card's last four digits as the account and
 * types the rows.
 */
export class EqBankParser extends BankPdfParser {
  protected readonly bank = BankName.EQ_BANK;

  protected recognises(text: string): boolean {
    return isEqBankStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return CARD_ENDING.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return eqBankEntry(row);
  }
}

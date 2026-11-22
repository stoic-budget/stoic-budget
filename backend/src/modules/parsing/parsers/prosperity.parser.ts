import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name, or its stock symbol at the foot of the page beside the FDIC line. */
const PROSPERITY_NAME = /\bProsperity Bank\b|\bprosperitybankusa\.com\b/i;
const PROSPERITY_SYMBOL = /\bNYSE Symbol "PB"/i;
const SUMMARY = /\bSTATEMENT SUMMARY\b[\s\S]*\bDAILY ENDING BALANCE\b/i;

export function isProsperityStatement(text: string): boolean {
  return (PROSPERITY_NAME.test(text) || PROSPERITY_SYMBOL.test(text)) && SUMMARY.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:POS Purchase|Debit Card)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\b(?:Fee|Service Charge)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/\b(?:Deposit|Transfer|ACH)\b/i, 'transfer'],
];

/** "POS Purchase ACME STORE SAMPLETOWN TX #1000": the shop, without the card's last digits. */
const CARD_SHOP = /^(?:POS Purchase|Debit Card - Sig|Debit Card)\s+(.+?)(?:\s+#\d{4})?$/i;

export function prosperityEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
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
  const shop = kind === 'card' ? CARD_SHOP.exec(text)?.[1] : undefined;
  return { ...row, paymentType, ...(shop ? { counterpartyName: shop } : {}) };
}

/**
 * Prosperity Bank (Texas, US) checking statement: a summary from the
 * beginning to the ending balance, then deposits/other credits, checks and
 * other debits, each list under its heading with Date, Description and
 * Amount, then the daily ending balances. The generic layout reading does
 * the lists; this names the bank and types the rows.
 */
export class ProsperityParser extends BankPdfParser {
  protected readonly bank = BankName.PROSPERITY;

  protected recognises(text: string): boolean {
    return isProsperityStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return prosperityEntry(row);
  }
}

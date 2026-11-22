import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal line at the foot of every page, and its BIC. */
const MONZO_NAME = /\bMonzo Bank Limited\b/i;
const MONZO_BIC = /\bMONZGB2L\b/;

export function isMonzoStatement(text: string): boolean {
  return MONZO_NAME.test(text) && MONZO_BIC.test(text);
}

/** "Member One (Faster Payments) Reference: rent": the party before the rail. */
const FASTER_PAYMENT = /^(.+?)\s*\(Faster Payments\)/i;
/** "Amount: EUR -109.40. Conversion rate: 1.153157.": a card payment abroad. */
const CONVERSION = /^Amount: [A-Z]{3} -?[\d.,]+\. Conversion rate/i;

export function monzoEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const transfer = FASTER_PAYMENT.exec(text);
  if (transfer) {
    const paymentType = Number(row.credit) > 0 ? 'bank_transfer_in' : 'bank_transfer_out';
    return { ...row, paymentType, counterpartyName: transfer[1] };
  }
  if (/^Cashwithdraw\b/i.test(text)) {
    return { ...row, paymentType: 'cash', counterpartyName: 'Cash withdrawal' };
  }
  if (CONVERSION.test(text) || / [A-Z]{3}$/.test(text)) {
    // A card payment ends with the shop's country: "ACME STORE SAMPLETOWN GBR".
    return { ...row, paymentType: 'card' };
  }
  return row;
}

/**
 * Monzo (UK) personal account statement: the balance and pots, then Date,
 * Description, (GBP) Amount and (GBP) Balance, newest first, a card
 * payment's text set over up to three lines around its date. The generic
 * layout reading does the table; this names the bank and reads transfers,
 * cash and card payments.
 */
export class MonzoParser extends BankPdfParser {
  protected readonly bank = BankName.MONZO;

  protected recognises(text: string): boolean {
    return isMonzoStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return monzoEntry(row);
  }
}

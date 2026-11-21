import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's registered name in the service box, and its account summary heading. */
const BOFA_NAME = /\bBank of America, N\.A\./;
const BOFA_SUMMARY = /\bAccount summary\b/;

export function isBankOfAmericaStatement(text: string): boolean {
  return BOFA_NAME.test(text) && BOFA_SUMMARY.test(text);
}

/** An ACH entry: the originator, then "DES:" with what it is for, ids, the receiver and the class. */
const ACH = /^(.+?)\s+DES:\s*(\S+)/;
const CHECK = /^\d{3,6}$/;
const BILL_PAYMENT = /^(.+?)\s+Bill Payment$/i;

const KINDS: [RegExp, PaymentType][] = [
  [/^Interest Earned\b/i, 'interest'],
  [/\bWITHDRWL\b|\bATM\b/i, 'cash'],
  [/^Online Banking (?:payment|transfer)\b|\bBill Payment$/i, 'bank_transfer_out'],
  [/^CHECKCARD\b|^PURCHASE\b/i, 'card'],
  [/\bFee\b/i, 'fee'],
];

/**
 * A row as Bank of America prints it. An ACH entry names its originator
 * before "DES:" ("SSA TREAS 310 DES:XXSOC SEC ID:… INDN:… CO ID:… PPD"): that
 * is the payee, a debit is a direct debit. A check prints only its number;
 * an online bill payment, the payee before "Bill Payment".
 */
export function bankOfAmericaEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (CHECK.test(text)) {
    return { ...row, counterpartyName: `Check ${text}`, documentNumber: text };
  }
  const ach = ACH.exec(text);
  if (ach) {
    return {
      ...row,
      counterpartyName: ach[1],
      paymentType: Number(row.credit) > 0 ? 'bank_transfer_in' : 'direct_debit',
    };
  }
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const payee = BILL_PAYMENT.exec(text)?.[1];
  return {
    ...row,
    ...(payee ? { counterpartyName: payee } : {}),
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * Bank of America (US) statement, often a combined one: each deposit account
 * under "Account number: …" with its summary (beginning and ending balance),
 * then deposits, other subtractions, checks in two columns and service fees,
 * each list signed and totalled. The generic layout reading does the lists,
 * the accounts and their balances; this names the bank and reads the rows.
 */
export class BankOfAmericaParser extends BankPdfParser {
  protected readonly bank = BankName.BANK_OF_AMERICA;

  protected recognises(text: string): boolean {
    return isBankOfAmericaStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return bankOfAmericaEntry(row);
  }
}

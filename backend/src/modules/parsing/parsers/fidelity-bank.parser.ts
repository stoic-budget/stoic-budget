import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site in the letterhead and the money columns of its table. */
const FIDELITY_SITE = /\bfidelitybank\.ng\b/i;
const FIDELITY_TABLE = /\bPay In\b[\s\S]*?\bPay Out\b/;

export function isFidelityBankStatement(text: string): boolean {
  return FIDELITY_SITE.test(text) && FIDELITY_TABLE.test(text);
}

/** "ONB TRF TO ACME C **3435 - ACME-BANK": an online transfer, the payee before the masked account. */
const ONLINE_TRANSFER = /^(?:ONB|\d+) (?:TRF|TRANSFER) TO (.+?)(?:\s+\*\*\d+| \d{10}\b|$)/i;
/** "MEMBER ONE/Transfer from MEMBER ONE": an incoming transfer, the sender before the slash. */
const SENDER = /^([A-Za-z][A-Za-z .'-]+?)\s*\//;
const FEE = /\bCHARGES?\b|\bFEE\b/i;

export function fidelityBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (FEE.test(text) && Number(row.debit) > 0) {
    return { ...row, paymentType: 'fee' };
  }
  const payee = ONLINE_TRANSFER.exec(text)?.[1];
  if (payee) {
    return { ...row, counterpartyName: payee, paymentType: 'bank_transfer_out' };
  }
  const sender = Number(row.credit) > 0 ? SENDER.exec(text)?.[1] : undefined;
  return sender ? { ...row, counterpartyName: sender, paymentType: 'bank_transfer_in' } : row;
}

/**
 * Fidelity Bank (Nigeria) account statement: Transaction Date, Value Date,
 * Channel, Details, Pay In, Pay Out and Balance, dates as "2-Apr-24", between
 * an opening and a closing balance row. The generic layout reading does the
 * table and the balances; this names the bank and reads each row's payee.
 */
export class FidelityBankParser extends BankPdfParser {
  protected readonly bank = BankName.FIDELITY_BANK;

  protected recognises(text: string): boolean {
    return isFidelityBankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return fidelityBankEntry(row);
  }
}

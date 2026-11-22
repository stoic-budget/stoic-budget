import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The company's footer and the statement's title. */
const SOGEXIA_SITE = /\bwww\.sogexia\.com\b|\bsupport@sogexia\.com\b/i;
const SOGEXIA_TITLE = /\bACCOUNT STATEMENT N°/i;

export function isSogexiaStatement(text: string): boolean {
  return SOGEXIA_SITE.test(text) && SOGEXIA_TITLE.test(text);
}

/** "IBAN GB00 SAMP 0000 1000 0000 01" on a line of its own under the BIC. */
const IBAN = /^IBAN\s+([A-Z]{2}\d{2}[A-Z0-9 ]{10,40})$/m;

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^FEES\b/i, 'fee'],
  [/^Credit card load\b/i, 'bank_transfer_in'],
  [/^(?:BANK|INSTANT) TRANSFER\b/i, 'transfer'],
  [/^(?:CARD|PAYMENT CARD|Card payment)\b/i, 'card'],
  [/^(?:ATM|WITHDRAWAL)\b/i, 'cash'],
];

export function sogexiaEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "INSTANT TRANSFER Member One  IBAN: GB00…": the party before the IBAN.
  const party =
    kind === 'transfer'
      ? /^(?:BANK|INSTANT) TRANSFER (.+?)(?= IBAN:|$)/i.exec(text)?.[1]
      : undefined;
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Sogexia (France) prepaid account statement: the holder, BIC and IBAN,
 * then Date, Operation, Debit (€) and Credit (€) from the former to the new
 * balance, each row's kind and party over its date and its card or IBAN
 * under it. The generic layout reading does the table; this names the
 * company, takes the IBAN as printed and reads each row's kind and party.
 */
export class SogexiaParser extends BankPdfParser {
  protected readonly bank = BankName.SOGEXIA;

  protected recognises(text: string): boolean {
    return isSogexiaStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return IBAN.exec(text)?.[1].replace(/\s+/g, '') ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return sogexiaEntry(row);
  }
}

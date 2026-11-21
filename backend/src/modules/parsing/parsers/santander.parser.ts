import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its legal name at the foot of the page. */
const SANTANDER_SITE = /\bsantander\.co\.uk\b/i;
const SANTANDER_NAME = /\bSantander UK plc\b/i;

export function isSantanderStatement(text: string): boolean {
  return SANTANDER_SITE.test(text) && SANTANDER_NAME.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  // "DIRECT DEBIT PAYMENT TO ACME PAYMENT REF 1000, MANDATE NO 0015".
  [/^DIRECT DEBIT PAYMENT TO (.+?)(?:,? (?:PAYMENT )?REF\b.*)?$/i, 'direct_debit'],
  // "BILL PAYMENT VIA FASTER PAYMENT TO MEMBER ONE REFERENCE rent, MANDATE NO 4".
  [
    /^(?:BILL PAYMENT VIA FASTER PAYMENT|FASTER PAYMENTS?(?: SENT)?) TO (.+?)(?: REFE?R+E?N[CT]E\b.*)?$/i,
    'bank_transfer_out',
  ],
  [/^STANDING ORDER (?:VIA FASTER PAYMENT )?TO (.+?)(?: REFERENCE\b.*)?$/i, 'standing_order'],
  [
    /^(?:FASTER PAYMENTS RECEIPT|BANK GIRO CREDIT|CREDIT) (?:REF \S+ )?(?:FROM )?(.+?)$/i,
    'bank_transfer_in',
  ],
  [/^CARD PAYMENT TO (.+?)(?:,.*| ON \d.*)?$/i, 'card'],
  [/^CASH WITHDRAWAL\b()/i, 'cash'],
];

export function santanderEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return /\bInterest\b/i.test(text) ? { ...row, paymentType: 'interest' } : row;
}

/**
 * Santander (UK) current account statement, often a scan read by OCR: an
 * account summary from the balance brought forward to the closing balance,
 * then Date, Description, Money in, Money out and Balance, the dates with
 * their ordinals ("12th Apr"). The generic layout reading does the table;
 * this names the bank, leaves out rows the OCR left without words and reads
 * each row's kind and party.
 */
export class SantanderParser extends BankPdfParser {
  protected readonly bank = BankName.SANTANDER;

  protected recognises(text: string): boolean {
    return isSantanderStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(rows, reading).filter(row => row.description.trim() !== '');
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return santanderEntry(row);
  }
}

import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and the line on disagreeing with the entries, under its table. */
const ZENITH_NAME = /\bZENITH BANK PLC\b/i;
const ZENITH_NOTICE = /\bNotice of disagreement with the entries\b/i;
/** "Account Number: SA 2081012497": the account's kind, then its NUBAN. */
const ACCOUNT = /\bAccount Number:\s*(?:[A-Z]{2}\s+)?(\d{10})\b/i;

export function isZenithStatement(text: string): boolean {
  return ZENITH_NAME.test(text) && ZENITH_NOTICE.test(text);
}

export function zenithAccount(text: string): string | null {
  return ACCOUNT.exec(text)?.[1] ?? null;
}

const NOTICE_WORDS = ['PLEASE', 'EXAMINE', 'THIS', 'STATEMENT', 'AT', 'ONCE'];

/**
 * Each page's notice, "PLEASE EXAMINE THIS STATEMENT AT ONCE", is printed
 * across the last row of its table, and the lines on disagreeing with the
 * entries run under it: the row keeps its own words, the lines go.
 */
export function withoutNotice(rows: PdfTextRow[]): PdfTextRow[] {
  const footerAt = new Map<number, number>();
  for (const row of rows) {
    if (/^Failing receipt by the bank\b/i.test(row.text.trim())) {
      footerAt.set(row.page, Math.min(row.y, footerAt.get(row.page) ?? row.y));
    }
  }
  return rows
    .filter(row => row.y < (footerAt.get(row.page) ?? Number.POSITIVE_INFINITY))
    .map(row => {
      const words = row.items.map(item => item.text);
      let next = 0;
      const notice = new Set<number>();
      words.forEach((word, index) => {
        if (word === NOTICE_WORDS[next]) {
          notice.add(index);
          next += 1;
        }
      });
      if (next < NOTICE_WORDS.length) {
        return row;
      }
      const items = row.items.filter((_, index) => !notice.has(index));
      return { ...row, items, text: items.map(item => item.text).join(' ') };
    })
    .filter(row => row.items.length > 0);
}

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [/\bATM Wdl\b|^CASH PD\b/i, 'cash'],
  [/\b(?:Charge|CHG|COT|VAT|Fee)\b/i, 'fee'],
  [/\bAirtime\b/i, 'card'],
  [
    /^(?:NIP|TRF|OUTFLOW|CD)\b/i,
    'transfer',
    /^(?:NIP CR\/|NIP\/[A-Z]+\/|TRF (?:TO|IFO) |OUTFLOW TO )([^/]+?)(?:\/|$)/i,
  ],
];

export function zenithEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text));
  if (!found) {
    return row;
  }
  const [, kind, partyPattern] = found;
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = partyPattern?.exec(text)?.[1]?.trim();
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Zenith Bank (Nigeria) statement: the account's NUBAN, currency and a
 * summary from the opening to the closing balance, then Date Posted, Value
 * Date, Description, Debit, Credit and Balance. The generic layout reading
 * does the table; this names the bank, reads the account number, takes the
 * page's notice off the last row and types the rows (NIP transfers, ATM
 * withdrawals, charges).
 */
export class ZenithParser extends BankPdfParser {
  protected readonly bank = BankName.ZENITH;

  protected recognises(text: string): boolean {
    return isZenithStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return zenithAccount(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withoutNotice(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return zenithEntry(row);
  }
}

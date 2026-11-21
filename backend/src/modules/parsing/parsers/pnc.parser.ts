import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's phone line and web address in the letterhead. */
const PNC_PHONE = /\b1-888-PNC-BANK\b/i;
const PNC_SITE = /\bpnc\.com\b/i;

export function isPncStatement(text: string): boolean {
  return PNC_PHONE.test(text) && PNC_SITE.test(text);
}

/** "There were 15 other Banking Machine/Debit Card deductions totaling $410.64.": a note in the margin. */
const NOTE_START = /^There (?:were|was)\b/i;

/**
 * Each list prints notes on its count and total in the right margin, on the
 * rows' own lines (and on the list's heading): from the first note down, the
 * words from the notes' left edge on are left out of the page's rows.
 */
export function withoutMarginNotes(rows: PdfTextRow[]): PdfTextRow[] {
  const notes = new Map<number, { x: number; y: number }>();
  for (const row of rows) {
    const items = [...row.items].sort((a, b) => a.x - b.x);
    items.forEach((item, index) => {
      const words = items
        .slice(index, index + 2)
        .map(word => word.text)
        .join(' ');
      const seen = notes.get(row.page);
      if (index > 0 && NOTE_START.test(words) && (!seen || row.y < seen.y)) {
        notes.set(row.page, { x: Math.min(item.x, seen?.x ?? item.x), y: row.y });
      }
    });
  }
  return rows
    .map(row => {
      const note = notes.get(row.page);
      if (!note || row.y < note.y) {
        return row;
      }
      const items = row.items.filter(item => item.x < note.x - 1);
      return { ...row, items, text: items.map(item => item.text).join(' ') };
    })
    .filter(row => row.items.length > 0);
}

/** "Beginning … Ending balance" over "770.78  .00  777.78  7.00-": the balance summary. */
const SUMMARY =
  /Beginning Deposits and Checks and other Ending balance other additions deductions balance (\S+) (\S+) (\S+) (\S+)/i;

export function pncBalances(text: string): { start: number; end: number } | null {
  const match = SUMMARY.exec(text.replace(/\s+/g, ' '));
  const start = match ? parseStatementAmount(match[1]) : null;
  const end = match ? parseStatementAmount(match[4]) : null;
  return start !== null && end !== null ? { start, end } : null;
}

const KINDS: [RegExp, PaymentType][] = [
  [/\b(?:POS Purchase|Debit Card Purchase|Recurring Debit Card)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\bService Charge\b|\bFee\b/i, 'fee'],
  [/\bDirect Deposit\b|\bACH Credit\b/i, 'bank_transfer_in'],
  [/\bACH Debit\b|\bOnline Transfer\b/i, 'bank_transfer_out'],
];

/** "3880 Debit Card Purchase ACME Store": the card's last digits, then the shop. */
const CARD_SHOP = /^(?:\d{4} )?(?:POS Purchase|Debit Card Purchase|Recurring Debit Card) (.+)$/i;

export function pncEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const shop = CARD_SHOP.exec(text)?.[1];
  return {
    ...row,
    ...(paymentType ? { paymentType } : {}),
    ...(shop ? { counterpartyName: shop } : {}),
  };
}

/**
 * PNC Bank (US) Virtual Wallet statement: notices, a balance summary grid
 * (beginning balance, additions, deductions, ending balance), then activity
 * lists under their headings (deposits, card withdrawals and purchases,
 * other deductions) with Date, Amount and Description, each list's count
 * and total noted in the margin. This names the bank, leaves the margin
 * notes out, takes the balances from the summary and types the rows; the
 * generic layout reading does the lists.
 */
export class PncParser extends BankPdfParser {
  protected readonly bank = BankName.PNC;

  protected recognises(text: string): boolean {
    return isPncStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const balances = pncBalances(text);
    return balances
      ? {
          ...statement,
          metadata: {
            ...statement.metadata,
            balanceStart: balances.start,
            balanceEnd: balances.end,
          },
        }
      : statement;
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withoutMarginNotes(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return pncEntry(row);
  }
}

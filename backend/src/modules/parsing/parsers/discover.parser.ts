import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutColumn } from '../helpers/pdf-layout-columns.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The card's issuer in the notes, and the cardmember line of the header. */
const DISCOVER_ISSUER = /\bissued by Discover Bank\b/i;
const DISCOVER_CARD = /\bDiscover it\b|\bCardmember Since\b/i;
/** "Account number ending in 6789" in every page's header. */
const ACCOUNT_ENDING = /\bAccount number ending in (\d{4})\b/i;

export function isDiscoverStatement(text: string): boolean {
  return DISCOVER_ISSUER.test(text) && DISCOVER_CARD.test(text);
}

/** The secured card's deposit account, after the card's own activity: a statement of its own. */
const DEPOSIT_ACTIVITY = /^SECURITY DEPOSIT ACCOUNT ACTIVITY$/i;
const PAYMENT = /^(?:INTERNET|ONLINE|DIRECTPAY|AUTOPAY)?\s*PAYMENT\b/i;
/** A group's total ("TOTAL FEES FOR THIS PERIOD $ 0.00") and the year's totals: no rows. */
const TOTALS =
  /\bTOTAL (?:FEES|INTEREST) (?:FOR THIS PERIOD|CHARGED IN)\b|\bTotals Year-to-Date\b/i;

export function discoverEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (PAYMENT.test(text) && Number(row.credit) > 0) {
    return { ...row, paymentType: 'bank_transfer_in' };
  }
  return Number(row.debit) > 0 ? { ...row, paymentType: 'card' } : row;
}

const words = (row: PdfTextRow) => row.items.map(item => item.text.toLowerCase());

/**
 * The columns of the transactions table from its header, which names the two
 * dates only ("Trans. Date  Post Date"): the text starts after the post date,
 * and the amount is the figure at the right edge (a "$" before the first one
 * of each group).
 */
function discoverColumns(header: PdfTextRow, rows: PdfTextRow[]): LayoutColumn[] | null {
  const items = [...header.items].sort((a, b) => a.x - b.x);
  const trans = items.find(item => /^trans\.?$/i.test(item.text));
  const post = items.find(item => /^post$/i.test(item.text));
  const dates = items.filter(item => /^date$/i.test(item.text));
  if (!(trans && post && dates.length === 2)) {
    return null;
  }
  const right = Math.max(...rows.flatMap(row => row.items.map(item => item.x + item.width)));
  const amountLeft = right - 90;
  return [
    { role: 'date', x0: trans.x, x1: dates[0].x + dates[0].width },
    { role: 'otherDate', x0: post.x, x1: dates[1].x + dates[1].width },
    { role: 'description', x0: dates[1].x + dates[1].width + 5, x1: amountLeft - 5 },
    { role: 'amount', x0: amountLeft, x1: right + 5 },
  ];
}

/**
 * Discover (US) card statement: an account summary, then "Transactions" in
 * groups (Payments and Credits, Merchandise, Restaurants…) named left of the
 * dates, with a header naming the two dates only, a signed amount at the
 * right edge and dates without a year. A secured card adds its deposit
 * account's activity after it. This names the card, reads the table with the
 * columns its header implies, leaves the deposit account out and types the
 * rows; the generic reading does the dates, the card signs and the balances.
 */
export class DiscoverParser extends BankPdfParser {
  protected readonly bank = BankName.DISCOVER;

  protected recognises(text: string): boolean {
    return isDiscoverStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT_ENDING.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return discoverEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const ordered = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
    const headerAt = ordered.findIndex(row => {
      const said = words(row);
      return said.includes('trans.') && said.includes('post');
    });
    const end = ordered.findIndex(row => DEPOSIT_ACTIVITY.test(row.text.trim()));
    const table = ordered.slice(headerAt + 1, end === -1 ? undefined : end);
    const columns = headerAt === -1 ? null : discoverColumns(ordered[headerAt], table);
    if (!columns) {
      return super.readTransactions(rows);
    }
    // The group's name ("Merchandise") sits left of the dates and a "$" before the
    // group's first amount: neither is part of the row.
    const dateLeft = columns[0].x0 - 5;
    const cells = table
      .filter(row => !TOTALS.test(row.text))
      .map(row => ({
        ...row,
        items: row.items.filter(item => item.x >= dateLeft && item.text !== '$'),
      }));
    return super.readTransactions(cells, { ...this.reading, columns });
  }
}

// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { findCzechAccount } from '../helpers/statement-czech-account.helper';

/**
 * Revolut Bank's multi-currency statement: a section per currency, each page
 * of it headed "CZK Statement", the section's first page with its balance
 * summary ("Account (Current Account)  opening  money out  money in
 * closing"), then the rows. A row may carry a fee on the line under it
 * ("Fee: 12.50 CZK 1,262.50 CZK").
 */

/** "CZK Statement", a line of its own heading a page of that currency's section. */
export const SECTION = /^\s*([A-Z]{3}) Statement\s*$/;
/** The section's summary line, its four figures after the product's name. */
const SUMMARY = /^\s*Account \(Current Account\)\s+(.+)$/;
const MONEY = /-?[€$£¥]?\d{1,3}(?:,\d{3})*\.\d{2}/g;

export interface RevolutSection {
  currency: string;
  /** The section's IBAN when its pages print one. */
  iban?: string;
  start?: number;
  out?: number;
  in?: number;
  end?: number;
}

/**
 * Each section's summary and IBAN, from the statement's lines in reading
 * order; a section's first summary is its own (a later page repeats none).
 */
export function revolutSections(lines: string[]): Map<string, RevolutSection> {
  const sections = new Map<string, RevolutSection>();
  let current: RevolutSection | undefined;
  for (const line of lines) {
    const heading = line.match(SECTION)?.[1];
    if (heading) {
      current = sections.get(heading) ?? { currency: heading };
      sections.set(heading, current);
      continue;
    }
    const figures = line.match(SUMMARY)?.[1].match(MONEY);
    if (current && figures?.length === 4 && current.start === undefined) {
      [current.start, current.out, current.in, current.end] = figures.map(
        text => parseStatementAmount(text) ?? undefined,
      );
    }
    if (current && !current.iban && /\bIBAN\b/.test(line)) {
      current.iban = findCzechAccount(line) ?? undefined;
    }
  }
  return sections;
}

const byPosition = (a: { page: number; y: number }, b: { page: number; y: number }) =>
  a.page - b.page || a.y - b.y;

/** The currency section a position on the page falls in: the last heading at or above it. */
export function sectionAt(
  rows: PdfTextRow[],
): (at?: { page: number; y: number }) => string | undefined {
  const headings = rows
    .map(row => ({ page: row.page, y: row.y, currency: row.text.match(SECTION)?.[1] }))
    .filter((heading): heading is { page: number; y: number; currency: string } =>
      Boolean(heading.currency),
    )
    .sort(byPosition);
  return at =>
    at ? headings.filter(heading => byPosition(heading, at) <= 0).at(-1)?.currency : undefined;
}

/** "Fee: 12.50 CZK 1,262.50 CZK": the fee, then the row's amount with it. */
const FEE =
  /^Fee:\s+[€$£¥]?(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s?[A-Z]{3})?\s+[€$£¥]?(\d{1,3}(?:,\d{3})*\.\d{2})/;
const figure = (text: string) => Number(text.replace(/,/g, ''));
const same = (a: number, b: number) => Math.abs(a - b) < 0.02;

/**
 * A row's fee, as zumfi reads it: money in printed net of its fee ("1,250.00"
 * in, "Fee: 12.50 … 1,262.50") is booked gross with the fee as a row of its
 * own, as the section's summary counts them; a fee already inside money out
 * ("600.00" out, "Fee: 20.00 … 580.00") is left in it.
 */
export function withFees(read: LayoutTransaction[], blocks: PdfTextRow[][]): LayoutTransaction[] {
  return read.flatMap((row, index) => {
    const fee = blocks[index]
      ?.slice(1)
      .map(line => line.text.trim().match(FEE))
      .find(Boolean);
    const credit = row.credit ?? (row.amount !== undefined && row.amount > 0 ? row.amount : null);
    if (!(fee && credit)) {
      return [row];
    }
    const [amount, withFee] = [figure(fee[1]), figure(fee[2])];
    if (!same(withFee, credit + amount)) {
      return [row];
    }
    const gross = Math.round((credit + amount) * 100) / 100;
    return [
      {
        ...row,
        ...(row.credit !== undefined ? { credit: gross } : { amount: gross }),
        balance: undefined,
      },
      {
        ...row,
        credit: undefined,
        amount: undefined,
        debit: amount,
        description: `Fee: ${row.description}`,
        firstLine: `Fee: ${row.firstLine}`,
        counterparty: 'Revolut',
      },
    ];
  });
}

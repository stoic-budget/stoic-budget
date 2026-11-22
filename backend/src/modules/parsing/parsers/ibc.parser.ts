import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site in the contact box and its account recap. */
const IBC_SITE = /\bwww\.IBC\.com\b/i;
const IBC_RECAP = /\bAccount Recap\b/;

export function isIbcStatement(text: string): boolean {
  return IBC_SITE.test(text) && IBC_RECAP.test(text);
}

const AMOUNT = '(-?(?:\\d{1,3}(?:,\\d{3})*|\\d*)\\.\\d{2})';
/** "11/12   1,439.00", "11/22   1681   75.00", "11/01   1716*   11.70": three to a line. */
const GRID_ENTRY = new RegExp(`(\\d{2}/\\d{2})\\s+(?:(\\d{2,9})\\*?\\s+)?${AMOUNT}`, 'g');
/** "11/04   ACH Deposit ACME FndTrnsfr   600.00". */
const LISTED = new RegExp(`^(\\d{2}/\\d{2})\\s+(.+?)\\s+${AMOUNT}$`);
/** A mailing code ("00001018 0055956 0001-0004") or the barcode's ones and zeros. */
const NOISE = /^(?:[01]{16,}|\d{8}(?: \d{7})?(?: \d{4}-\d{4})?)$/;

type Part = 'deposits' | 'checks' | 'credits' | 'debits' | null;

function partOf(text: string, current: Part): Part | 'end' | undefined {
  if (/^Deposits \(Credits\)$/i.test(text)) return 'deposits';
  if (/^Checks \(Debits\)$/i.test(text)) return 'checks';
  if (/^Credits$/i.test(text)) return 'credits';
  if (/^Debits$/i.test(text)) return 'debits';
  if (/^(?:Daily Ending Balance|Important Notice\b)/i.test(text)) return 'end';
  return current === null ? undefined : undefined;
}

function entry(
  day: string,
  text: string,
  amount: string,
  part: Part,
  row: PdfTextRow,
): LayoutTransaction | null {
  const date = parseDateParts(day, 'mdy');
  const value = parseStatementAmount(amount);
  if (!date || value === null) {
    return null;
  }
  const side = part === 'deposits' || part === 'credits' ? 'credit' : 'debit';
  return {
    date,
    dateText: day,
    description: text,
    firstLine: text,
    counterparty: '',
    [side]: Math.abs(value),
    at: { page: row.page, y: row.y },
  };
}

/**
 * The lists line by line: deposits and checks three to a line, then the
 * electronic credits and debits, up to the daily ending balances. The
 * barcode beside the first page is left out.
 */
export function readIbcRows(rows: PdfTextRow[]): LayoutTransaction[] {
  const read: LayoutTransaction[] = [];
  let part: Part = null;
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    const words = [...row.items].sort((a, b) => a.x - b.x).filter(item => !NOISE.test(item.text));
    const text = words
      .map(item => item.text)
      .join(' ')
      .trim();
    const next = partOf(text, part);
    if (next === 'end') {
      part = null;
      continue;
    }
    if (next) {
      part = next;
      continue;
    }
    if (part === 'deposits' || part === 'checks') {
      for (const [, day, number, amount] of text.matchAll(GRID_ENTRY)) {
        const label =
          part === 'checks'
            ? `CHECK ${number ?? ''}`.trim()
            : `DEPOSIT${number ? ` ${number}` : ''}`;
        const found = entry(day, label, amount, part, row);
        read.push(...(found ? [found] : []));
      }
    } else if (part) {
      const match = LISTED.exec(text);
      const found = match ? entry(match[1], match[2], match[3], part, row) : null;
      read.push(...(found ? [found] : []));
    }
  }
  return read;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Check Card (?:Debit|Credit) (.+?)(?:\s+[A-Z]{2})?$/i, 'card'],
  [/^ATM Withdrawal\b()/i, 'cash'],
  [/^ACH Payment (.+)$/i, 'direct_debit'],
  [/^ACH Deposit (.+)$/i, 'bank_transfer_in'],
  [/^Transfer (?:Withdrawal|Deposit)\b()/i, 'transfer'],
  [/\bFee\b()/i, 'fee'],
];

export function ibcEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const check = /^CHECK (\d+)$/.exec(text)?.[1];
  if (check) {
    return { ...row, counterpartyName: `Check ${check}`, documentNumber: check };
  }
  for (const [pattern, kind] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/** "Beginning Balance … Closing Balance" over its figures in the account recap. */
const RECAP = /Account Recap[\s\S]*?\n[^\n]*Balance[^\n]*\n([^\n]*\d[^\n]*)/;

/**
 * IBC (International Bank of Commerce, US) checking statement: an account
 * recap (beginning balance, credits, debits, closing balance), deposits and
 * checks three to a line, electronic credits and debits, and daily ending
 * balances. This names the bank, reads the lists line by line, takes the
 * balances from the recap and reads the rows' kinds and parties.
 */
export class IbcParser extends BankPdfParser {
  protected readonly bank = BankName.IBC;

  protected recognises(text: string): boolean {
    return isIbcStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const figures = (RECAP.exec(text)?.[1] ?? '').trim().split(/\s+/).map(parseStatementAmount);
    const [start, end] = [figures[0], figures.at(-1)];
    return {
      ...statement,
      // The lists' totals are the generic table reading's, whose grids these rows are not read from.
      checks: statement.checks?.filter(check => check.code !== 'section_totals'),
      metadata: {
        ...statement.metadata,
        currency: 'USD',
        ...(start != null &&
          end != null &&
          figures.length >= 6 && { balanceStart: start, balanceEnd: end }),
      },
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ibcEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return readIbcRows(rows);
  }
}

import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's address line with its FDIC note, and the account line of every page. */
const FROST_ADDRESS = /\bFort Worth, Texas 76162 Member FDIC\b/i;
const FROST_ACCOUNT = /\bFROST [A-Z ]+: ACCOUNT NO\./;

/** The summary box is printed over a rule: "_¬F_¬R_¬O…", "8 4_ ,_ 3 8_ 5…". */
const unrule = (text: string) => text.replace(/[_¬]/g, '');

export function isFrostStatement(text: string): boolean {
  return FROST_ADDRESS.test(text) && FROST_ACCOUNT.test(unrule(text).replace(/ {2,}/g, ' '));
}

/** "------ DEPOSITS/CREDITS ------": the lists, by the side of their money; the daily balances end them. */
const SECTION =
  /^[-\s]*(DEPOSITS\/CREDITS|CHECKS PAID|OTHER WITHDRAWALS\/DEBITS|DAILY BALANCE)[-\s]*$/;
const AMOUNT = '((?:\\d{1,3}(?:,\\d{3})*|\\d*)\\.\\d{2})';
/** "09-03  24,493.33  WIRE TRANSFER  FROST BANK WIRE IN": the amount before the text. */
const AMOUNT_FIRST = new RegExp(`^(\\d{2}-\\d{2})\\s+${AMOUNT}\\s+(.+)$`);
/** "09-23 TELLER DEPOSIT 19,800.00 | 09-27 TELLER DEPOSIT 9,900.00": two to a line. */
const TEXT_FIRST = new RegExp(`(\\d{2}-\\d{2})\\s+([A-Z][A-Z /&.'-]*?)\\s+${AMOUNT}`, 'g');
/** "09-03  8773 * #  11,140.00": a check paid, three to a line. */
const CHECK = new RegExp(`(\\d{2}-\\d{2})\\s+(\\d{3,7})\\s*\\*?\\s*#?\\s+${AMOUNT}`, 'g');

function entry(
  dateText: string,
  description: string,
  amount: string,
  side: 'credit' | 'debit',
  row: PdfTextRow,
): LayoutTransaction | null {
  const date = parseDateParts(dateText, 'mdy');
  const value = parseStatementAmount(amount);
  if (!date || value === null) {
    return null;
  }
  const text = description.replace(/\s+/g, ' ').trim();
  return {
    date,
    dateText,
    description: text,
    firstLine: text,
    counterparty: '',
    [side]: Math.abs(value),
    at: { page: row.page, y: row.y },
  };
}

/**
 * The rows of the deposits, checks paid and other withdrawals lists, in the
 * order printed, each signed by its list. A check prints its number alone.
 */
export function readFrostRows(rows: PdfTextRow[]): LayoutTransaction[] {
  const read: LayoutTransaction[] = [];
  let section: string | null = null;
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    const text = row.text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
    const heading = SECTION.exec(text)?.[1];
    if (heading === 'DAILY BALANCE') {
      break;
    }
    if (heading) {
      section = heading;
      continue;
    }
    const side = section === 'DEPOSITS/CREDITS' ? 'credit' : 'debit';
    if (section === 'CHECKS PAID') {
      for (const [, date, number, amount] of text.matchAll(CHECK)) {
        const check = entry(date, `CHECK ${number}`, amount, side, row);
        read.push(...(check ? [{ ...check, counterparty: number }] : []));
      }
      continue;
    }
    if (!section) {
      continue;
    }
    const first = AMOUNT_FIRST.exec(text);
    const found = first
      ? [entry(first[1], first[3], first[2], side, row)]
      : Array.from(text.matchAll(TEXT_FIRST), ([, date, words, amount]) =>
          entry(date, words, amount, side, row),
        );
    read.push(...found.filter((item): item is LayoutTransaction => item !== null));
  }
  return read;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^DEBIT CARD PURCHASE\b/i, 'card'],
  [/^(?:TELLER DEPOSIT|TELLER WITHDRAWAL)\b/i, 'cash'],
  [/^ELECTRONIC DEBIT\b/i, 'direct_debit'],
  [/^ELECTRONIC DEPOSIT\b/i, 'bank_transfer_in'],
  [/\bFEE\b|\bSERVICE CHARGE\b/i, 'fee'],
  [/\bTRANSFER\b/i, 'transfer'],
];

/** "DEBIT CARD PURCHASE  ACME SUPPLY  SAMPLETOWN  CARD: 1000": the kind, then the party. */
const PARTY =
  /^(?:DEBIT CARD PURCHASE|ELECTRONIC (?:DEBIT|DEPOSIT))\s+(.+?)(?:\s{2,}|\s+CARD: \d+|$)/i;

export function frostEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const paymentType =
    found === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : found;
  const party = PARTY.exec(row.paymentPurpose.trim())?.[1];
  const check = /^CHECK (\d+)$/.exec(text)?.[1];
  return {
    ...row,
    ...(party ? { counterpartyName: party.trim() } : {}),
    ...(check ? { documentNumber: check, counterpartyName: `Check ${check}` } : {}),
    ...(paymentType ? { paymentType } : {}),
  };
}

/** "BALANCE LAST STATEMENT | NO. | AMOUNT | … | BALANCE THIS STATEMENT" over its figures. */
const SUMMARY = /BALANCE LAST STATEMENT[^\n]*\n([^\n]*)/;
const ACCOUNT = /ACCOUNT NO\.\s*(\d{2} \d{5,9})\b/;

/** The summary's figures, cell by cell: the balance last statement first, this one last. */
export function frostSummary(text: string): number[] {
  const line = SUMMARY.exec(unrule(text).replace(/ +/g, ' '))?.[1] ?? '';
  return line
    .split('|')
    .map(cell => parseStatementAmount(cell.replace(/\s+/g, '')))
    .filter((value): value is number => value !== null);
}

/**
 * Frost Bank (Texas, US) business checking statement: a summary of the
 * balances and the lists' counts and totals, then deposits/credits (two to a
 * line, or amount before text), checks paid three to a line, other
 * withdrawals/debits and daily balances, each list under a dashed heading,
 * then images of the checks. This names the bank, reads the lists line by
 * line and takes the balances from the summary.
 */
export class FrostParser extends BankPdfParser {
  protected readonly bank = BankName.FROST;

  protected recognises(text: string): boolean {
    return isFrostStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const figures = frostSummary(text);
    const account = ACCOUNT.exec(unrule(text).replace(/ {2,}/g, ' '))?.[1];
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        ...(account && { accountNumber: account }),
        ...(figures.length >= 2 && {
          balanceStart: figures[0],
          balanceEnd: figures[figures.length - 1],
        }),
      },
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return frostEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return readFrostRows(rows);
  }
}

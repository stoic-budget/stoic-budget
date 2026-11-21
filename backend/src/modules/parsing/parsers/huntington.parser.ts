import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the letterhead and its summary heading. */
const HUNTINGTON_NAME = /\bThe Huntington National Bank\b/i;
const HUNTINGTON_SUMMARY = /\bHuntington Relationship Summary\b|\bwww\.huntington\.com\b/i;

export function isHuntingtonStatement(text: string): boolean {
  return HUNTINGTON_NAME.test(text) && HUNTINGTON_SUMMARY.test(text);
}

/** "Check Activity (-)   Account: 02775173786", then "727068  3,000.00  11/25", two to a line. */
const CHECK_HEADING = /^Check Activity\b.*?(?:Account:\s*(\d+))?\s*$/i;
const CHECK = /\b(\d{3,9})\*?\s+((?:\d{1,3}(?:,\d{3})*|\d*)\.\d{2})\s+(\d{2}\/\d{2})\b/g;
const NEXT_SECTION = /\((?:\+|-)\)|Balance Activity\b/i;

/** The checks paid, two to a line under their heading: number, amount and the day paid. */
export function huntingtonChecks(rows: PdfTextRow[]): LayoutTransaction[] {
  const checks: LayoutTransaction[] = [];
  let account: string | null | undefined;
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    const heading = CHECK_HEADING.exec(row.text.trim());
    if (heading) {
      account = heading[1] ?? null;
      continue;
    }
    if (account === undefined) {
      continue;
    }
    if (NEXT_SECTION.test(row.text)) {
      account = undefined;
      continue;
    }
    for (const [, number, amount, day] of row.text.matchAll(CHECK)) {
      const date = parseDateParts(day, 'mdy');
      const value = parseStatementAmount(amount);
      if (date && value !== null) {
        checks.push({
          date,
          dateText: day,
          description: `CHECK ${number}`,
          firstLine: `CHECK ${number}`,
          counterparty: '',
          debit: value,
          at: { page: row.page, y: row.y },
          ...(account ? { account: { accountNumber: account } } : {}),
        });
      }
    }
  }
  return checks;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^PURCHASE (.+?)(?:\s+\d{16})?$/i, 'card'],
  [/^MERCHANDISE RET (.+?)(?:\s+\d{16})?$/i, 'card'],
  [/CASH WITHDRAWAL\b()/i, 'cash'],
  [/^INTERNET TFR\b()/i, 'transfer'],
  [/^PAYPAL TRANSFER\b()/i, 'transfer'],
  [/^INTEREST PAYMENT\b()/i, 'interest'],
  [/\bFEE\b()/i, 'fee'],
];

export function huntingtonEntry(row: ParsedTransaction): ParsedTransaction {
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

/**
 * Huntington (US) statement: a relationship summary, then each account's
 * activity in lists headed with their sign ("Deposit / Credit Activity (+)",
 * "Debit Card / POS Activity (-)") and the account, checks two to a line
 * with the day paid after the amount, and balance activity. The generic
 * layout reading does the lists, the accounts and their balances; this names
 * the bank, reads the checks and the rows' kinds and shops.
 */
export class HuntingtonParser extends BankPdfParser {
  protected readonly bank = BankName.HUNTINGTON;

  protected recognises(text: string): boolean {
    return isHuntingtonStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return huntingtonEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const read = super.readTransactions(rows);
    const checks = huntingtonChecks(rows);
    // Each account's rows stay together, its checks after its lists' rows.
    const accounts = [...new Set([...read, ...checks].map(row => row.account?.accountNumber))];
    return accounts.flatMap(account => [
      ...read.filter(row => row.account?.accountNumber === account),
      ...checks.filter(row => row.account?.accountNumber === account),
    ]);
  }
}

import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { rowBlocks } from '../helpers/pdf-layout-blocks.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { checkPrintedTotals } from '../helpers/statement-checks.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';
import { type RevolutSection, revolutSections, sectionAt, withFees } from './revolut-sections';

/** The company's legal line and the transactions table's title. */
const REVOLUT_NAME = /\bRevolut (?:Ltd|Bank UAB)\b/i;
const TRANSACTIONS = /\bAccount transactions from\b/i;
/** Revolut Bank's multi-currency statement heads each page "EUR Statement". */
const CURRENCY_SECTION = /^\s*[A-Z]{3} Statement\s*$/;

/**
 * Revolut's statement: the company's legal line and either the transactions
 * table's title (UK) or a page headed by its currency section, the company's
 * name just under it (Revolut Bank's multi-currency statement).
 */
export function isRevolutStatement(text: string): boolean {
  if (!REVOLUT_NAME.test(text)) {
    return false;
  }
  const lines = text.split('\n');
  return (
    TRANSACTIONS.test(text) ||
    lines.some(
      (line, index) =>
        CURRENCY_SECTION.test(line) &&
        lines.slice(index + 1, index + 6).some(next => /\bRevolut Bank UAB\b/i.test(next)),
    )
  );
}

/** Splits a section's account key: its IBAN (or none) and its currency. */
const KEY_SEPARATOR = '#';

/**
 * An account's balances from the statement's total line, or its currency
 * section's summary, whose money in and out its rows are held to as well; the
 * account's number is its section's IBAN, or none.
 */
export function withSummary<
  T extends Pick<ParsedStatement, 'metadata' | 'transactions' | 'checks'>,
>(
  account: T,
  sections: Map<string, RevolutSection>,
  total: { start: number; end: number } | null = null,
): T {
  const section = sections.get(account.metadata.currency ?? '');
  const balances =
    total ?? (section?.start !== undefined && section.end !== undefined ? section : null);
  const totals = section
    ? checkPrintedTotals(
        { credits: section.in ?? null, debits: section.out ?? null },
        account.transactions,
      )
    : null;
  const [number, keyed] = account.metadata.accountNumber.split(KEY_SEPARATOR);
  return {
    ...account,
    metadata: {
      ...account.metadata,
      ...(keyed !== undefined && { accountNumber: number }),
      ...(balances && { balanceStart: balances.start, balanceEnd: balances.end }),
    },
    // The section's summary stands in for the balances labelled elsewhere in
    // the file, which may be another section's.
    ...(totals && {
      checks: [
        ...(account.checks ?? []).filter(
          check => check.code !== totals.code && check.code !== 'printed_balances',
        ),
        totals,
      ],
    }),
  };
}

/** "Total  £0.44  £2,843.36  £3,770.00  £927.08": opening balance, money out, money in, closing balance. */
const SUMMARY_TOTAL = /^Total\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$/m;

export function revolutBalances(text: string): { start: number; end: number } | null {
  const match = SUMMARY_TOTAL.exec(text);
  const start = match ? parseStatementAmount(match[1]) : null;
  const end = match ? parseStatementAmount(match[4]) : null;
  return start !== null && end !== null ? { start, end } : null;
}

/**
 * "Reverted from 1 April 2024 to 30 April 2024" and "Pending from …" list
 * payments the balance never took: left out, up to the next account's
 * transactions.
 */
export function withoutRevertedRows(rows: PdfTextRow[]): PdfTextRow[] {
  let skipping = false;
  return [...rows]
    .sort((a, b) => a.page - b.page || a.y - b.y)
    .filter(row => {
      const text = row.text.trim();
      if (/^(?:Reverted|Pending) from\b/i.test(text)) {
        skipping = true;
      } else if (/^Account transactions from\b/i.test(text)) {
        skipping = false;
      }
      return !skipping;
    });
}

const KINDS: [RegExp, PaymentType][] = [
  // "Payment from Member One  From: MEMBER ONE, 10000001", "From ACME LTD  From: ACME LTD".
  [/^(?:Payment from|From) (.+?) From: /i, 'bank_transfer_in'],
  // "To Member Two  To: Member Two, 10000002 (GB)".
  [/^To (.+?) To: /i, 'bank_transfer_out'],
  // "ACME  To: Acme Shop, London Card: 400000******0001".
  [/^(.+?) To: .*\bCard:/i, 'card'],
  [/^(.+?) (?:plan )?fee$/i, 'fee'],
  // A fee booked apart from the money in it was taken from ("Fee: Exchanged from EUR").
  [/^(Fee: .+)$/i, 'fee'],
  [/^(Cash withdrawal|ATM)\b/i, 'cash'],
];

export function revolutEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, counterpartyName: paymentType === 'fee' ? text : match[1] };
    }
  }
  return row;
}

/**
 * Revolut (UK) account statement: a balance summary by product (opening
 * balance, money out, money in, closing balance), then Date, Description,
 * Money out, Money in and Balance, each row's party and card on the lines
 * under it ("To: ACME Shop, London Card: 400000******0001"). The generic
 * layout reading does the table; this names the company, leaves reverted
 * and pending payments out, takes the balances from the summary's total
 * line and reads each row's party and kind.
 */
export class RevolutParser extends BankPdfParser {
  protected readonly bank = BankName.REVOLUT;

  protected recognises(text: string): boolean {
    return isRevolutStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const sections = revolutSections(text.split('\n'));
    const total = revolutBalances(text);
    return {
      ...withSummary(statement, sections, total),
      ...(statement.otherAccounts && {
        otherAccounts: statement.otherAccounts.map(account => withSummary(account, sections)),
      }),
    };
  }

  /**
   * Each row belongs to the currency section it is printed in, an account of
   * its own (its IBAN and currency); a fee taken from money in is booked apart.
   */
  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    const kept = withoutRevertedRows(rows);
    const read = super.readTransactions(kept, reading);
    const sections = revolutSections(kept.map(row => row.text));
    const sectionOf = sectionAt(kept);
    return withFees(read, rowBlocks(kept, read)).map(row => {
      const currency = sectionOf(row.at);
      const iban = currency ? (sections.get(currency)?.iban ?? '') : undefined;
      return currency
        ? { ...row, account: { accountNumber: `${iban}${KEY_SEPARATOR}${currency}`, currency } }
        : row;
    });
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return revolutEntry(row);
  }
}

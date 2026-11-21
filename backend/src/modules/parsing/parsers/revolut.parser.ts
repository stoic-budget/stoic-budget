import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The company's legal line and the transactions table's title. */
const REVOLUT_NAME = /\bRevolut (?:Ltd|Bank UAB)\b/i;
const TRANSACTIONS = /\bAccount transactions from\b/i;

export function isRevolutStatement(text: string): boolean {
  return REVOLUT_NAME.test(text) && TRANSACTIONS.test(text);
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
    const balances = revolutBalances(text);
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
    return super.readTransactions(withoutRevertedRows(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return revolutEntry(row);
  }
}

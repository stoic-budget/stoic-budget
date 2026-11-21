import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { withSidesFromBalances } from '../helpers/pdf-layout-swapped-sides.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findStatementAmounts } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its "Orange Key" client login. */
const TANGERINE_SITE = /\bwww\.tangerine\.ca\b/i;
const TANGERINE_KEY = /\bOrange Key\b/i;

export function isTangerineStatement(text: string): boolean {
  return TANGERINE_SITE.test(text) && TANGERINE_KEY.test(text);
}

/** "The Details - Tangerine Savings Account - 1000000001": each account's table opens under it. */
const DETAILS = /^The Details - .+ - (\d[\d ]{5,})$/i;

const atOrAfter = (row: { page: number; y: number }, mark: { page: number; y: number }) =>
  row.page > mark.page || (row.page === mark.page && row.y >= mark.y);

/**
 * Each account's rows, signed by their running balance from the account's
 * opening balance ("Amount($)" prints no sign), and filed under the
 * account the "The Details" heading above them names.
 */
export function tangerineAccounts(
  rows: PdfTextRow[],
  read: LayoutTransaction[],
): LayoutTransaction[] {
  const sorted = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const accounts = sorted.flatMap(row => {
    const number = DETAILS.exec(row.text.trim())?.[1].replace(/ /g, '');
    if (!number) {
      return [];
    }
    const opening = sorted.find(
      line => atOrAfter(line, row) && /\bOpening Balance\b/i.test(line.text),
    );
    return [
      {
        number,
        page: row.page,
        y: row.y,
        opening: opening ? findStatementAmounts(opening.text).at(-1) : undefined,
      },
    ];
  });
  if (accounts.length === 0) {
    return read;
  }
  return accounts.flatMap((account, index) => {
    const next = accounts[index + 1];
    const own = read.filter(
      row => row.at && atOrAfter(row.at, account) && !(next && atOrAfter(row.at, next)),
    );
    return withSidesFromBalances(own, account.opening).map(row => ({
      ...row,
      account: { accountNumber: account.number, currency: 'CAD' },
    }));
  });
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Interest Paid\b/i, 'interest'],
  [/\b(?:ABM|Cash) Withdrawal\b/i, 'cash'],
  [/\bPurchase\b/i, 'card'],
  [/\bFee\b/i, 'fee'],
  [/\b(?:Withdrawal|Deposit|e-Transfer|Transfer|Payment)\b/i, 'transfer'],
];

export function tangerineEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (!kind) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  // "INTERAC e-Transfer From: Member One": the person after "From:" or "To:".
  const party = /\b(?:From|To): (.+)$/i.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Tangerine (Canada) statement: the client number and Orange Key, the
 * accounts at a glance, then each account's details under "The Details -
 * <account> - <number>" with Transaction Date, Transaction Description,
 * Amount($) (no sign) and Balance($), from its opening to its closing
 * balance. This names the bank, files each row under its account, signs it
 * by its running balance, keeps Canadian dollars and types the rows.
 */
export class TangerineParser extends BankPdfParser {
  protected readonly bank = BankName.TANGERINE;

  protected recognises(text: string): boolean {
    return isTangerineStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    return { ...statement, metadata: { ...statement.metadata, currency: 'CAD' } };
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return tangerineAccounts(rows, super.readTransactions(rows, reading));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return tangerineEntry(row);
  }
}

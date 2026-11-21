import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { withSidesFromBalances } from '../helpers/pdf-layout-swapped-sides.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findStatementAmounts } from '../helpers/statement-amount.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and support address. */
const VARO_NAME = /\bVaro Bank\b/i;
const VARO_SITE = /\bvaromoney\.com\b/i;

export function isVaroStatement(text: string): boolean {
  return VARO_NAME.test(text) && VARO_SITE.test(text);
}

/** "Summary for Bank Account 100000001". */
const ACCOUNT = /\bSummary for Bank Account (\d{6,})\b/i;

/** "Beginning Balance on 06/01/2023   $35725.35" in the summary. */
function openingBalance(rows: PdfTextRow[]): number | undefined {
  const line = rows.find(row => /^Beginning Balance\b/i.test(row.text.trim()));
  return line ? findStatementAmounts(line.text).at(-1) : undefined;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Debit Card\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\bFee\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/^(?:Payment|Transfer|Deposit|Direct Deposit|Varo to Varo)\b/i, 'transfer'],
];

export function varoEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text));
  if (!found) {
    return row;
  }
  const [pattern, kind] = found;
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  // "Debit Card (Purchase) ACME Store Sampletown": the party after the kind.
  const party = text
    .replace(pattern, '')
    .replace(/^\s*\([^)]*\)/, '')
    .trim();
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Varo Bank (US) account statement: a summary from the beginning to the
 * ending balance, then Date, Description, Amount (no sign) and Balance,
 * each row's party under its kind. This names the bank, takes the account
 * number, signs each row by its running balance from the summary's
 * beginning balance and reads its kind and party.
 */
export class VaroParser extends BankPdfParser {
  protected readonly bank = BankName.VARO;

  protected recognises(text: string): boolean {
    return isVaroStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return withSidesFromBalances(super.readTransactions(rows, reading), openingBalance(rows));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return varoEntry(row);
  }
}

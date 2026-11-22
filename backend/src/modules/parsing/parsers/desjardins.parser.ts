import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The caisse's name in the letterhead and the statement's title, in English or French. */
const DESJARDINS_NAME = /\bCAISSE DESJARDINS\b/i;
const DESJARDINS_TITLE = /\bSTATEMENT OF ACCOUNT\b|\bRELEV[ÉE] DE COMPTE\b/i;
/** The member's folio, printed under "Folio" next to the page number. */
const FOLIO = /\bFolio\s*\n?[^\n\d]*(\d{4,})/;

export function isDesjardinsStatement(text: string): boolean {
  return DESJARDINS_NAME.test(text) && DESJARDINS_TITLE.test(text);
}

/** What a row's first words say it is; an Interac transfer takes its side from the money. */
const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Purchase\b/i, 'card'],
  [/^Pre-authorized purchase\b/i, 'direct_debit'],
  [/^Withdrawal on ATM\b/i, 'cash'],
  [/^Interest\b/i, 'interest'],
  [/^(?:Bill payment|Payment transfer)\b/i, 'bank_transfer_out'],
  [/^(?:Payroll Deposit|Tax refund)\b/i, 'bank_transfer_in'],
  [/^(?:Cancellation-)?Interac e-Transfer\b/i, 'transfer'],
];

/**
 * "Purchase / STARBUCKS COFFEE #1031": the kind, a slash, then the other
 * party. An Interac transfer prints the person between slashes.
 */
export function desjardinsEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const party = text
    .split(' / ')
    .slice(1)
    .join(' / ')
    .replace(/\/\s*$/, '')
    .trim();
  const found = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const kind =
    found === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : found;
  return {
    ...row,
    ...(party ? { counterpartyName: party } : {}),
    ...(kind ? { paymentType: kind } : {}),
  };
}

/** Where the loans' part starts, and the summary after it. */
const LOAN_HEADING = /^LOAN$/;
const AFTER_LOANS = /^SERVICE CHARGE SUMMARY$/;

/**
 * Desjardins (Québec, Canada) statement of account: the chequing account's
 * rows (date without a year, a transaction code, the description, charges,
 * withdrawal, deposit and balance, amounts with a space for thousands), then
 * the savings and the loans. The generic layout reading does the table; this
 * names the caisse, takes the folio as the account, leaves the loan part out
 * (its payment already shows as the chequing account's withdrawal) and reads
 * each row's code and other party.
 */
export class DesjardinsParser extends BankPdfParser {
  protected readonly bank = BankName.DESJARDINS;

  protected recognises(text: string): boolean {
    return isDesjardinsStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return FOLIO.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return desjardinsEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    let inLoans = false;
    const deposits = [...rows]
      .sort((a, b) => a.page - b.page || a.y - b.y)
      .filter(row => {
        const text = row.text.trim();
        inLoans = (inLoans || LOAN_HEADING.test(text)) && !AFTER_LOANS.test(text);
        return !inLoans;
      });
    return super.readTransactions(deposits);
  }
}

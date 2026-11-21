import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { withSidesByBalance } from '../helpers/pdf-layout-swapped-sides.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { detectStatementCurrency } from '../helpers/statement-metadata.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site and its Brussels address at the foot of the page. */
const KBC_SITE = /\bwww\.kbc\.be\b/i;
const KBC_DETAILS = /\bYour Account Details\b|\bRekeninguittreksel\b|\bExtrait de compte\b/i;

export function isKbcStatement(text: string): boolean {
  return KBC_SITE.test(text) && KBC_DETAILS.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  [/^ATM Withdrawal\b()/i, 'cash'],
  [/^(?:Online )?(?:Payment|Transaction) to (.+?)(?:\s+[A-Z0-9]{8,})?$/i, 'card'],
  [/^Transferred to (.+?)(?:\s+(?:Ac\.\s*)?[A-Z0-9]{8,})?$/i, 'bank_transfer_out'],
  [/^Received from (.+?)(?:\s+(?:Ac\.\s*)?[A-Z0-9.]{8,})?$/i, 'bank_transfer_in'],
];

export function kbcEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/**
 * KBC (Belgium) account statement in English: Date, Description, Debit,
 * Credit and Balance from the balance brought forward. The generic layout
 * reading does the table and the balances; this names the bank, takes each
 * row's side from the running balance when the headings sit over each
 * other's money, and reads the rows' parties.
 */
export class KbcParser extends BankPdfParser {
  protected readonly bank = BankName.KBC;

  protected recognises(text: string): boolean {
    return isKbcStatement(text);
  }

  /** A Belgian account that names no currency keeps euros. */
  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    return detectStatementCurrency(text)
      ? statement
      : { ...statement, metadata: { ...statement.metadata, currency: 'EUR' } };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return kbcEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return withSidesByBalance(super.readTransactions(rows));
  }
}

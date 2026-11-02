import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's web address in its notes, and the line every statement opens its first page with. */
const COMMERCE_SITE = /\bcommercebank\.com\b/i;
const COMMERCE_PHONE = /\b800-453-BANK\b/;

export function isCommerceBankStatement(text: string): boolean {
  return COMMERCE_SITE.test(text) && COMMERCE_PHONE.test(text);
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A PIN purchase prints its kind alone on the dated line, the merchant and its terminal under it. */
const PIN_PURCHASE = /^Debit Card Purchase-Pin$/i;
/** The terminal number after the merchant ("Shell Service Station 40037001"), and all after it. */
const TERMINAL = /\s+P?\d{6,8}(?:\s.*)?$/;
/** An electronic payment's reference after its text: "Payment Acme Corp  Ref Nbr: 1004004352735". */
const REFERENCE = /\s*Ref Nbr:\s*(\d+)/;

/**
 * The payee of an entry, from its dated line and the lines under it: the
 * merchant under a PIN purchase, without its terminal; the payer or biller of
 * an electronic payment, before its reference; else the dated line itself,
 * the merchant of a signed card purchase. A cash machine's entries name none.
 */
export function commercePayee(entry: Pick<LayoutTransaction, 'description' | 'firstLine'>): string {
  const first = squash(entry.firstLine);
  if (/^ATM\b/.test(first)) {
    return '';
  }
  if (PIN_PURCHASE.test(first)) {
    return squash(entry.description).slice(first.length).replace(TERMINAL, '').trim();
  }
  return first.replace(/\s*Ref Nbr:.*$/, '');
}

/** What an entry's words say it is; anything else spent is a card purchase. */
const KINDS: [RegExp, PaymentType][] = [
  [/^ATM\b.*\bFee\b/i, 'fee'],
  [/^ATM Withdrawal\b/i, 'cash'],
  [/^Debit Card Purchase-Pin\b/i, 'card'],
  [/^(?:\S+ )*(?:Service|Statement) Fee$/i, 'fee'],
];

export function commerceEntry(row: ParsedTransaction): ParsedTransaction {
  const text = squash(row.paymentPurpose);
  const reference = REFERENCE.exec(text)?.[1];
  const credit = Number(row.credit) > 0;
  const paymentType =
    KINDS.find(([pattern]) => pattern.test(text))?.[1] ??
    (reference ? (credit ? 'bank_transfer_in' : 'direct_debit') : credit ? undefined : 'card');
  return {
    ...row,
    ...(paymentType ? { paymentType } : {}),
    ...(reference ? { documentNumber: reference } : {}),
  };
}

/**
 * Commerce Bank (US) checking statement: an account summary, then deposits,
 * ATM and PIN debits, signed card purchases and other withdrawals, each under
 * a heading of its own with the text first and the dates and amount right of
 * it. The generic layout reading does the sections; this names the bank and
 * gives each entry its payee, type and reference.
 */
export class CommerceBankParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.COMMERCE_BANK && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCommerceBankStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, transactions: statement.transactions.map(commerceEntry) };
  }

  protected readTransactions(
    rows: PdfTextRow[],
    reading: LayoutReading = this.reading,
  ): LayoutTransaction[] {
    return super.readTransactions(rows, reading).map(row => ({
      ...row,
      counterparty: row.counterparty || commercePayee(row),
    }));
  }
}

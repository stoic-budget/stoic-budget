import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The registered name in the letterhead, and the table heading every statement prints. */
const CAPITEC_NAME = /\bCapitec Bank Limited\b/i;
const CAPITEC_TABLE = /\bPosting Date\b/i;

export function isCapitecStatement(text: string): boolean {
  return CAPITEC_NAME.test(text) && CAPITEC_TABLE.test(text);
}

const CARD_SUFFIX = /\s*\(Card \d+\)$/i;
const CASH_WITHDRAWAL = /\bCash Withdrawal\b/i;

/**
 * How a line reads, by payment type; only the wordings printed on a statement
 * are listed. A fee line starts with an asterisk and names the fee, a card
 * payment ends with the card.
 */
export function capitecPaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  // The asterisk marks an amount with VAT in it: a fee, or a purchase such as airtime.
  if (/^\*.*\bFee\b/i.test(text)) {
    return 'fee';
  }
  if (/^Interest Received\b/i.test(text)) {
    return 'interest';
  }
  if (CARD_SUFFIX.test(text) || /\(Card$/i.test(text)) {
    return CASH_WITHDRAWAL.test(text) ? 'cash' : 'card';
  }
  if (/\bPayment Received\b/i.test(text)) {
    return 'bank_transfer_in';
  }
  return /^Banking App Transfer to\b/i.test(text) ? 'bank_transfer_out' : null;
}

const RECEIVED = /^(?:Banking App Payment Received|Branch Payment Received|Payment Received:?)\s+/i;
const TRANSFER_TO = /^Banking App Transfer to\s+(.+?)\s*(?:\(\d+\))?$/i;
/** A reference number the bank prints after the payer's name. */
const REFERENCE = /\s+\d{8,}$/;

export function capitecPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (text.startsWith('*') || CASH_WITHDRAWAL.test(text)) {
    return '';
  }
  if (RECEIVED.test(text)) {
    return text.replace(RECEIVED, '').replace(REFERENCE, '');
  }
  const transfer = TRANSFER_TO.exec(text);
  if (transfer) {
    return transfer[1];
  }
  return CARD_SUFFIX.test(text) ? text.replace(CARD_SUFFIX, '') : '';
}

/**
 * Capitec Bank (South Africa) account statement: a Posting Date and a
 * Transaction Date, a description, Money In (R), Money Out (R) and a balance,
 * with the statement's "From Date" and "To Date" in the letterhead. The
 * generic layout reading does the table; this names the bank and gives each
 * line its payee and type.
 */
export class CapitecParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CAPITEC && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCapitecStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return withPaymentTypes(await super.parse(filePath, cachedText), capitecPaymentType);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || capitecPayee(row.description),
    }));
  }
}

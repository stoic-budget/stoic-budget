import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The member services named in the error-resolution notice, and the title of the statement. */
const CHIME_NAME = /\bChime Member Services\b/;
const CHIME_TITLE = /\bChecking Account Statement\b/;

export function isChimeStatement(text: string): boolean {
  return CHIME_NAME.test(text) && CHIME_TITLE.test(text);
}

/**
 * A row reads "Name Type DESCRIPTOR": the name as Chime shows it, the type
 * column, then the card network's descriptor in capitals. The type is the
 * first of these words whose rest has no lower case letter.
 */
const ENTRY =
  /^(.+?)\s+(Round Up Transfer|Round Up|Direct Debit|Purchase|Refund|Deposit|Transfer)(?=\s+[^a-z]*$|$)/;

export function splitChimeEntry(description: string): { name: string; type: string } | null {
  const match = ENTRY.exec(description.replace(/\s+/g, ' ').trim());
  return match ? { name: match[1], type: match[2] } : null;
}

export function chimePaymentType(description: string, credit: boolean): PaymentType | null {
  const entry = splitChimeEntry(description);
  switch (entry?.type) {
    case 'Purchase':
    case 'Refund':
      return 'card';
    case 'Direct Debit':
      return 'direct_debit';
    case 'Round Up':
    case 'Round Up Transfer':
      return 'bank_transfer_out';
    case 'Deposit':
      return /^Cash Deposit$/i.test(entry.name) ? 'cash' : 'bank_transfer_in';
    case 'Transfer':
      return credit ? 'bank_transfer_in' : 'bank_transfer_out';
    default:
      return null;
  }
}

const DIRECTION = /^Transfer (?:from|to)\s+/i;
const DIRECT_DEBIT = /^Direct Debit:\s*/i;

/** The other side: the name Chime shows, without the direction or the "Direct Debit:" label. */
export function chimePayee(description: string): string {
  const name = splitChimeEntry(description)?.name ?? '';
  return name.replace(DIRECTION, '').replace(DIRECT_DEBIT, '');
}

/**
 * Chime (US) checking account statement: a summary of the month, then
 * Transactions with a Transaction Date, a Description and Type, an Amount
 * signed, a Net Amount and a Settlement Date, newest first and no running
 * balance. The generic layout reading does the table; this names the bank
 * and gives each entry its payee and type.
 */
export class ChimeParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.CHIME && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isChimeStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return {
      ...statement,
      transactions: statement.transactions.map(row => {
        const paymentType = chimePaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || chimePayee(row.description),
    }));
  }
}

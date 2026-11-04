import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's registered name under the address block, and the heading of every table. */
const CHASE_NAME = /\bJPMorgan Chase Bank\b/i;
const CHASE_TABLE = /\bTRANSACTION DETAIL\b/;

export function isChaseStatement(text: string): boolean {
  return CHASE_NAME.test(text) && CHASE_TABLE.test(text);
}

const CARD = /^(?:Recurring )?Card Purchase(?: With Pin| Return)?\b/i;
const ZELLE = /^Zelle Payment (?:From|To)\b/i;
const ONLINE_TRANSFER = /^(?:\d{2}\/\d{2}\s+)?Online Transfer (?:From|To)\b/i;
/** An ACH entry: the originator, then the class and id ("PPD ID: 9009870680"). */
const ACH = /\b(?:PPD|CCD|WEB) ID:\s*\d+/i;
const FEE = /^(?:Monthly Service|Service|Overdraft|ATM) Fee\b/i;

/**
 * How an entry reads, by payment type. The words alone name a card payment, a
 * Zelle payment or a transfer; the column says whether it came in or went out.
 */
export function chasePaymentType(description: string, credit: boolean): PaymentType | null {
  if (CARD.test(description)) {
    return 'card';
  }
  if (FEE.test(description)) {
    return 'fee';
  }
  if (ZELLE.test(description) || ONLINE_TRANSFER.test(description)) {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  if (ACH.test(description)) {
    return credit ? 'bank_transfer_in' : 'direct_debit';
  }
  return null;
}

/** "Card Purchase 01/09 Py *Forever Yogurt Homewood IL Card 9294": the date before and the card after. */
const CARD_PREFIX = /^(?:Recurring )?Card Purchase(?: With Pin| Return)?\s+(?:\d{2}\/\d{2}\s*)?/i;
const CARD_SUFFIX = /\s+Card(?:\s+\d{4})?$/i;
const ZELLE_PREFIX = /^Zelle Payment (?:From|To)\s+/i;
/** The confirmation code Zelle ends with: letters and at least one digit. */
const ZELLE_CODE = /\s+(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{10,}$/;
const ACH_TAIL = /\s+(?:PPD|CCD|WEB) ID:.*$/i;
const TRANSFER_TAIL = /\s+Transaction#:.*$/i;

export function chasePayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (CARD.test(text)) {
    return text.replace(CARD_PREFIX, '').replace(CARD_SUFFIX, '');
  }
  if (ZELLE.test(text)) {
    return text.replace(ZELLE_PREFIX, '').replace(ZELLE_CODE, '');
  }
  if (ONLINE_TRANSFER.test(text)) {
    return text.replace(/^\d{2}\/\d{2}\s+/, '').replace(TRANSFER_TAIL, '');
  }
  return ACH.test(text) ? text.replace(ACH_TAIL, '') : '';
}

/**
 * Chase (JPMorgan Chase Bank, N.A., US) checking statement: a summary, then
 * "TRANSACTION DETAIL" with Date, Description, Amount and Balance, the amount
 * signed, the year only in the period line. The generic layout reading does
 * the table; this names the bank and gives each entry its payee and type.
 */
export class ChaseParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.CHASE && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isChaseStatement(cachedText ?? (await extractTextFromPdf(filePath)));
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
        const paymentType = chasePaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || chasePayee(row.description),
    }));
  }
}

import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The statement's title, and the web address on its payment slip. */
const CREDIT_ONE_TITLE = /\bCREDIT ONE BANK CREDIT CARD STATEMENT\b/i;
const CREDIT_ONE_SITE = /\bCreditOneBank\.com\b/i;

export function isCreditOneStatement(text: string): boolean {
  return CREDIT_ONE_TITLE.test(text) && CREDIT_ONE_SITE.test(text);
}

/** What an entry's first words say it is. */
const KINDS: [RegExp, PaymentType][] = [
  [/^PAYMENT THANK YOU\b/i, 'bank_transfer_in'],
  [/^Interest Charge\b/i, 'interest'],
  [/^CREDIT PROTECT\b/i, 'fee'],
];
/** Adjustments and refunds, which go either way: no type. */
const ADJUSTMENT = /^(?:AN ADJ TO YOUR ACCOUNT|(?:REVERSE )?CREDIT REFUND)\b/i;

export function creditOneEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  // Anything else charged is a card purchase.
  const purchase = !ADJUSTMENT.test(text) && Number(row.debit) > 0 ? 'card' : undefined;
  const paymentType = kind ?? purchase;
  return paymentType ? { ...row, paymentType } : row;
}

/** A line of the interest table that charged nothing ("Interest Charge on Purchases 0.00"). */
const movesMoney = (row: ParsedTransaction) => Number(row.debit) > 0 || Number(row.credit) > 0;

/**
 * Credit One Bank (US) credit card statement: a summary and payment box, then
 * the transactions under Reference Number, Trans Date, Post Date, Description
 * and Amount (charges plain, payments and credits negative), then fees and an
 * interest table. The generic layout reading does the table; this names the
 * bank, leaves out the interest lines that charged nothing and types the
 * entries.
 */
export class CreditOneParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CREDIT_ONE && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCreditOneStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return {
      ...statement,
      transactions: statement.transactions.filter(movesMoney).map(creditOneEntry),
    };
  }
}

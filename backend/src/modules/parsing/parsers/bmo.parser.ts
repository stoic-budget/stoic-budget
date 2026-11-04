import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name over the address block, and the summary every account opens with. */
const BMO_NAME = /\bBMO BANK N\.?A\.?/i;
const BMO_ACCOUNT = /\bDEPOSIT ACCOUNT SUMMARY\b/i;

export function isBmoStatement(text: string): boolean {
  return BMO_NAME.test(text) && BMO_ACCOUNT.test(text);
}

/** How a line starts, by payment type; only the wordings printed on a statement are listed. */
const PAYMENT_TYPES: [PaymentType, RegExp][] = [
  ['direct_debit', /^ACH DEBIT\b/i],
  ['bank_transfer_in', /^PC TRANSFER CREDIT\b/i],
  ['bank_transfer_out', /^PC TRANSFER DEBIT\b/i],
  ['fee', /^ACCT ANALYSIS SERV CHG\b/i],
];

export function bmoPaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  return PAYMENT_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** An ACH line names the entry class (CCD, PPD, WEB, TEL…) before the payee. */
const ACH_PREFIX = /^ACH (?:DEBIT|CREDIT)\s+(?:(?:CCD|PPD|WEB|TEL|CTX|IAT|POP|ARC|BOC|RCK)\s+)?/i;
const TRANSFER_PREFIX = /^PC TRANSFER (?:DEBIT|CREDIT)\s*/i;
/** A check is listed by its serial number alone, starred where the sequence breaks. */
const CHECK_SERIAL = /^(\d{3,})(?:\s*\*)?$/;
/** The legend printed under the checks table lands on the last check's line, with what follows it. */
const CHECK_LEGEND = /\s*\*?\s*Indicates break in check sequence.*$/i;

export function bmoPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (ACH_PREFIX.test(text)) {
    return text.replace(ACH_PREFIX, '');
  }
  return TRANSFER_PREFIX.test(text) ? text.replace(TRANSFER_PREFIX, '') : '';
}

/** A check's line says "Check 4241"; the serial alone would read as a number. */
function describeCheck(description: string): string {
  const serial = CHECK_SERIAL.exec(description.replace(CHECK_LEGEND, '').trim());
  return serial ? `Check ${serial[1]}` : description;
}

/**
 * BMO Bank (US) account statement: Deposits and Other Credits, Withdrawals
 * and Other Debits and a two-up Checks table, each line with a month and a
 * day, an amount and a description, the year only in the statement period.
 * The generic layout reading does the tables; this names the bank and gives
 * each line its payee and type.
 */
export class BmoParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.BMO && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isBmoStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return withPaymentTypes(await super.parse(filePath, cachedText), bmoPaymentType);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => {
      const description = describeCheck(row.description.replace(CHECK_LEGEND, ''));
      const counterparty =
        row.counterparty ||
        (description.startsWith('Check ') ? description : bmoPayee(description));
      return { ...row, description, counterparty };
    });
  }
}

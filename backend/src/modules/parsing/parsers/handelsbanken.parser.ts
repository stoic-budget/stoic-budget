import { ocrPdfLayout } from '../../../common/utils/pdf-ocr.util';
import { BankName } from '../../../entities/statement.entity';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and its UK register line, even through a scanner's garbled OCR. */
const HANDELSBANKEN_NAME = /\bHandelsbanken\b/;
const HANDELSBANKEN_UK = /\bHandelsbanken plc\b|\bhandelsbanken\.co\.uk\b/i;

/** Each account's page: "A/C NO: 60093358", and its opening line with the figure under it. */
const ACCOUNT = /\bA\/C NO:?\s*(\d{6,})/g;
const BROUGHT_FORWARD = /BALANCE BROUGHT FORWARD\s*\n?\s*([\d,]+\.\d{2})/g;

/**
 * A file of several accounts prints a page each, those with no movements
 * first: the rows are the last page's account, opening at its own balance
 * brought forward.
 */
export function lastAccountPage(text: string): { account?: string; opening?: number } {
  const account = Array.from(text.matchAll(ACCOUNT)).at(-1)?.[1];
  const opening = Array.from(text.matchAll(BROUGHT_FORWARD)).at(-1)?.[1];
  return {
    ...(account && { account }),
    ...(opening && { opening: parseStatementAmount(opening) ?? undefined }),
  };
}

export function isHandelsbankenStatement(text: string): boolean {
  return HANDELSBANKEN_NAME.test(text) && HANDELSBANKEN_UK.test(text);
}

/** "D.DR ACME ENERGY", "B/O MEMBER ONE", "CHQ.002726": a direct debit, a credit by order of, a cheque. */
const KINDS: [RegExp, NonNullable<ParsedTransaction['paymentType']>][] = [
  [/^D\.?DR\s+(.+)$/i, 'direct_debit'],
  [/^B\/O\s+(.+)$/i, 'bank_transfer_in'],
  [/^CHGS\b()/i, 'fee'],
];

export function handelsbankenEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const cheque = /^CHQ\.?\s*(\d+)/i.exec(text)?.[1];
  if (cheque) {
    return { ...row, counterpartyName: `Cheque ${cheque}`, documentNumber: cheque };
  }
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/**
 * Handelsbanken (UK) statement of account, often a scan: Value Date, Details,
 * Payment (Debits), Receipts (Credits) and Balance from the balance brought
 * forward, dates as "17NOV20". A scanner's own text layer over the image is
 * too garbled to read ("BAI,ANCE", "t35 ,659 .49"), so the pages are read
 * from their images by OCR; the generic layout reading does the rest.
 */
export class HandelsbankenParser extends BankPdfParser {
  protected readonly bank = BankName.HANDELSBANKEN;

  protected readsImages = true;

  protected recognises(text: string): boolean {
    return isHandelsbankenStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    // The pages as OCR read them (cached from the reading above), not the scanner's text layer.
    const { account, opening } = lastAccountPage((await ocrPdfLayout(filePath)).text);
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        ...(account && { accountNumber: account }),
        ...(opening !== undefined && { balanceStart: opening }),
      },
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return handelsbankenEntry(row);
  }
}

import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal name under the fees box, or its web address. */
const TD_NAME = /\bTHE TORONTO-DOMINION BANK\b|\bTD Canada Trust\b/i;
const TD_SITE = /\bwww\.td\.com\b/i;
const TD_TITLE = /\bStatement of Account\b/i;

export function isTdStatement(text: string): boolean {
  return (TD_NAME.test(text) || TD_SITE.test(text)) && TD_TITLE.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\bATM (?:DEP|W\/D)\b/i, 'cash'],
  [/\b(?:FEE|REBATE|SERVICE CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/^(?:PTS TO|PTS FRM|SEND E-TFR|E-TFR|TFR|PAY|DEPOSIT|INTERAC)\b/i, 'transfer'],
  [/^(?:POS|VISA DEBIT|DEBIT)\b/i, 'card'],
];

export function tdEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (!kind) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  return { ...row, paymentType };
}

/**
 * TD Canada Trust statement of account: the branch and account numbers and
 * the period ("JUL 31/24 - AUG 30/24"), then Description, Withdrawals,
 * Deposits, Date ("AUG06", right of the money) and Balance from the starting
 * balance, then the fees box. The generic layout reading does the table;
 * this names the bank, keeps Canadian dollars and types the rows.
 */
export class TdParser extends BankPdfParser {
  protected readonly bank = BankName.TD;

  protected recognises(text: string): boolean {
    return isTdStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    if (!TD_NAME.test(text)) {
      return statement;
    }
    return {
      ...statement,
      metadata: { ...statement.metadata, currency: 'CAD' },
      transactions: statement.transactions.map(row => ({ ...row, currency: 'CAD' })),
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return tdEntry(row);
  }
}

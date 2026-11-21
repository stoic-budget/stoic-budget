import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's trademark line at the foot of every page and its web address. */
const SIMPLII_NAME = /\bSimplii Financial\b/i;
const SIMPLII_SITE = /\bsimplii\.com\b/i;

export function isSimpliiStatement(text: string): boolean {
  return SIMPLII_NAME.test(text) && SIMPLII_SITE.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^ABM (?:WITHDRAWAL|DEPOSIT)\b/i, 'cash'],
  [/\b(?:SERVICE CHARGE|FEE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/\b(?:E-TRANSFER|TRANSFER|PAYROLL|DEPOSIT|BILL PAYMENT|PREAUTHORIZED)\b/i, 'transfer'],
  [/^(?:POS|PURCHASE|VISA DEBIT)\b/i, 'card'],
];

export function simpliiEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "INTERAC E-TRANSFER SEND Member One": the person the money went to or came from.
  const party = /^INTERAC E-TRANSFER (?:SEND|RECEIVE) (.+)$/i.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Simplii Financial (Canada, a division of CIBC) chequing statement: the
 * statement period, date and account number, then date, transaction, funds
 * out, funds in and balance from the balance forward. The generic layout
 * reading does the table; this names the bank, keeps Canadian dollars and
 * types cash, transfers and fees.
 */
export class SimpliiParser extends BankPdfParser {
  protected readonly bank = BankName.SIMPLII;

  protected recognises(text: string): boolean {
    return isSimpliiStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    return {
      ...statement,
      metadata: { ...statement.metadata, currency: 'CAD' },
      transactions: statement.transactions.map(row => ({ ...row, currency: 'CAD' })),
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return simpliiEntry(row);
  }
}

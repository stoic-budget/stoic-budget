import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's phone line and web address in the help box. */
const SCOTIA_PHONE = /\b1 800 4-SCOTIA\b/i;
const SCOTIA_SITE = /\bwww\.scotiabank\.com\b/i;

export function isScotiabankStatement(text: string): boolean {
  return SCOTIA_PHONE.test(text) || SCOTIA_SITE.test(text);
}

/** "Your account number:" and, under it, the transit and account: "10000 01000 10". */
const ACCOUNT = /Your account number:[\s\S]{0,60}?\b(\d{5} \d{5} \d{2})\b/;

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Point of sale purchase\b/i, 'card'],
  [/^(?:ABM withdrawal|Withdrawal)\b/i, 'cash'],
  [/\b(?:Service charge|fee)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [
    /^(?:Deposit|Transfer|PC Transfer|Bill payment|Customer transfer|E-Transfer|Interac e-Transfer)\b/i,
    'transfer',
  ],
];

/** "Point of sale purchase Fpos ACME Store Sampletown ONCA": the shop after the kind. */
const CARD_SHOP = /^Point of sale purchase (?:Fpos )?(.+?)$/i;

export function scotiabankEntry(row: ParsedTransaction): ParsedTransaction {
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
  const shop = CARD_SHOP.exec(text)?.[1];
  return { ...row, paymentType, ...(shop ? { counterpartyName: shop } : {}) };
}

/**
 * Scotiabank (Canada) account statement: a summary from the opening to the
 * closing balance, then Date, Transactions, Amounts withdrawn, Amounts
 * deposited and Balance, each row's kind over its details. The generic
 * layout reading does the table; this names the bank, keeps Canadian
 * dollars and the transit and account number, and types the rows.
 */
export class ScotiabankParser extends BankPdfParser {
  protected readonly bank = BankName.SCOTIABANK;

  protected recognises(text: string): boolean {
    return isScotiabankStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
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
    return scotiabankEntry(row);
  }
}

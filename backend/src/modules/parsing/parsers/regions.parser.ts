import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's phone line and web address at the foot of the page. */
const REGIONS_PHONE = /\b1-800-REGIONS\b/i;
const REGIONS_SITE = /\bwww\.regions\.com\b/i;

export function isRegionsStatement(text: string): boolean {
  return REGIONS_PHONE.test(text) && REGIONS_SITE.test(text);
}

/** "Beginning Balance  $69.10 -": the summary signs an overdrawn balance after it. */
function summaryBalance(text: string, label: string): number | null {
  const match = new RegExp(`\\b${label}\\s+(\\$?[\\d,]+\\.\\d{2})( -)?`, 'i').exec(text);
  const value = match ? parseStatementAmount(match[1]) : null;
  return value === null ? null : match?.[2] ? -value : value;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:Card Purchase|PIN Purchase|Card Credit)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\b(?:Fee|Service Charge|Paid Item)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/\b(?:Deposit|Transfer|Payroll|Tax Products)\b/i, 'transfer'],
];

/** "Card Purchase ACME Store 5814 Sampletown NM 87505": the shop before the merchant code. */
const CARD_SHOP = /^(?:Card Purchase|PIN Purchase|Card Credit) (.+?) \d{4} /i;

export function regionsEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Regions Bank (US) checking statement: a summary from the beginning to the
 * ending balance (an overdrawn one signed after it, "$69.10 -"), then
 * deposits & credits, withdrawals, fees and checks under their headings with
 * Date, Description and Amount, each list closed by its total. The generic
 * layout reading does the lists; this names the bank, signs the summary's
 * balances and types the rows.
 */
export class RegionsParser extends BankPdfParser {
  protected readonly bank = BankName.REGIONS;

  protected recognises(text: string): boolean {
    return isRegionsStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const start = summaryBalance(text, 'Beginning Balance');
    const end = summaryBalance(text, 'Ending Balance');
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        ...(start !== null && { balanceStart: start }),
        ...(end !== null && { balanceEnd: end }),
      },
    };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return regionsEntry(row);
  }
}

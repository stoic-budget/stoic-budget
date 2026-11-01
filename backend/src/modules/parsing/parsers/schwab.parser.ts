import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's registered name in the footer and address block, and the period every page heads. */
const SCHWAB_NAME = /\bCharles Schwab Bank\b/i;
const SCHWAB_PERIOD = /\bStatement Period\b/i;

export function isSchwabStatement(text: string): boolean {
  return SCHWAB_NAME.test(text) && SCHWAB_PERIOD.test(text);
}

/** What the first line of an entry says it is; the merchant or the other side follows. */
const KINDS: [PaymentType | 'transfer', RegExp][] = [
  ['card', /^Visa Debit Card Point of Sale Purchase\b/i],
  ['cash', /^ATM Withdrawal\b/i],
  ['fee', /^ATM Fee Rebate\b/i],
  ['interest', /^Interest Paid\b/i],
  [
    'transfer',
    /^(?:Money Transfer(?: Visa Direct)?|Electronic (?:Deposit|Withdrawal)|Transfer (?:from|to))\b/i,
  ],
];

export function schwabPaymentType(description: string, credit: boolean): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([, pattern]) => pattern.test(text))?.[0];
  if (kind === 'transfer') {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return kind ?? null;
}

/** The words the bank prints before the other side of an entry. */
const KIND_WORDS =
  /^(?:Visa Debit Card Point of Sale Purchase|ATM Withdrawal|ATM Fee Rebate|Money Transfer Visa Direct|Money Transfer|Electronic (?:Deposit|Withdrawal))\s+/i;
/** The place at the end of a card line ("…, NM, US") and the ACH tail ("~ Tran: ACHDD"). */
const PLACE = /,\s*[A-Z]{2},\s*US$/;
const ACH_TAIL = /\s*~?\s*Tran:\s*\w+$/;

/** The other side of an entry: the merchant, the sender, the account. */
export function schwabPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  if (/^Transfer (?:from|to)\b/i.test(text)) {
    return text;
  }
  const rest = text.replace(KIND_WORDS, '');
  return rest === text ? '' : rest.replace(PLACE, '').replace(ACH_TAIL, '').trim();
}

/**
 * Charles Schwab Bank (US) checking statement: an activity table of Date
 * Posted, Description, Debits, Credits and Balance, each entry's merchant or
 * other side on the line under its type. The generic layout reading does the
 * table; this names the bank and gives each entry its payee and type.
 */
export class SchwabParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.SCHWAB && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isSchwabStatement(cachedText ?? (await extractTextFromPdf(filePath)));
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
        const paymentType = schwabPaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || schwabPayee(row.description),
    }));
  }
}

import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The web address in the customer-service block, and the summary every statement opens with. */
const CITIZENS_SITE = /\bcitizensbank\.com\b/i;
const CITIZENS_SUMMARY = /\bBalance Calculation\b/;

export function isCitizensStatement(text: string): boolean {
  return CITIZENS_SITE.test(text) && CITIZENS_SUMMARY.test(text);
}

/** "One Deposit Checking for XXXX-079-2": the account, masked. */
const ACCOUNT_HEADING = /\bChecking for (X{4}-\d{3}-\d)\b/;
/** The checks table: serial, amount and date, two blocks to a line, before the withdrawals. */
const CHECKS_BLOCK = /Check #\s+Amount\s+Date[\s\S]*?(?=Withdrawals & Debits)/;
const CHECK = /(\d{3,6})\s+([\d,]+\.\d{2})\s+(\d{2})\/(\d{2})/g;

/** Checks the generic reading cannot take: their serial, not their date, opens the row. */
export function readChecks(text: string, year: number, currency: string): ParsedTransaction[] {
  const block = CHECKS_BLOCK.exec(text)?.[0] ?? '';
  return Array.from(block.matchAll(CHECK), ([, serial, amount, month, day]) => ({
    transactionDate: new Date(year, Number(month) - 1, Number(day)),
    counterpartyName: `Check ${serial}`,
    paymentPurpose: `Check ${serial}`,
    debit: Number(amount.replace(/,/g, '')),
    documentNumber: serial,
    currency,
  }));
}

/** What an entry's first words say it is; a transfer takes its direction from the section. */
const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^\d{4}\s+(?:DBT PURCHASE|POS DEBIT)\b/, 'card'],
  [/^\d{4}\s+ATM CASH\b/, 'cash'],
  [/\bCITIZENS ATM DEPOSIT\b/, 'cash'],
  [/^(?:ONLINE|SCHEDULED) TRANSFER\b/, 'transfer'],
  [/\bOPTI CREDIT (?:FOR )?FEE\b/, 'fee'],
  [/\b(?:EPAY|WEB PYMT)\b/, 'bank_transfer_out'],
  [/\b(?:PAYPAL DEPOSIT|BANK DEPOSIT|REFUND)\b/, 'bank_transfer_in'],
];

export function citizensPaymentType(description: string, credit: boolean): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (kind === 'transfer') {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return kind ?? null;
}

/** "3016 DBT PURCHASE - 035524 SCORPION BAR GRAND RAPIDS MI": the merchant after the terminal code. */
const CARD_PREFIX = /^\d{4}\s+(?:DBT PURCHASE|POS DEBIT|ATM CASH)\s*[-–]\s*[A-Z0-9]+\s*/;

export function citizensPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  return CARD_PREFIX.test(text) ? text.replace(CARD_PREFIX, '') : '';
}

/**
 * Citizens (US) checking statement: a balance calculation, a table of checks,
 * Withdrawals & Debits and Deposits & Credits each under its own heading with
 * Date, Amount and Description and no running balance, then the daily
 * balances. The generic layout reading does the sections; this names the
 * bank, reads the account and the checks and gives each entry its payee and
 * type.
 */
export class CitizensParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CITIZENS && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCitizensStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const { currency, dateFrom } = statement.metadata;
    const checks = readChecks(text, dateFrom.getFullYear(), currency ?? 'USD');
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        accountNumber: statement.metadata.accountNumber || ACCOUNT_HEADING.exec(text)?.[1] || '',
      },
      transactions: [
        ...checks,
        ...statement.transactions.map(row => {
          const paymentType = citizensPaymentType(row.paymentPurpose, Number(row.credit) > 0);
          return paymentType ? { ...row, paymentType } : row;
        }),
      ],
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || citizensPayee(row.description),
    }));
  }
}

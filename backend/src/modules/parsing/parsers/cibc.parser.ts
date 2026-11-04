import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The title every page carries, and the heading of the table. */
const CIBC_TITLE = /\bCIBC Account Statement\b/;
const CIBC_TABLE = /\bTransaction details\b/;

export function isCibcStatement(text: string): boolean {
  return CIBC_TITLE.test(text) && CIBC_TABLE.test(text);
}

/**
 * How an entry starts, by payment type; only the wordings printed on a
 * statement are listed. A transfer takes its direction from the column, and
 * `payee` says whether the words after the type name the other side.
 */
const KINDS: { pattern: RegExp; type: PaymentType | 'transfer'; payee: boolean }[] = [
  { pattern: /^VISA DEBIT RETAIL PURCHASE\s*/, type: 'card', payee: true },
  { pattern: /^RETAIL PURCHASE\s*/, type: 'card', payee: true },
  { pattern: /^INSTANT TELLER WITHDRAWAL\s*/, type: 'cash', payee: false },
  { pattern: /^US \$ WITHDRAWL IN CANADIAN \$\s*/, type: 'cash', payee: false },
  { pattern: /^PREAUTHORIZED DEBIT\s*/, type: 'direct_debit', payee: true },
  { pattern: /^INTERNET BILL PAY\s*/, type: 'bank_transfer_out', payee: true },
  { pattern: /^E-TRANSFER\s*(?:INTERNET TRANSFER)?\s*/, type: 'transfer', payee: false },
  { pattern: /^INTERNET TRANSFER\s*/, type: 'transfer', payee: false },
  { pattern: /\bFEE$/, type: 'fee', payee: false },
];

export function cibcPaymentType(description: string, credit: boolean): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(({ pattern }) => pattern.test(text))?.type;
  if (kind === 'transfer') {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return kind ?? null;
}

/** The merchant or the biller: what follows the type, for the types that name one. */
export function cibcPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(({ pattern }) => pattern.test(text));
  return kind?.payee ? text.replace(kind.pattern, '').trim() : '';
}

/**
 * CIBC (Canada) account statement: Transaction details with Date,
 * Description, Withdrawals, Deposits and Balance, the date printed once for
 * its day and the entry's type and merchant on two lines. The generic layout
 * reading does the table; this names the bank and gives each entry its
 * payee and type.
 */
export class CibcParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.CIBC && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isCibcStatement(cachedText ?? (await extractTextFromPdf(filePath)));
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
        const paymentType = cibcPaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || cibcPayee(row.description),
    }));
  }
}

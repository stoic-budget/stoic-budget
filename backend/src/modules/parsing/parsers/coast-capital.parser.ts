import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import { isPageFooterLine } from '../helpers/pdf-layout-page-footer.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The credit union's name in the footer of every page, and the box the member number sits in. */
const COAST_NAME = /\bCoast Capital Savings\b/i;
const COAST_MEMBER = /\bMEMBER NUMBER\b/;

export function isCoastCapitalStatement(text: string): boolean {
  return COAST_NAME.test(text) && COAST_MEMBER.test(text);
}

/** What an entry's first words say it is. */
const KINDS: [RegExp, PaymentType][] = [
  [/^Pre-Auth Debit\b/i, 'direct_debit'],
  [/^Direct Deposit\b/i, 'bank_transfer_in'],
  [/^(?:Service Charge|Official Draft Fee)\b/i, 'fee'],
  [/^Interest\b/i, 'interest'],
];

const CHEQUE = /^Cheque (\d+)$/;

export function coastCapitalEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const serial = CHEQUE.exec(text)?.[1];
  return {
    ...row,
    ...(paymentType ? { paymentType } : {}),
    ...(serial ? { documentNumber: serial } : {}),
  };
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * An entry prints its kind on the dated line, then a reference with the
 * member's own name, then the other party: "Pre-Auth Debit" / "FINE SIGNS LTD"
 * / "ICBC". The payee is that third line; a cheque's or a draft's single line
 * under it is its number, no payee.
 */
export function coastCapitalPayee(entry: LayoutTransaction, rows: PdfTextRow[]): string {
  const { at } = entry;
  if (!at) {
    return '';
  }
  const description = squash(entry.description);
  const under = rows
    .filter(row => row.page === at.page && row.y > at.y && row.y - at.y < 40)
    .sort((a, b) => a.y - b.y)
    .map(row => squash(row.text));
  const lines: string[] = [];
  for (const line of under) {
    if (!(line && description.includes(line))) {
      break;
    }
    lines.push(line);
  }
  return lines.length >= 2 ? lines[lines.length - 1] : '';
}

/**
 * Coast Capital Savings (Canada) statement of account: every account of the
 * member in turn, each under its product name and number ("100123456789
 * (100)") with Withdrawals, Deposits and Balance, the date and text left of
 * them under no heading. The generic layout reading does the tables and the
 * accounts; this names the bank, drops the "CONTINUED..." page break, and
 * gives each entry its payee, type and cheque number.
 */
export class CoastCapitalParser extends GenericPdfParser {
  protected reading: LayoutReading = { skip: isPageFooterLine };

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.COAST_CAPITAL && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCoastCapitalStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    const typed = (account: ParsedStatement) => ({
      ...account,
      transactions: account.transactions.map(coastCapitalEntry),
    });
    return {
      ...typed(statement),
      ...(statement.otherAccounts ? { otherAccounts: statement.otherAccounts.map(typed) } : {}),
    };
  }

  protected readTransactions(
    rows: PdfTextRow[],
    reading: LayoutReading = this.reading,
  ): LayoutTransaction[] {
    return super.readTransactions(rows, { ...reading, skip: isPageFooterLine }).map(row => ({
      ...row,
      counterparty: row.counterparty || coastCapitalPayee(row, rows),
    }));
  }
}

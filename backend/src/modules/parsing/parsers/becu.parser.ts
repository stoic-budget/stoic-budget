import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The credit union's legal name in the footer, and the heading of its activity lists. */
const BECU_NAME = /\bBoeing Employees['’] Credit Union\b/i;
const BECU_ACTIVITY = /\bDeposit Account Activity\b/i;

export function isBecuStatement(text: string): boolean {
  return BECU_NAME.test(text) && BECU_ACTIVITY.test(text);
}

/** How a line starts, by payment type; the card and the transfer wordings are the ones printed. */
const PAYMENT_TYPES: [PaymentType, RegExp][] = [
  ['card', /^POS Withdrawal\b/i],
  ['bank_transfer_in', /^(?:External Deposit|Deposit Online Banking Transfer from)\b/i],
  ['bank_transfer_out', /^Withdrawal Online Banking Transfer To\b/i],
];

export function becuPaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  return PAYMENT_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** The reader's note after the payee, and the street address a card purchase prints before it. */
const TERMINAL_NOTE = /\s+Machine#.*$/i;
const KIND_PREFIX = /^(?:POS Withdrawal|External Deposit)\s+/i;
const STORE_NUMBER = /^\d{1,3}\s+(?=\D)/;
const ADDRESS_START = /\s\d{2,}\b.*$/;

/**
 * Who a line paid or came from. A card purchase prints a store number, the
 * payee and then its street address; an external deposit prints the sender.
 * A transfer between the member's own accounts names no one.
 */
export function becuPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim().replace(TERMINAL_NOTE, '');
  if (!KIND_PREFIX.test(text)) {
    return '';
  }
  const payee = text.replace(KIND_PREFIX, '').replace(STORE_NUMBER, '');
  return (becuPaymentType(text) === 'card' ? payee.replace(ADDRESS_START, '') : payee).trim();
}

/**
 * A summary row: product, account number, then the beginning balance, the
 * period's movements and the ending balance. Columns with nothing are blank,
 * so the first figure is the beginning and the last the ending balance.
 */
const SUMMARY_ROW = /\b(\d{8,})\s+((?:\(?-?[\d,]+\.\d{2}\)?\s*)+)$/gm;

export function becuSummaryBalances(text: string): Map<string, { start: number; end: number }> {
  const balances = new Map<string, { start: number; end: number }>();
  for (const [, account, figures] of text.matchAll(SUMMARY_ROW)) {
    const amounts = figures.match(/\(?-?[\d,]+\.\d{2}\)?/g)?.map(parseStatementAmount) ?? [];
    const start = amounts[0];
    const end = amounts[amounts.length - 1];
    if (amounts.length >= 2 && start != null && end != null) {
      balances.set(account, { start, end });
    }
  }
  return balances;
}

/**
 * BECU (US credit union) statement of accounts: one list of deposits and one
 * of withdrawals per account, unsigned amounts in dollars, no running balance;
 * the balances sit in a summary table at the top. The generic layout reading
 * reads the lists and splits the accounts; this names the credit union, takes
 * the balances from the summary, and gives each line its payee and type.
 */
export class BecuParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.BECU && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isBecuStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = withPaymentTypes(await super.parse(filePath, cachedText), becuPaymentType);
    const balances = becuSummaryBalances(text);
    const withBalances = <T extends Pick<ParsedStatement, 'metadata'>>(account: T): T => {
      const found = balances.get(account.metadata.accountNumber);
      return found
        ? {
            ...account,
            metadata: { ...account.metadata, balanceStart: found.start, balanceEnd: found.end },
          }
        : account;
    };
    return {
      ...withBalances(statement),
      ...(statement.otherAccounts && { otherAccounts: statement.otherAccounts.map(withBalances) }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || becuPayee(row.description),
    }));
  }
}

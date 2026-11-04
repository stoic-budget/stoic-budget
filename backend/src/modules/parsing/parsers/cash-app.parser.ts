import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { wholeMonth } from '../helpers/statement-header-period.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The issuer's name over its address, and the title every page carries. */
const CASH_APP_NAME = /\bCash App\b/;
const CASH_APP_TITLE = /^Account Statement$/m;

export function isCashAppStatement(text: string): boolean {
  return CASH_APP_NAME.test(text) && CASH_APP_TITLE.test(text);
}

/** "April 2025" over "Account Statement": the month the statement covers. */
const MONTH_TITLE = /^([A-Z][a-z]{2,8}) (\d{4})\nAccount Statement$/m;
/** "Balance on Apr 1 … Balance on Apr 30" over the three figures. */
const BALANCES =
  /Balance on [A-Za-z]{3,9} \d{1,2}\s+Change this month\s+Balance on [A-Za-z]{3,9} \d{1,2}\s+\$([\d,]+\.\d{2})\s+\$[\d,]+\.\d{2}\s+\$([\d,]+\.\d{2})/;
/** The account's own numbers on the last page, under the labels that name them. */
const ACCOUNT_NUMBER =
  /\n\S+ \d{3} \d{3} \d{3} (\d[\d ]*\d) [A-Za-z ]+\nCashtag Routing Number Account Number/;

/** What the Details column adds to a description. */
const DETAILS =
  /\s+(?:Standard transfer|Instant transfer|Cash App payment|Cash App Card|Stock (?:buy|sale)|Bitcoin (?:sale|buy)|Loan (?:repayment|drawdown) \(#\w+\))$/i;
const DIRECTION = /^(?:From|To)\s+/i;

export function cashAppPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  return DETAILS.test(text) ? text.replace(DETAILS, '').replace(DIRECTION, '') : '';
}

/** Transfers and payments between people say which way in the amount, cards by their name. */
export function cashAppPaymentType(description: string, credit: boolean): PaymentType | null {
  if (/\bCash App Card$/i.test(description)) {
    return 'card';
  }
  if (/\b(?:Standard transfer|Instant transfer|Cash App payment)$/i.test(description)) {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return null;
}

const toNumber = (text: string) => Number(text.replace(/,/g, ''));

/**
 * Cash App (US) account statement: the month in the title, "Balance on Apr 1"
 * and "Balance on Apr 30" in a summary, and a table of Date, Description,
 * Details, Fee and Amount where money in carries a plus and money out is
 * printed bare. The generic layout reading does the table; this names the
 * issuer, reads the summary, the account number and the month, and gives each
 * line its payee and type.
 */
export class CashAppParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CASH_APP && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCashAppStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const balances = BALANCES.exec(text);
    const title = MONTH_TITLE.exec(text);
    const month = title ? wholeMonth(title[1], Number(title[2])) : null;
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        accountNumber:
          statement.metadata.accountNumber ||
          ACCOUNT_NUMBER.exec(text)?.[1].replace(/ /g, '') ||
          '',
        ...(balances && {
          balanceStart: toNumber(balances[1]),
          balanceEnd: toNumber(balances[2]),
        }),
        ...(month && { dateFrom: month.from, dateTo: month.to }),
      },
      transactions: statement.transactions.map(row => {
        const paymentType = cashAppPaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || cashAppPayee(row.description),
    }));
  }
}

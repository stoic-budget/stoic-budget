import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The credit union's name in its address, and the member number box. */
const DCU_NAME = /\bDigital Federal Credit Union\b/i;
const DCU_MEMBER = /\bMEMBER #[^\d]*(\d{5,10})\b/;

export function isDcuStatement(text: string): boolean {
  return DCU_NAME.test(text) && DCU_MEMBER.test(text);
}

/** What an entry's first word says it is; a transfer takes its side from the money. */
const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^TRANSFER\b/i, 'transfer'],
  [/^DEPOSIT\b/i, 'bank_transfer_in'],
  [/^DIVIDEND\b/i, 'interest'],
  [/^PAYMENT\b/i, 'bank_transfer_out'],
  [/^(?:WITHDRAWAL|ATM)\b/i, 'cash'],
  [/^(?:POS|DEBIT CARD|PURCHASE)\b/i, 'card'],
  [/^(?:\S+ )*FEE\b/i, 'fee'],
];

export function dcuEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * Digital Federal Credit Union (US) account statement: each of the member's
 * shares under its name and number ("PRIMARY SAVINGS  ACCT# 1"), with
 * Withdrawals, Deposits and Balance, then a summary grid of the credits. The
 * generic layout reading does the tables and the accounts; this names the
 * credit union, gives each share its full number (member number and share)
 * and types the entries.
 */
export class DcuParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.DCU && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isDcuStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const member = DCU_MEMBER.exec(text)?.[1];
    const share = (account: ParsedStatement): ParsedStatement => {
      const { accountNumber } = account.metadata;
      return {
        ...account,
        metadata: {
          ...account.metadata,
          accountNumber:
            member && /^\d{1,4}$/.test(accountNumber)
              ? `${member}-${accountNumber}`
              : accountNumber,
        },
        transactions: account.transactions.map(dcuEntry),
      };
    };
    return {
      ...share(statement),
      ...(statement.otherAccounts ? { otherAccounts: statement.otherAccounts.map(share) } : {}),
    };
  }
}

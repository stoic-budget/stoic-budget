import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name in the letterhead, and the title of its statement. */
const COMMBANK_NAME = /\bCommonwealth Bank of Australia\b/;
const COMMBANK_TITLE = /\bTransaction Summary\b/;

export function isCommBankStatement(text: string): boolean {
  return COMMBANK_NAME.test(text) && COMMBANK_TITLE.test(text);
}

/** The card a purchase was made with, on the entry's last line: "Card xx1234". */
const CARD = /\s+Card xx\d{4}$/;

/**
 * What an entry's words say it is, and the payee they name: a direct debit's
 * biller after its user number, without the reference closing the line ("Direct
 * Debit 123456 ACME PAYMENTS J00000000000A"); a transfer's other party
 * before "CommBank".
 */
const KINDS: [RegExp, PaymentType, ((match: RegExpExecArray) => string)?][] = [
  [/^Direct Debit \d+ (.+?)(?: [A-Z0-9]{12,})?$/, 'direct_debit', match => match[1]],
  [/^Direct Credit (?:\d+ )?(.+)$/, 'bank_transfer_in', match => match[1]],
  [/^Transfer from (.+?) CommBank\b/, 'bank_transfer_in', match => match[1]],
  [/^Transfer to\b/, 'bank_transfer_out'],
  [/\bNetBank BPAY\b/, 'bank_transfer_out', match => match.input.slice(0, match.index).trim()],
  [/^(?:Wdl ATM|Cardless Cash|CASH DEPOSIT)\b/, 'cash'],
  [/\bATM Withdrawal Fee$/, 'fee'],
  [/^Debit Excess Interest$/, 'interest'],
];

export function commBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const purchase = text.replace(CARD, '');
  for (const [pattern, paymentType, payee] of KINDS) {
    const match = pattern.exec(purchase);
    if (match) {
      return { ...row, paymentType, ...(payee ? { counterpartyName: payee(match) } : {}) };
    }
  }
  // Anything else spent is a card purchase, the card named or not ("SUBWAY CAULFIELD").
  return Number(row.debit) > 0
    ? { ...row, paymentType: 'card', counterpartyName: purchase.replace(/\s+Cash Out\b.*$/, '') }
    : row;
}

/**
 * Commonwealth Bank (Australia) Transaction Summary: one account, its
 * entries under Date, Transaction, Debit, Credit and Balance, a card entry's
 * card on its second line. The generic layout reading does the table; this
 * names the bank and gives each entry its payee and type.
 */
export class CommBankParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.COMMBANK && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCommBankStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, transactions: statement.transactions.map(commBankEntry) };
  }
}

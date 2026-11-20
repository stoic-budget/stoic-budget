import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the letterhead and its IBAN prefix. */
const QNB_NAME = /\bQatar National Bank\b/i;
const QNB_IBAN = /\bQA\d{2}QNBA\d{21}\b/;

export function isQnbStatement(text: string): boolean {
  return QNB_NAME.test(text) && QNB_IBAN.test(text);
}

const isHeader = (row: PdfTextRow) =>
  /^Date Description Debit Credit Balance$/i.test(row.text.trim());
const WHOLE = /^-?[1-9]\d{0,8}$/;

/**
 * QNB prints whole amounts without their decimals ("11670", "-120"). On a
 * dated row, a whole number under the Debit, Credit or Balance heading (the
 * last page's, on a page that prints none) is given them, so the table
 * reader takes it for money.
 */
export function withWholeAmounts(rows: PdfTextRow[]): PdfTextRow[] {
  const money = new Map<number, { from: number; to: number }>();
  for (const row of rows.filter(isHeader)) {
    const items = row.items.filter(item => /^(?:Debit|Credit|Balance)$/i.test(item.text));
    money.set(row.page, {
      from: Math.min(...items.map(item => item.x)) - 12,
      to: Math.max(...items.map(item => item.x + item.width)) + 20,
    });
  }
  // A page without the header goes on under the last page's.
  const rangeOn = (page: number) =>
    [...money.entries()].filter(([at]) => at <= page).sort((a, b) => b[0] - a[0])[0]?.[1];
  return rows.map(row => {
    const range = rangeOn(row.page);
    const first = [...row.items].sort((a, b) => a.x - b.x)[0];
    if (!(range && first && parseDateParts(first.text, 'dmy'))) {
      return row;
    }
    const items = row.items.map(item =>
      WHOLE.test(item.text) && item.x >= range.from && item.x + item.width <= range.to
        ? { ...item, text: `${item.text}.00` }
        : item,
    );
    return { ...row, items, text: items.map(item => item.text).join(' ') };
  });
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^POS-PURCHASE\b|^POS\b/i, 'card'],
  [/^ATM CASH\b/i, 'cash'],
  [/\b(?:FEE|CHARGES?|COMMISSION)\b/i, 'fee'],
  [/\bPROFIT\b|\bINTEREST\b/i, 'interest'],
  [/\b(?:FUND TRANSFER|TRANSFER|SALARY|PAYMENT)\b/i, 'transfer'],
];

/** "POS-PURCHASE 000100XXXXXX0001 POS ACME STORE - SAMPLETOWN P.O.BOX": the shop after the card. */
const CARD_SHOP = /^POS-PURCHASE \S+ POS (.+?)(?: P\.O\.BOX.*)?$/i;

export function qnbEntry(row: ParsedTransaction): ParsedTransaction {
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

/** "(QA12QNBA000000000171415514001)" under "Account(IBAN)". */
const IBAN = /\((QA\d{2}QNBA\d{21})\)/;

/**
 * Qatar National Bank (QNB) bank statement, in English and Arabic: the
 * account type, number and IBAN and the currency ("QATARI RIYAL"), then
 * Date, Description, Debit, Credit and Balance from the opening balance,
 * each row's details over several lines, whole amounts printed without
 * their decimals. This names the bank, gives whole amounts their decimals,
 * keeps riyals and the IBAN, and types the rows.
 */
export class QnbParser extends BankPdfParser {
  protected readonly bank = BankName.QNB;

  protected recognises(text: string): boolean {
    return isQnbStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const iban = IBAN.exec(text)?.[1];
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        currency: 'QAR',
        ...(iban ? { accountNumber: iban } : {}),
      },
      transactions: statement.transactions.map(row => ({ ...row, currency: 'QAR' })),
    };
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withWholeAmounts(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return qnbEntry(row);
  }
}

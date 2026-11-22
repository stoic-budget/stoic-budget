import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The e-money issuer's name and the wallet's web address. */
const SKRILL_ISSUER = /\bPaysafe Payment Solutions Limited\b/i;
const SKRILL_SITE = /\bwww\.skrill\.com\b/i;

export function isSkrillStatement(text: string): boolean {
  return SKRILL_ISSUER.test(text) && SKRILL_SITE.test(text);
}

/**
 * The header names its money columns by their sign and currency: "(+) USD",
 * "(-) USD". They are named money in and out for the table reader, the
 * currency word dropped.
 */
export function withNamedSigns(rows: PdfTextRow[]): PdfTextRow[] {
  return rows.map(row => {
    if (!/^SKRILL ID\b/i.test(row.text.trim())) {
      return row;
    }
    const items = row.items
      .filter(
        (item, index, all) =>
          !(/^[A-Z]{3}$/.test(item.text) && /^\([+-]\)$/.test(all[index - 1]?.text ?? '')),
      )
      .map(item =>
        item.text === '(+)'
          ? { ...item, text: 'Credit' }
          : item.text === '(-)'
            ? { ...item, text: 'Debit' }
            : item,
      );
    return { ...row, items, text: items.map(item => item.text).join(' ') };
  });
}

/** "Start Balance  0.00 … End Balance  0.00" in the summary. */
function summaryBalance(text: string, label: string): number | null {
  const match = new RegExp(`\\b${label}\\s+(-?[\\d,]+\\.\\d{2})`, 'i').exec(text);
  return match ? parseStatementAmount(match[1]) : null;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\bFEE\b/i, 'fee'],
  [/^(?:SEND_MONEY|RECEIVE_MONEY|UPLOAD|WITHDRAW|CURRENCY_EXCHA)/i, 'transfer'],
  [/^(?:CARD|PAYMENT)\b/i, 'card'],
];

export function skrillEntry(read: ParsedTransaction): ParsedTransaction {
  // The type column wraps its word: "CURRENCY_EXCHA" over "NGE".
  const text = read.paymentPurpose
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(\S+_\S*) (.+) ([A-Z]{2,4})$/, '$1$3 $2');
  const row = { ...read, paymentPurpose: text, counterpartyName: text };
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
  return { ...row, paymentType };
}

/**
 * Skrill (Paysafe) wallet statement: the holder, the period, the consumer
 * ID and the currency, the start and end balance, then Skrill ID, Date,
 * Type, Transaction details, "(+) USD", "(-) USD", currency, FX rate,
 * recipient, status and balance. This names the wallet, reads the signed
 * money headings and the summary's balances and types the rows; the
 * generic layout reading does the table.
 */
export class SkrillParser extends BankPdfParser {
  protected readonly bank = BankName.SKRILL;

  protected recognises(text: string): boolean {
    return isSkrillStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const start = summaryBalance(text, 'Start Balance');
    const end = summaryBalance(text, 'End Balance');
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        ...(start !== null && { balanceStart: start }),
        ...(end !== null && { balanceEnd: end }),
      },
    };
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withNamedSigns(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return skrillEntry(row);
  }
}

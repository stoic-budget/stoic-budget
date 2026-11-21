import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's BIC and its statement's title. */
const UNICREDIT_BIC = /\bUNCRIT[A-Z0-9]{2,5}\b/;
const UNICREDIT_TITLE = /\bEstratto conto al\b/i;

export function isUnicreditStatement(text: string): boolean {
  return UNICREDIT_BIC.test(text) && UNICREDIT_TITLE.test(text);
}

/** "Conto Corrente: 000100000001 - Valuta in EURO". */
const ACCOUNT = /\bConto Corrente:\s*(\d{6,})/i;

/**
 * Each movement's first line, its kind ("PAGAMENTO Contactless del
 * 29/03/2022"), is printed right above the line with its dates and was read
 * as the end of the movement before. It is moved to its own movement.
 */
export function withKindLines(rows: PdfTextRow[], read: LayoutTransaction[]): LayoutTransaction[] {
  const sorted = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const kindAbove = (at: { page: number; y: number }) => {
    const index = sorted.findIndex(row => row.page === at.page && Math.abs(row.y - at.y) < 1);
    const above = sorted[index - 1];
    const textOnly =
      above &&
      !/\d{2}\.\d{2}\.\d{2}/.test(above.items[0]?.text ?? '') &&
      !/\d,\d{2}$/.test(above.text);
    return index > 0 && textOnly && above.page === at.page && at.y - above.y < 10
      ? above.text.trim()
      : null;
  };
  return read.map((row, index) => {
    const own = row.at ? kindAbove(row.at) : null;
    const next = read[index + 1]?.at
      ? kindAbove(read[index + 1].at as { page: number; y: number })
      : null;
    let description = row.description;
    if (next && description.endsWith(next)) {
      description = description.slice(0, -next.length).trim();
    }
    if (own && !description.startsWith(own)) {
      description = `${own} ${description}`;
    }
    return { ...row, description };
  });
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^PAGAMENTO\b/i, 'card'],
  [/^PRELIEVO\b/i, 'cash'],
  [/^(?:BONIFICO|DISPOSIZIONE DI BONIFICO|GIROCONTO)\b/i, 'transfer'],
  [/^(?:ADDEBITO SDD|ADDEBITO DIRETTO)\b/i, 'direct_debit'],
  [/^(?:COMMISSIONI|CANONE|IMPOSTA|SPESE)\b/i, 'fee'],
  [/\bINTERESSI\b/i, 'interest'],
];

export function unicreditEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "CARTA *1000 DI EUR 3,00 ACME STORE SAMPLETOWN": the shop after the card's amount.
  const shop = /\bCARTA \*\d{4} DI [A-Z]{3} [\d.,]+ (.+)$/i.exec(text)?.[1];
  // "BONIFICO SEPA DA: MEMBER ONE COMM: 0,00": the party before the charges.
  const party = /\bBONIFICO SEPA (?:DA|A): (.+?)(?: COMM:.*)?$/i.exec(text)?.[1];
  const counterpartyName = shop ?? party;
  return { ...row, paymentType, ...(counterpartyName ? { counterpartyName } : {}) };
}

/**
 * UniCredit (Italy) account statement ("Estratto conto"): the branch, IBAN
 * and account, a summary from the opening balance with money out and in,
 * then Data, Valuta, Descrizione, Uscite and Entrate, each movement's kind
 * on the line above its dates. This names the bank, takes the account,
 * gives each movement its kind line and reads its party; the generic
 * layout reading does the table.
 */
export class UnicreditParser extends BankPdfParser {
  protected readonly bank = BankName.UNICREDIT;

  protected recognises(text: string): boolean {
    return isUnicreditStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return withKindLines(rows, super.readTransactions(rows, reading));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return unicreditEntry(row);
  }
}

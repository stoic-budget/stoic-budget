import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's BIC and name, as its Romanian statements print them. */
const RAIFFEISEN_BIC = /\bRZBRROBU\b/;
const RAIFFEISEN_NAME = /\bRAIFFEISEN BANK S\.A\.?/i;

export function isRaiffeisenStatement(text: string): boolean {
  return RAIFFEISEN_BIC.test(text) && RAIFFEISEN_NAME.test(text);
}

/**
 * The statement's font maps Romanian letters onto punctuation: "Dat`" is
 * "Dată", "tranzac]iei" is "tranzacției", "[" stands for "ș". Undone on
 * every word before the table is read.
 */
const LETTERS: Record<string, string> = { '`': 'ă', ']': 'ț', '[': 'ș', '|': 'Ț', '\\': 'Ș' };

export function restoreLetters(text: string): string {
  return text.replace(/(?<=\p{L})[`\][|\\]|[`\][|\\](?=\p{L})/gu, mark => LETTERS[mark] ?? mark);
}

export function withRestoredLetters(rows: PdfTextRow[]): PdfTextRow[] {
  return rows.map(row => {
    const items = row.items.map(item => ({ ...item, text: restoreLetters(item.text) }));
    return { ...row, items, text: items.map(item => item.text).join(' ') };
  });
}

/** "Sold inițial  Rulaj debitor  Rulaj creditor  Sold final" over their four figures. */
const SUMMARY = /Sold ini.ial Rulaj debitor Rulaj creditor Sold final (\S+) (\S+) (\S+) (\S+)/i;

export function raiffeisenBalances(text: string): { start: number; end: number } | null {
  const match = SUMMARY.exec(text.replace(/\s+/g, ' '));
  const start = match ? parseStatementAmount(match[1]) : null;
  const end = match ? parseStatementAmount(match[4]) : null;
  return start !== null && end !== null ? { start, end } : null;
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^ATM\b|\bRetragere\b/i, 'cash'],
  [/\bCard nr\.|\bData utilizarii cardului\b/i, 'card'],
  [/\b(?:Comision|Taxa)\b/i, 'fee'],
  [/\bDobanda\b/i, 'interest'],
  [/^OP[A-Z]*\/|\bPlata\b|\bTransfer\b|\bIncasare\b/i, 'transfer'],
];

export function raiffeisenEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "ACME SRL SAMPLETOWN Card nr. XXXX …": the shop before the card's line;
  // "OPIB/1 MEMBER ONE RO00 SAMP …": the party between the order code and its IBAN.
  const party =
    kind === 'card'
      ? text.split(/\s+Card nr\./i)[0]
      : /^OP[A-Z]*\/\S*\s+(.+?)\s+RO\d{2} [A-Z]{4}\b/.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Raiffeisen Bank (Romania) account statement ("Extras de cont"): the
 * holder, BIC, IBAN and currency, a summary of the opening balance, debit
 * and credit turnover and the final balance, then the posting and the
 * transaction date, the description, and the debit or credit sum, each day
 * closed by its balance ("Soldul zilei"). This names the bank, restores the
 * letters its font prints as punctuation, takes the balances from the
 * summary and types the rows; the generic layout reading does the table.
 */
export class RaiffeisenParser extends BankPdfParser {
  protected readonly bank = BankName.RAIFFEISEN;

  protected recognises(text: string): boolean {
    return isRaiffeisenStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const balances = raiffeisenBalances(text);
    return balances
      ? {
          ...statement,
          metadata: {
            ...statement.metadata,
            balanceStart: balances.start,
            balanceEnd: balances.end,
          },
        }
      : statement;
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(withRestoredLetters(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return raiffeisenEntry(row);
  }
}

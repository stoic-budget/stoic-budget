import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's sign-off or legal name, and the statement's title. */
const N26_NAME = /\bYour N26 Team\b|\bN26 Bank (?:AG|GmbH|SE)\b|\bNTSBDEB1\b/i;
const N26_TITLE = /\bBank Statement Nr\.|\bKontoauszug Nr\./i;

export function isN26Statement(text: string): boolean {
  return N26_NAME.test(text) && N26_TITLE.test(text);
}

/** The line under the party says how the money moved ("Mastercard • Shopping", "MoneyBeam"). */
const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\s(?:Mastercard|Maestro|Visa)\s*•/, 'card'],
  [
    /\s(?:Income|MoneyBeam|Outgoing transfer|Incoming transfer|Gutschrift|Überweisung)\b/,
    'transfer',
  ],
  [/\s(?:Direct Debit|Lastschrift)\b/, 'direct_debit'],
  [/\s(?:N26 (?:Smart|You|Metal) Membership|Fee)\b/, 'fee'],
];

export function n26Entry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, kind] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      return { ...row, paymentType, counterpartyName: text.slice(0, match.index).trim() };
    }
  }
  return row;
}

/** "IT60X05 4281110…416 • BIC": an IBAN before its BIC, the text letter-spaced at times. */
const IBAN_BEFORE_BIC = /\b([A-Z]{2}\d{2}[A-Z0-9 ]{11,40}?)\s*•\s*B\s?IC\b/g;

/** The holder's IBAN: printed at the foot of every page, so more often than any party's. */
export function n26Account(text: string): string | null {
  const counts = new Map<string, number>();
  for (const [, spaced] of text.matchAll(IBAN_BEFORE_BIC)) {
    const iban = spaced.replace(/\s+/g, '');
    counts.set(iban, (counts.get(iban) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * N26 (Germany) bank statement: Description, Booking Date and Amount (the
 * date right of the text), each row's party over the way the money moved,
 * its note and value date, then an overview from the previous to the new
 * balance. The generic layout reading does the table; this names the bank,
 * takes the holder's IBAN from the page footers and reads each row's kind.
 */
export class N26Parser extends BankPdfParser {
  protected readonly bank = BankName.N26;

  protected recognises(text: string): boolean {
    return isN26Statement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const account = n26Account(text);
    return account
      ? { ...statement, metadata: { ...statement.metadata, accountNumber: account } }
      : statement;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return n26Entry(row);
  }
}

import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the letterhead and its BIC in every page's box. */
const DEUTSCHE_NAME = /\bDeutsche Bank\b/;
const DEUTSCHE_BIC = /\bDEUTDE[A-Z0-9]{2,5}\b/;
/** The account's IBAN, in groups of four, in every page's box. */
const IBAN = /\bDE\d{2}(?: ?\d{4}){4} ?\d{2}\b/;

export function isDeutscheBankStatement(text: string): boolean {
  return DEUTSCHE_NAME.test(text) && DEUTSCHE_BIC.test(text);
}

const REFERENCE = /\s*Payment Reference\/E2E-Ref\.\s*/i;

/** The entry's kind, first on its line; a transfer takes its side from the money. */
const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Kartenzahlung\b/i, 'card'],
  [/^SEPA Lastschrifteinzug\b/i, 'direct_debit'],
  [/^SEPA (?:Echtzeit-)?[ÜU]berweisung\b/i, 'transfer'],
  [/^Auszahlung Geldautomat\b|^GA NR/i, 'cash'],
  [/^(?:Entgelt|Kontoführung)\b/i, 'fee'],
  [/^(?:Zinsen|Habenzinsen)\b/i, 'interest'],
];

/**
 * A row as Deutsche Bank prints it: the kind ("Kartenzahlung", "SEPA
 * Lastschrifteinzug von FitX Deutschland GmbH"), then "Payment
 * Reference/E2E-Ref." and the reference. A direct debit or a transfer names
 * its party after "von"/"an"; a card payment names the shop before "//"; a
 * cash machine of the bank's own prints only "GA NR…".
 */
export function deutscheBankEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const [head, reference = ''] = text.split(REFERENCE);
  const kindText = head || reference;
  const found = KINDS.find(([pattern]) => pattern.test(kindText))?.[1];
  const paymentType =
    found === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : found;
  const party = /\b(?:von|an)\s+(.+)$/i.exec(head)?.[1];
  const shop = paymentType === 'card' ? reference.split('//')[0] : undefined;
  const payee = party ?? shop ?? (paymentType === 'cash' ? 'Auszahlung Geldautomat' : undefined);
  return {
    ...row,
    ...(payee ? { counterpartyName: payee.trim() } : {}),
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * Deutsche Bank (Germany) account statement in English: each page's box with
 * the statement number, IBAN and BIC (the previous balance at its right end),
 * then Booking date, Value, Item, Debit and Credit, signed amounts, and the
 * new balance in a box at the end. The generic layout reading does the table
 * and the balances; this names the bank, takes the IBAN as the account, reads
 * "Value" as the value date and "Item" as the text, and gives each entry its
 * party and type.
 */
export class DeutscheBankParser extends BankPdfParser {
  protected readonly bank = BankName.DEUTSCHE_BANK;

  protected reading: LayoutReading = {
    headings: new Map([
      ['value', 'otherDate'],
      ['item', 'description'],
    ]),
  };

  protected recognises(text: string): boolean {
    return isDeutscheBankStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return IBAN.exec(text)?.[0].replace(/\s+/g, '') ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return deutscheBankEntry(row);
  }
}

import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The web address on every statement, and the heading over its tables. */
const COMERICA_SITE = /\bcomerica\.com\b/i;
const COMERICA_DETAILS = /\bDetails of your Comerica\b/;

export function isComericaStatement(text: string): boolean {
  return COMERICA_SITE.test(text) && COMERICA_DETAILS.test(text);
}

/**
 * The bank reference number closing each entry, under "Bank reference number"
 * at the right: "9488940053", "MS10804907", now and then printed in two
 * pieces ("MS0120 0").
 */
const REFERENCE = /\s+([A-Z0-9]{6,10}(?: [A-Z0-9]{1,4})?)$/;
/** A card's reference: "MS" for a purchase, "MA" for a cash machine. */
const CARD_REFERENCE = /^M[AS]\d/;
/** The card's last four digits closing a card entry's text. */
const CARD_DIGITS = /\s+\d{4}$/;
/** "Zelle Member One": the other party after the service's name. */
const ZELLE = /^Zelle\s+/i;

/** What an entry's first words say it is. */
const KINDS: [RegExp, PaymentType][] = [
  [/^Foreign Fee\b/i, 'fee'],
  [/^W\/D At\b/i, 'cash'],
];

/**
 * A card's purchases and fees carry a card reference; the rest are electronic:
 * a Zelle payment either way, a payer's deposit in, or a biller's pull out.
 */
export function comericaPaymentType(
  purpose: string,
  reference: string,
  credit: boolean,
): PaymentType {
  const kind = KINDS.find(([pattern]) => pattern.test(purpose))?.[1];
  if (kind) {
    return kind;
  }
  if (CARD_REFERENCE.test(reference)) {
    return 'card';
  }
  if (ZELLE.test(purpose)) {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return credit ? 'bank_transfer_in' : 'direct_debit';
}

/** A card entry's text without the card's digits, a Zelle payment's other party. */
export function comericaPayee(purpose: string, reference: string): string {
  if (CARD_REFERENCE.test(reference)) {
    return purpose.replace(CARD_DIGITS, '');
  }
  return purpose.replace(ZELLE, '');
}

export function comericaEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const match = REFERENCE.exec(text);
  const reference = match?.[1] ?? '';
  const purpose = match ? text.slice(0, match.index) : text;
  const ownPayee = row.counterpartyName && row.counterpartyName !== row.paymentPurpose;
  return {
    ...row,
    paymentPurpose: purpose,
    counterpartyName: ownPayee ? row.counterpartyName : comericaPayee(purpose, reference),
    paymentType: comericaPaymentType(purpose, reference, Number(row.credit) > 0),
    ...(reference ? { documentNumber: reference } : {}),
  };
}

/**
 * Comerica Bank (US) checking statement: an account summary, then electronic
 * deposits, card transactions and electronic withdrawals, each a table of
 * Date, Amount and Activity with the bank reference number at the right and
 * no running balance. The generic layout reading does the tables; this names
 * the bank and splits each entry's reference from its text, with its payee
 * and type.
 */
export class ComericaParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.COMERICA && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isComericaStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, transactions: statement.transactions.map(comericaEntry) };
  }
}

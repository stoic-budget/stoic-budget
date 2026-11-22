import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's customer site and the statement's title. */
const SG_SITE = /\bparticuliers\.societegenerale\.fr\b|\bsocietegenerale\.(?:fr|mobi)\b/i;
const SG_TITLE = /\bRelevé de compte\b/i;

export function isSocieteGeneraleStatement(text: string): boolean {
  return SG_SITE.test(text) && SG_TITLE.test(text);
}

/** "n° 30003 00542 00050000000 12": the bank, branch and account codes. */
const ACCOUNT = /\bn°\s*(\d{5} \d{5} \d{5,11}(?: \d{2})?)\b/;

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [/\bRETRAIT DAB\b/i, 'cash'],
  [/^CARTE \S+\b/i, 'card', /^CARTE \S+ \d{2}\/?\d{2} (.+)$/i],
  [
    /^(?:PRLV|PRELEVEMENT)\b/i,
    'direct_debit',
    /^(?:PRLV SEPA|PRLV|PRELEVEMENT) (.+?)(?: (?:REF|ID)\b.*)?$/i,
  ],
  [/^(?:COTISATION|FRAIS|COMMISSION|AGIOS)\b/i, 'fee'],
  [/^(?:VIR(?:EMENT)? RECU)\b/i, 'bank_transfer_in', /\bDE: (.+?)(?: MOTIF:.*)?$/i],
  [/^(?:VIR(?:EMENT)?|VIR PERM)\b/i, 'transfer', /\bPOUR: (.+?)(?: MOTIF:.*)?$/i],
  [/\bINTERETS?\b/i, 'interest'],
];

export function societeGeneraleEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text));
  if (!found) {
    return row;
  }
  const [, kind, partyPattern] = found;
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = partyPattern?.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Société Générale (France) account statement ("Relevé de compte"): the
 * contacts and the account's codes, then Date, Valeur, Nature de
 * l'opération, Débit and Crédit from the previous balance, each row's
 * details under its first line. The generic layout reading does the table;
 * this names the bank, takes the account's codes and reads each row's kind
 * and party (card shop, transfer's payer, direct debit's creditor).
 */
export class SocieteGeneraleParser extends BankPdfParser {
  protected readonly bank = BankName.SOCIETE_GENERALE;

  protected recognises(text: string): boolean {
    return isSocieteGeneraleStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return societeGeneraleEntry(row);
  }
}

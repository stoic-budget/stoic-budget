import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name in the letterhead, and the title of its statement. */
const CA_NAME = /\bCR[ÉE]DIT AGRICOLE\b/i;
const CA_TITLE = /\bRELEVE DE COMPTES\b/i;

export function isCreditAgricoleStatement(text: string): boolean {
  return CA_NAME.test(text) && CA_TITLE.test(text);
}

/** The tick boxes of the column at the right ("þ" over it, "¨" by each entry): no text of any. */
const TICK = /(?:^|\s)[¨þ](?=\s|$)/g;
/** The fee mark the statement explains under the table ("signalés … par **"). */
const FEE_MARK = /^\*\*\s*/;
/** "Carte Paypal Luxembourg 19/12": the merchant, between the word and the day it was paid. */
const CARD = /^(?:Avoir )?Carte (.+?)(?: \d{2}\/\d{2})?$/i;

/** What an entry's first words say it is. */
const KINDS: [RegExp, PaymentType][] = [
  [/^(?:Avoir )?Carte\b/i, 'card'],
  [/^Retrait\b/i, 'cash'],
  [/^(?:Prlv|Pr[ée]l[èe]vement)\b/i, 'direct_debit'],
  [/^Cotis\b/i, 'fee'],
];

export function creditAgricoleEntry(row: ParsedTransaction): ParsedTransaction {
  const ticked = row.paymentPurpose.replace(TICK, ' ').replace(/\s+/g, ' ').trim();
  const fee = FEE_MARK.test(ticked);
  const text = ticked.replace(FEE_MARK, '');
  const transfer = /^Vir(?:ement)?\b/i.test(text)
    ? Number(row.credit) > 0
      ? 'bank_transfer_in'
      : 'bank_transfer_out'
    : undefined;
  const paymentType = fee
    ? 'fee'
    : (KINDS.find(([pattern]) => pattern.test(text))?.[1] ?? transfer);
  const merchant = CARD.exec(text)?.[1];
  return {
    ...row,
    paymentPurpose: text,
    counterpartyName: merchant ?? text,
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * Crédit Agricole (France) relevé de comptes: each account under its name
 * and IBAN, its entries under Date opé., Date valeur, Libellé des opérations,
 * Débit and Crédit, a column of tick boxes at the right. The generic layout
 * reading does the table; this names the bank, drops the tick boxes and the
 * fee mark, and gives each entry its payee and type.
 */
export class CreditAgricoleParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CREDIT_AGRICOLE && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCreditAgricoleStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, transactions: statement.transactions.map(creditAgricoleEntry) };
  }
}

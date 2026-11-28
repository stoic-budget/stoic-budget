// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { readBlocks } from '../helpers/pdf-layout-blocks.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import {
  findAccountCurrency,
  findCzechAccount,
  headerLines,
} from '../helpers/statement-czech-account.helper';
import { findForeignAmount } from '../helpers/statement-foreign-amount.helper';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * Raiffeisenbank (Czech Republic) account statement. Each row is a block of
 * two to four lines: the booking date, the category, the kind of payment and
 * the amount; the value date, the counterparty's account and, for a payment
 * abroad, the original amount ("3,00 EUR"); the transaction code with the
 * counterparty's name, or the card ("PK: …") and the rate ("25,10 CZK/EUR");
 * for a card payment, the merchant and its town ("ACME; PRAHA 4; CZE",
 * "3,00 EUR;ACME FUEL 731; Svit; SVK").
 *
 * Only a block's first line holds money: the generic layout reading reads
 * the table from those lines with the others kept as text (a block cut by a
 * page break goes on past the next page's header), and this parser reads each
 * block's payee, account and original amount. The account's currency is the
 * one its balances print, else koruna. Unlike zumfi's reading the side comes from
 * the amount's sign, not from words in the merchant's name, and the original
 * amount is not glued to the value date's year.
 */

/** The bank's BIC, or its name as the page header prints it. */
const RB_BANK = /\bRZBC\s?CZ\s?PP\b|(?<!\p{L})raiffeisenbank,?\s+a\.\s?s\./iu;
/** The header's own account, on its label's line, with the bank's code 5500. */
const RB_ACCOUNT =
  /^[ \t]*(?:[čc][íi]slo\s+[úu][čc]tu|iban)\s*:?[^\n]*?(?:\d\s?\/\s?5500\b|\bCZ\d{2}\s?5500)/imu;

/**
 * A Raiffeisenbank statement names the bank in its header and prints its own
 * account there, on the account's label line, with the bank's code 5500: a
 * row paying a Raiffeisenbank account, in another bank's statement, does not.
 */
export function isRaiffeisenbankCzStatement(text: string): boolean {
  const head = headerLines(text);
  return RB_BANK.test(head) && RB_ACCOUNT.test(head);
}

/**
 * A block's first line: the booking date, its text and the amount, printed
 * with the account's currency or none (a savings account). The value date's
 * line under it can end in a figure too, but in another currency.
 */
function firstLinePattern(currency: string): RegExp {
  const codes = currency === 'CZK' ? 'CZK|Kč' : currency;
  return new RegExp(
    String.raw`^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\s+.+?\s+-?[\d\s]+[,.]\d{2}\s*(?:${codes})?\s*$`,
    'u',
  );
}
/** "Počáteční zůstatek: 500,00 EUR": a balance names the account's currency. */
const BALANCE_CURRENCY = /(?:Počáteční|Konečný)\s+zůstatek:?\s*-?[\d\s]+[,.]\d{2}\s*([A-Z]{3}|Kč)/u;
/** Lines of a page's header and footer (zumfi's list): no row's text. */
const PAGE_HEADER = [
  'Výpis z',
  'Pořadové',
  'Strana ',
  'Raiffeisenbank',
  'Přehled',
  'Číslo účtu',
  'Název účtu',
  'IBAN',
  'BIC:',
  'Počáteční',
  'Příjmy celkem',
  'Výdaje celkem',
  'Konečný',
  'Pohledávky',
  'Poplatky',
  'Výpis pohybů',
  'Datum Kategorie',
  'Valuta Číslo',
  'Kód transakce Název',
];
const isPageHeader = (row: PdfTextRow) =>
  PAGE_HEADER.some(prefix => row.text.trim().startsWith(prefix));

const VALUE_DATE = /^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/;
/** "8436776146 ACME s.r.o.": the transaction code and the counterparty's name. */
const CODE_LINE = /^(\d{10,})(?:\s+(.*))?$/;
/** A card's line names the card, not anyone: "PK: 516844XXXXXX4400". */
const CARD = /\bPK:/;
/** "ACME POTRAVINY; PRAHA 4; CZE": a card merchant, its town and country. */
const LOCATION = /^([^;]+);[^;]*;\s*[A-Z]{3}\s*$/;
/** "3,00 EUR;ACME FUEL 731 SVIT; Svit; SVK": the original amount before the merchant. */
const FOREIGN_DETAIL = /^[\d\s]+[,.]\d{2}\s*[A-Z]{3};([^;]+)/;
const RATE_TAIL = /\s*[\d,.]+\s*[A-Z]{3}\/[A-Z]{3}\s*$/;

/**
 * Who the block names, in zumfi's order: the code line's name, the foreign
 * detail's merchant, the merchant's line. The value date's line names nobody,
 * whatever number it carries.
 */
export function raiffeisenbankPayee(lines: string[]): string | null {
  let payee: string | null = null;
  for (const line of lines) {
    if (VALUE_DATE.test(line)) {
      continue;
    }
    const code = line.match(CODE_LINE);
    if (code) {
      const name = (code[2] ?? '').replace(RATE_TAIL, '').trim();
      payee = payee ?? (name.length >= 2 && !CARD.test(name) ? name : null);
      continue;
    }
    const foreign = line.match(FOREIGN_DETAIL);
    if (foreign) {
      payee = foreign[1].trim() || payee;
      continue;
    }
    const location = line.match(LOCATION);
    if (location) {
      payee = location[1].trim();
    }
  }
  return payee;
}

/** The text of a block's first line, "Platba kartou Platba kartou" printed once. */
const firstLineText = (text: string) =>
  text.replace(/\b(Platba kartou)\s+\1\b/i, '$1').replace(/^Platba\s+Platba\b/i, 'Platba');

/** The account's currency: the one its balances print, else the header's, else koruna. */
function accountCurrency(text: string): string {
  const code = text.match(BALANCE_CURRENCY)?.[1];
  return code === 'Kč' ? 'CZK' : (code ?? findAccountCurrency(text) ?? 'CZK');
}

export class RaiffeisenbankCzParser extends BankPdfParser {
  protected readonly bank = BankName.RAIFFEISENBANK_CZ;

  protected recognises(text: string): boolean {
    return isRaiffeisenbankCzStatement(text);
  }

  /** The one its balances print, not the most printed code: an original abroad is not it. */
  protected accountCurrency(text: string): string {
    return accountCurrency(text);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const currency = accountCurrency(rows.map(row => row.text).join('\n'));
    const firstLine = firstLinePattern(currency);
    const isFirstLine = (row: PdfTextRow) => firstLine.test(row.text.trim());
    const reading = readBlocks(rows, isFirstLine, isPageHeader);
    const read = super.readTransactions(reading.lines);
    const blocks = reading.blocks(read);
    return read.map((transaction, index) => {
      const under = blocks[index]
        .slice(1)
        .map(line => line.text.trim())
        .filter(Boolean);
      const purpose = under.map(line => line.replace(VALUE_DATE, '').trim()).filter(Boolean);
      const payee = raiffeisenbankPayee(under);
      const foreign = findForeignAmount(purpose.join('\n'), currency, transaction.amount);
      const account = findCzechAccount(purpose.join(' '));
      return {
        ...transaction,
        counterparty: payee ?? firstLineText(transaction.firstLine),
        description: [transaction.firstLine, ...purpose].join(' '),
        ...(account && { counterpartyAccount: account }),
        ...(foreign && { amountForeign: foreign.amount, exchangeRate: foreign.rate }),
      };
    });
  }
}

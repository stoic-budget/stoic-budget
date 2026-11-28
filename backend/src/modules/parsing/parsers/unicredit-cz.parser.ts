// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { byPosition, readBlocks } from '../helpers/pdf-layout-blocks.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import {
  findAccountCurrency,
  findCzechAccount,
  headerLines,
  readPaymentSymbols,
} from '../helpers/statement-czech-account.helper';
import { findForeignAmount } from '../helpers/statement-foreign-amount.helper';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * UniCredit Bank Czech Republic and Slovakia account statement: columns
 * Datum, Valuta, Transakce, Příjmy and Výdaje. Each row is a block: the
 * booking and value dates, the kind of transaction and the amount on its
 * first line; under it the details as the kind prints them: for a card
 * payment the card, the holder, the original amount ("EUR 1,00"), the rate
 * ("1,00 EUR/CZK 25,400000"), the merchant behind its code ("ACME4423, ACME
 * Market") and its town ("Praha, CZE"); for a transfer "Příjemce:" or
 * "Plátce:", "Popis:", the counterparty's account and the symbols.
 *
 * Only a block's first line holds money: the generic layout reading reads the
 * table from those lines with the others kept as text, and this parser reads
 * each block's payee, account, reference and original amount. Unlike zumfi's
 * reading it keeps every detail line (zumfi drops any holding "příjmy",
 * "výdaje" or "id 1", a payment's message included), and names the payee
 * alone, the town and the message going into the purpose.
 */

/** A header line naming the bank: its name as the page header prints it, or its BIC. */
const UNICREDIT_CZ = /^\s*unicredit\s+bank\s+czech\s+republic|\bBIC:?\s*BACX\s?CZ\s?PP\b/imu;
/** The statement's own account on its label's line, carrying the bank's code 2700. */
const OWN_ACCOUNT =
  /^[ \t]*(?:[čc][íi]slo\s+[úu][čc]tu|IBAN)\s*:?[^\n]*?(?:\d\s?\/\s?2700\b|\bCZ\d{2}\s?2700)/imu;

/**
 * A UniCredit CZ statement names the bank on a header line and prints its own
 * account there, on its label's line, with the bank's code: a payment to a
 * UniCredit account in another bank's statement does not, and the Italian
 * UniCredit keeps its own parser.
 */
export function isUnicreditCzStatement(text: string): boolean {
  const head = headerLines(text);
  return UNICREDIT_CZ.test(head) && OWN_ACCOUNT.test(head);
}

/** The statement's own account, as its header's label line prints it. */
function ownAccount(text: string): string | null {
  const line = headerLines(text).match(OWN_ACCOUNT)?.[0];
  return line ? (findCzechAccount(line) ?? null) : null;
}

/** A block's first line: the booking date, maybe the value date, the kind and the signed amount. */
const FIRST_LINE =
  /^\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}\.\d{2}\.\d{4})?\s+.+?\s[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?:\s?(?:[A-Z]{3}|Kč))?$/u;

/** Lines of a page's header and footer (zumfi's list): no row's text. */
const PAGE_HEADER = [
  'unicredit bank czech republic',
  'obchodní rejstřík',
  'ičo/identification',
  'číslo výpisu',
  'frekvence výpisu',
  'datum výpisu',
  'období výpisu',
  'typ účtu',
  'typ konta',
  'strana ',
  'datum valuta transakce',
  'datum  valuta',
  'překontrolujte si',
  'v případě nejasností',
  'm_modul_',
  'výpis z účtu',
];
/** Footer words a page may print anywhere on a line. */
const PAGE_FOOTER = ['unicreditbank.cz', 'infolinka'];

/** A page's header or footer line, the header's own account line among them: no row's text. */
function pageHeader(own: string | null) {
  return (row: PdfTextRow) => {
    const text = row.text.trim().toLowerCase();
    return (
      PAGE_HEADER.some(start => text.startsWith(start)) ||
      PAGE_FOOTER.some(word => text.includes(word)) ||
      (own !== null &&
        /^[čc][íi]slo\s+[úu][čc]tu/u.test(text) &&
        findCzechAccount(row.text) === own)
    );
  };
}

const CARD_NUMBER = /^\d{4}-\d{1}XXX-XX\d{2}-\d{4}$/;
const HOLDER = /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ ]+$/u;
const AMOUNT_LINE = /^[A-Z]{3}\s+\d/;
const RATE_LINE = /^\d+,\d+\s+[A-Z]{3}\/[A-Z]{3}/;
const PLACE = /^(.+),\s*([A-Z]{2,3})$/;
const MERCHANT = /^(?=[A-Z0-9]*\d)[A-Z0-9]{4,},\s*(.+)$/;
const NOT_A_NAME = /^(?:datum transakce|mo\/to|odchozí|příchozí|ref1:|vs:|ks:|číslo účtu)/iu;

const field = (lines: string[], label: string) =>
  lines
    .find(line => line.toLowerCase().startsWith(label))
    ?.slice(label.length)
    .trim() || null;

/** The payment's message, unless it holds only a symbol ("Popis: VS 1234", as zumfi skips it). */
function message(lines: string[]): string | null {
  const text = field(lines, 'popis:');
  return text && !/^(?:[VKS]S:?\s*\d+\s*)+$/i.test(text) ? text : null;
}

/** A card payment's merchant, past the card, its holder, the amounts and the town. */
function cardMerchant(lines: string[]): string | null {
  for (const line of lines) {
    if (
      NOT_A_NAME.test(line) ||
      CARD_NUMBER.test(line) ||
      AMOUNT_LINE.test(line) ||
      RATE_LINE.test(line)
    ) {
      continue;
    }
    if (HOLDER.test(line) && !line.includes(',')) {
      continue;
    }
    const place = line.match(PLACE);
    if (place && !/\d/.test(place[1])) {
      continue;
    }
    const merchant = line.match(MERCHANT);
    if (merchant) {
      return merchant[1].trim();
    }
  }
  return null;
}

/**
 * Who the block names, the way zumfi reads each kind: the card merchant, the
 * payee of a domestic payment, the payer of a transfer within the bank, the
 * cash machine's place; else the kind of transaction itself.
 */
export function unicreditPayee(title: string, lines: string[]): string {
  const kind = title.toLowerCase();
  if (kind.includes('platba u obchodníka')) {
    return cardMerchant(lines) ?? title;
  }
  if (kind.includes('mobile banking') || kind.includes('tuzemská platba')) {
    return (
      field(lines, 'příjemce:') ??
      message(lines) ??
      title.replace(/(?:\s+okamžitá)?\s+-\s+Mobile Banking$/u, '')
    );
  }
  if (kind.includes('převod v rámci banky')) {
    return field(lines, 'plátce:') ?? message(lines) ?? title;
  }
  if (kind.includes('výběr z bankomatu')) {
    const place = lines.map(line => line.match(PLACE)).find(Boolean);
    return place ? `Výběr z bankomatu, ${place[1].trim()}` : title;
  }
  return title;
}

export class UnicreditCzParser extends BankPdfParser {
  protected readonly bank = BankName.UNICREDIT_CZ;

  protected recognises(text: string): boolean {
    return isUnicreditCzStatement(text);
  }

  /** The header's "Měna", else koruna: payments abroad can print another code more often. */
  protected accountCurrency(text: string): string {
    return findAccountCurrency(text) ?? 'CZK';
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const isFirstLine = (row: PdfTextRow) => FIRST_LINE.test(row.text.trim());
    const text = [...rows]
      .sort(byPosition)
      .map(row => row.text)
      .join('\n');
    const reading = readBlocks(rows, isFirstLine, pageHeader(ownAccount(text)));
    const read = super.readTransactions(reading.lines);
    const blocks = reading.blocks(read);
    const currency = this.accountCurrency(text);
    return read.map((transaction, index) => {
      const under = blocks[index]
        .slice(1)
        .map(line => line.text.trim())
        .filter(Boolean);
      const title = transaction.firstLine;
      const account = findCzechAccount(under.filter(line => /^číslo účtu/iu.test(line)).join(' '));
      const symbols = readPaymentSymbols(under.join('\n'));
      const foreign = findForeignAmount(under.join('\n'), currency, transaction.amount);
      return {
        ...transaction,
        counterparty: unicreditPayee(title, under),
        description: [title, ...under].join(' '),
        ...(account && { counterpartyAccount: account }),
        ...(symbols.vs && { documentNumber: symbols.vs }),
        ...(foreign && { amountForeign: foreign.amount, exchangeRate: foreign.rate }),
      };
    });
  }
}

// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { rowBlocks } from '../helpers/pdf-layout-blocks.helper';
import {
  withoutTrailingWords,
  withPaymentSymbols,
} from '../helpers/pdf-layout-payment-symbols.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findCzechAccount } from '../helpers/statement-czech-account.helper';
import { findFullDates } from '../helpers/statement-date.helper';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * ČSOB (Československá obchodní banka, Czech Republic) account statement: a
 * table of two-line rows, the day and month, the kind of payment, the
 * counterparty, the bank's id, the amount and the running balance on the
 * first line; the counterparty's account and the payment symbols under it.
 * The year comes from the period ("Období: 1. 3. 2026 - 31. 3. 2026"), or
 * from "Rok/č. výpisu: 2025/3" when no period is printed.
 *
 * The generic layout reading does the table, the running balance and the
 * period; this names the bank and its account ("Účet: …/0300"), names the
 * payee from the row's first line, takes the symbols out of it (the variable
 * symbol is the reference), and reads the counterparty's account. Unlike
 * zumfi's reading it goes on past a page's footer, and names the counterparty
 * alone as the payee, without the kind of payment before it.
 */

/** The bank's BIC, or its name as the page footer prints it, in any case. */
const CSOB_BANK =
  /\bCEKO\s?CZ\s?PP|(?<!\p{L})(?:československá\s+obchodní\s+banka|čsob,?\s+a\.\s?s\.)/iu;
/** The statement's year and number, which only its own header prints ("Rok/č. výpisu: 2026/3"). */
const CSOB_HEADER = /\brok\s*\/\s*č\.\s*výpisu\b/iu;
const STATEMENT_YEAR = /\brok\s*\/\s*č\.\s*výpisu\s*:?\s*((?:19|20)\d{2})\b/iu;
/** The statement's own account, on a header line: "Účet: 123456789/0300". */
const OWN_ACCOUNT = /^[ \t]*[úu][čc]et\s*:[ \t]*((?:\d{1,6}-)?\d{2,10}\/(\d{4}))(?![\d/])/imu;
/** ČSOB's bank code in the Czech Republic. */
const CSOB_CODE = '0300';

/**
 * A ČSOB statement names the bank and prints its year and number; when its
 * header prints the account, the account is ČSOB's. A row of another bank's
 * statement can name ČSOB (a payment from a ČSOB account, its BIC), and a
 * Slovak ČSOB statement prints its own bank code: both are left to the
 * generic reading.
 */
export function isCsobStatement(text: string): boolean {
  // Accents may come out of the PDF as a letter and a combining mark.
  const composed = text.normalize('NFC');
  const own = composed.match(OWN_ACCOUNT);
  return CSOB_BANK.test(composed) && CSOB_HEADER.test(composed) && (!own || own[2] === CSOB_CODE);
}

/**
 * The statement's year for rows printed without one, when no full date is
 * printed (no period): "Rok/č. výpisu: 2025/3" names the year of its last
 * day, so a December row on a statement whose rows reach January belongs to
 * the year before.
 */
export function withStatementYear(
  rows: PdfTextRow[],
  read: LayoutTransaction[],
): LayoutTransaction[] {
  const text = rows.map(row => row.text).join('\n');
  const year = Number(text.normalize('NFC').match(STATEMENT_YEAR)?.[1]);
  if (!year || findFullDates(text, 'dmy').length > 0) {
    return read;
  }
  const months = read.map(transaction => transaction.date.month);
  const turnsYear = months.includes(12) && months.includes(1);
  return read.map(transaction => {
    const { date } = transaction;
    const inYear = turnsYear && date.month > 6 ? year - 1 : year;
    // The date is read again from its text later on: the year goes into both.
    return date.year
      ? transaction
      : {
          ...transaction,
          date: { ...date, year: inYear },
          dateText: `${transaction.dateText.replace(/\.?$/, '.')}${inYear}`,
        };
  });
}

export class CsobParser extends BankPdfParser {
  protected readonly bank = BankName.CSOB;

  protected recognises(text: string): boolean {
    return isCsobStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return text.normalize('NFC').match(OWN_ACCOUNT)?.[1] ?? null;
  }

  /**
   * The payee is what the row's first line names, as zumfi reads it: the
   * second line's words (the account, the symbols, wherever its columns sit)
   * come off its end, and the account is read from either line.
   */
  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const read = withStatementYear(rows, withPaymentSymbols(rows, super.readTransactions(rows)));
    const blocks = rowBlocks(rows, read);
    return read.map((transaction, index) => {
      const under = blocks[index].slice(1).flatMap(line => line.items.map(item => item.text));
      const account =
        findCzechAccount(transaction.description) ?? findCzechAccount(under.join(' '));
      return {
        ...transaction,
        counterparty: withoutTrailingWords(transaction.counterparty, under),
        ...(account && { counterpartyAccount: account }),
      };
    });
  }
}

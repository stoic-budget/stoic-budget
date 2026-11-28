// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { leadingDateWords, rowBlocks } from '../helpers/pdf-layout-blocks.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findCzechAccount, headerLines } from '../helpers/statement-czech-account.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * mBank (Czech branch, and the Slovak branch's EUR account) statement: a
 * ruled table of the booking date, the day the transaction was made, the
 * description, the amount and the balance after it. mBank prints the
 * description's words glued together ("PLATBAKARTOU", "NájemACME") with the
 * day it was made appended ("DATUMPROVEDENÍTRANSAKCE:2026-03-01") and the
 * counterparty's account.
 *
 * The generic layout reading does the table, balances and checks; this
 * dates each row by the day it was made (zumfi's choice), puts the glued
 * words apart with zumfi's dictionary, and names the payee from the
 * description's second line.
 */

/** The bank's name, BIC or site. */
const MBANK = /\bmBank\s*S\.\s?A\.|\bBREX\s?(?:CZ|SK)\s?PP\b|\bmbank\.(?:cz|sk)\b/i;
/** Its own account, after its label (glued or not, a name before it), with the Czech bank code 6210. */
const OWN_ACCOUNT =
  /(?:[čc][íi]slo\s*[úu][čc]tu(?!\s*protistrany)|\bIBAN)\s*:?[^\n]*?(?:\/\s?6210\b|\bCZ\d{2}\s?6210)/iu;
/** The Slovak branch's list of operations, "Zoznamoperácií" glued too. */
const SLOVAK_LIST = /\bZoznam\s*operácií(?!\p{L})/iu;

/**
 * An mBank statement's header (the lines above its first row) names the bank
 * and prints its own account with the Czech bank code 6210, or is the Slovak
 * branch's list of operations; a row naming mBank or paying an mBank account
 * does not.
 */
export function isMbankStatement(text: string): boolean {
  const head = headerLines(text);
  return MBANK.test(head) && (OWN_ACCOUNT.test(head) || SLOVAK_LIST.test(head));
}

/** Words mBank glues together, longest first (zumfi's list). */
const GLUED: [string, string][] = [
  ['PŘEDDEF.ODCHOZÍOKAMŽITÁPLATBA', 'Předdef. odchozí okamžitá platba'],
  ['ODCHOZÍPLATBADOJINÉBANKY', 'Odchozí platba do jiné banky'],
  ['STORNOPŘIPSÁNÍVEPROSPĚCH', 'Storno připsání ve prospěch'],
  ['OPRAVADANĚZPŘIPSÁNÍÚROKU', 'Oprava daně z připsání úroku'],
  ['PŘÍCHOZÍOKAMŽITÁPLATBA', 'Příchozí okamžitá platba'],
  ['ODCHOZÍOKAMŽITÁPLATBA', 'Odchozí okamžitá platba'],
  ['OPRAVAKLADNÝCHÚROKŮ', 'Oprava kladných úroků'],
  ['BEZHOTOVOSTNÍPLATBA', 'Bezhotovostní platba'],
  ['DAŇZPŘIPSÁNÍÚROKU', 'Daň z připsání úroku'],
  ['DAŇZPŘIPSANÍÚROKU', 'Daň z připsání úroku'],
  ['PŘÍCHOZÍPLATBAZMBANK', 'Příchozí platba z mBank'],
  ['PŘEVODNAMSPOŘENÍ', 'Převod na mSpoření'],
  ['PŘIPSÁNÍÚROKŮ', 'Připsání úroků'],
  ['PŘÍCHOZÍÚHRADA', 'Příchozí úhrada'],
  ['ODCHOZÍÚHRADA', 'Odchozí úhrada'],
  ['PŘÍCHOZÍPLATBA', 'Příchozí platba'],
  ['VÝBĚRZBANKOMATU', 'Výběr z bankomatu'],
  ['PLATBAQRKÓDEM', 'Platba QR kódem'],
  ['PŘEVODZCÍLE', 'Převod z cíle'],
  ['PŘEVODNACÍL', 'Převod na cíl'],
  ['ODCHOZÍPLATBA', 'Odchozí platba'],
  ['INKASNÍPLATBA', 'Inkasní platba'],
  ['PLATBAKARTOU', 'Platba kartou'],
  ['TRVALÝPŘÍKAZ', 'Trvalý příkaz'],
  ['ZRUŠENÍCÍLE', 'Zrušení cíle'],
  ['VKLADNACÍL', 'Vklad na cíl'],
  // The Slovak branch's.
  ['ODCH.OKAMŽITÁPLATBA', 'Odch. okamžitá platba'],
  ['PRIJATÁPLATBAMEDZIBANKOVÁ', 'Prijatá platba medzibanková'],
  ['VÝBERZINÉHOBANKOMATUVSR', 'Výber z iného bankomatu v SR'],
  ['INKASO', 'Inkaso'],
];

const EXECUTED = /\s*DATUM\s*PROVEDENÍ\s*TRANSAKCE\s*:\s*\d{4}-\d{2}-\d{2}\s*/giu;
/** An account: "19-2000145399/0800", "2200000001/6210", an IBAN, a masked "SK31...6353". */
const ACCOUNT = /(?:\d{1,6}-)?\d{5,10}\s?\/\s?\d{4}\b|\b(?:CZ|SK)\d{2}(?:\.{3}\d{4}|\d{20})\b/g;
/** "NájemACME": two lower-case letters right before capitals end a word ("McDONALDS", "eSHOP" stay). */
const GLUED_CASE = /(\p{Ll}{2})(\p{Lu}{2,})/gu;

/** One description line with mBank's glue undone. */
export function mbankLine(line: string): string {
  let text = line.replace(EXECUTED, ' ');
  for (const [glued, words] of GLUED) {
    const at = text.toUpperCase().indexOf(glued);
    if (at !== -1) {
      text = `${text.slice(0, at)}${words}${text.slice(at + glued.length)}`;
    }
  }
  return text
    .replace(ACCOUNT, ' ')
    .replace(GLUED_CASE, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:,]+|[\s:,]+$/g, '');
}

/** The day the transaction was made: the second date on the row's first line. */
function madeOn(first: PdfTextRow | undefined) {
  if (!first) {
    return null;
  }
  const words = [...first.items].sort((a, b) => a.x - b.x).slice(leadingDateWords(first));
  const text = words[0]?.text ?? '';
  const parts = parseDateParts(text, 'dmy');
  return parts?.year ? { parts, text } : null;
}

export class MbankParser extends BankPdfParser {
  protected readonly bank = BankName.MBANK;

  protected recognises(text: string): boolean {
    return isMbankStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const read = super.readTransactions(rows);
    const blocks = rowBlocks(rows, read);
    return read.map((transaction, index) => {
      const block = transaction.description
        ? rowLines(blocks[index], transaction)
        : { lines: [], rows: blocks[index].slice(0, 1) };
      const { lines } = block;
      // The day it was made may wrap past its label: strip it from the lines together.
      const cleaned = lines
        .join('\n')
        .replace(EXECUTED, '\n')
        .split('\n')
        .map(mbankLine)
        .filter(Boolean);
      const made = madeOn(blocks[index][0]);
      // The account may sit in the description or a column of its own (the Slovak "Účet").
      const account = findCzechAccount(block.rows.map(line => line.text).join(' '));
      return {
        ...transaction,
        ...(made && { date: made.parts, dateText: made.text }),
        counterparty: cleaned[1] ?? cleaned[0] ?? transaction.counterparty,
        description: cleaned.join(' '),
        ...(account && { counterpartyAccount: account }),
      };
    });
  }
}

/** Words of one cell sit closer than this, in points; the next column further. */
const CELL_WORD_GAP = 8;

/**
 * The row's own lines (up to a line with money of its own under it) and its
 * description as lines: on each, the words from the description's left edge
 * up to the next column (a category beside it is no part of it).
 */
function rowLines(
  block: PdfTextRow[],
  transaction: LayoutTransaction,
): { lines: string[]; rows: PdfTextRow[] } {
  const [firstWord] = transaction.description.split(/\s+/);
  const firstLine = block[0];
  const start = firstLine?.items.find(item => item.text === firstWord)?.x;
  if (start === undefined) {
    return { lines: [transaction.description], rows: block.slice(0, 1) };
  }
  const lines: string[] = [];
  const rows: PdfTextRow[] = [];
  for (const [index, line] of block.entries()) {
    const words = [...line.items].sort((a, b) => a.x - b.x);
    const from = words.findIndex(item => Math.abs(item.x - start) <= 3);
    const cell = from === -1 ? [] : [words[from]];
    for (const word of from === -1 ? [] : words.slice(from + 1)) {
      const last = cell[cell.length - 1];
      if (word.x - (last.x + last.width) > CELL_WORD_GAP) {
        break;
      }
      cell.push(word);
    }
    // A line under the row with money of its own is no part of it ("Konečný zůstatek … 29 764,59").
    const money = words.some(
      word => !cell.includes(word) && word.x > start && MONEY.test(word.text),
    );
    if (index > 0 && money) {
      break;
    }
    rows.push(line);
    if (cell.length > 0) {
      lines.push(cell.map(word => word.text).join(' '));
    }
  }
  return { lines, rows };
}

/** A figure with its two decimals, a currency code glued on or not. */
const MONEY = /^-?\d[\d .]*,\d{2}(?:[A-Z]{3})?$/;

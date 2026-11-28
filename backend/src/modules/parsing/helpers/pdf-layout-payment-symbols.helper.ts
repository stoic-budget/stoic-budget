import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { rowBlocks } from './pdf-layout-blocks.helper';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import { foldText } from './statement-date.helper';

/**
 * Czech and Slovak tables print a payment's symbols in columns of their own,
 * headed "VS", "KS" and "SS" on the header's second line (ČSOB, Česká
 * spořitelna). Their figures sit under the counterparty's heading as often as
 * not, so read as text they end up in the payee's name. The variable symbol
 * is the payment's reference.
 */

type Symbol = 'vs' | 'ks' | 'ss';

/** A figure sits under its heading when its left edge is this close to the heading's, in points. */
const UNDER_HEADING = 6;
const SYMBOL_FIGURE = /^\d{1,10}$/;

/**
 * Where the symbol headings start, from the first line that prints two of
 * them or more and no figure: "27500000012 VS: 555 KS: 0308" is a row's line.
 */
function symbolColumns(rows: PdfTextRow[]): Map<Symbol, number> | null {
  for (const row of rows) {
    if (row.items.some(item => /\d/.test(item.text))) {
      continue;
    }
    const found = new Map<Symbol, number>();
    for (const item of row.items) {
      const word = foldText(item.text).replace(/[:.]$/, '');
      if ((word === 'vs' || word === 'ks' || word === 'ss') && !found.has(word)) {
        found.set(word, item.x);
      }
    }
    if (found.size >= 2) {
      return found;
    }
  }
  return null;
}

/**
 * The text without the given words appended at its end ("ACME s.r.o. 2026030
 * 0308"): taken off its end only, so a figure of the name itself ("Byty 1001
 * s.r.o.") stays.
 */
export function withoutTrailingWords(text: string, words: string[]): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  const left = [...words];
  while (tokens.length > 0 && left.includes(tokens[tokens.length - 1])) {
    left.splice(left.indexOf(tokens.pop() as string), 1);
  }
  return tokens.join(' ');
}

/**
 * Each row with the figures under the symbol headings taken out of its text,
 * the variable symbol as its reference. Rows of a table without the headings
 * come back as they are.
 */
export function withPaymentSymbols(
  rows: PdfTextRow[],
  read: LayoutTransaction[],
): LayoutTransaction[] {
  const columns = symbolColumns(rows);
  if (!columns) {
    return read;
  }
  const blocks = rowBlocks(rows, read);
  return read.map((transaction, index) => {
    const symbols = new Map<Symbol, string>();
    // The row's first line holds the bank's own id under the same headings, not the symbols.
    for (const line of blocks[index].slice(1)) {
      for (const item of line.items) {
        const symbol = [...columns].find(([, x]) => Math.abs(item.x - x) <= UNDER_HEADING)?.[0];
        if (symbol && SYMBOL_FIGURE.test(item.text) && !symbols.has(symbol)) {
          symbols.set(symbol, item.text);
        }
      }
    }
    if (symbols.size === 0) {
      return transaction;
    }
    const figures = [...symbols.values()];
    const vs = symbols.get('vs');
    return {
      ...transaction,
      counterparty: withoutTrailingWords(transaction.counterparty, figures),
      description: withoutTrailingWords(transaction.description, figures),
      ...(vs && { documentNumber: vs }),
    };
  });
}

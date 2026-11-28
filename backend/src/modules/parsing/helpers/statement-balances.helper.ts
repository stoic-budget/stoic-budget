import {
  amountsWithoutDates,
  balanceLineEnd,
  figureUnderLabel,
} from './statement-balance-line.helper';
import { findFullDates, foldText, type NumericDateOrder } from './statement-date.helper';

/**
 * Balance and total labels of a statement, and the figures printed after them,
 * in English, French, Dutch, German, Spanish, Czech and Slovak.
 */

const OPENING = [
  'opening balance',
  'balance brought forward',
  'previous balance',
  'former balance',
  'balance - previous statement',
  'beginning balance',
  "solde d'ouverture",
  'solde precedent',
  'ancien solde',
  'beginsaldo',
  'saldo inicial',
  'sold initial',
  'saldo iniziale',
  'saldo anterior',
  'anfangssaldo',
  'alter kontostand',
  'pocatecni zustatek',
  'stary zostatok',
  'pociatocny zostatok',
];
const CLOSING = [
  'closing balance',
  'balance carried forward',
  'new balance',
  'ending balance',
  'solde de fermeture',
  'nouveau solde',
  'eindsaldo',
  'saldo final',
  'sold final',
  'saldo finale',
  'endsaldo',
  'neuer kontostand',
  'konecny zustatek',
  'novy zostatok',
  'konecny zostatok',
];
/** Words that alone, as a row's whole text, state a balance ("SALDO", "Balance"). */
const BALANCE_WORDS = ['balance', 'saldo', 'solde', 'balance forward', 'saldo atual'];

/**
 * The period between the dated balance rows, for a statement that prints no
 * period: "2020/09/30 Balance Brought Forward" opens it and "2020/10/31
 * Balance Carried Forward" closes it, even in a month without movements.
 */
export function findBalanceRowPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const line of text.split('\n')) {
    const [found] = findFullDates(line, order);
    const folded = foldText(line);
    if (found && !from && OPENING.some(label => folded.includes(label))) {
      from = found.date;
    }
    if (found && CLOSING.some(label => folded.includes(label))) {
      to = found.date;
    }
  }
  return from && to && from <= to ? { from, to } : null;
}

/**
 * A row that states the balance instead of moving money: "Saldo Anterior
 * 35,65 (+)", "Opening Balance", a bare "SALDO", or one printed letter-spaced
 * ("S A L D O"). A label of one word must be the whole text: "Balance
 * transfer fee" moves money.
 */
export function isBalanceLabel(description: string): boolean {
  const folded = foldText(description)
    .replace(/[\s:.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const labels = [...OPENING, ...CLOSING];
  const spaced = /^(?:\S )+\S$/.test(folded) ? folded.replace(/ /g, '') : null;
  return (
    BALANCE_WORDS.includes(folded) ||
    labels.some(label => folded === label || folded.startsWith(`${label} `)) ||
    (spaced !== null &&
      [...BALANCE_WORDS, ...labels].some(label => label.replace(/ /g, '') === spaced))
  );
}

const DATED_BALANCE = /\b(?:balance|solde|saldo)\s+(?:as\s+(?:of|at)|on|au|per|op|al)\b/g;

/**
 * The last amount after a label, up to the end of its line (or of the dated
 * line under a label that stands alone, see `balanceLineEnd`): "Balance Carried
 * Forward: 2,181.67 2,002.15 15,271.23" ends with the balance. Dates on the
 * line are skipped. A dated balance takes the first: the figure right after
 * its date, whatever a box beside it prints on the same line ("Balance on 20
 * Jun 2025 £22,689.13   Debit card fee 8 £2.80").
 */
function amountAfter(
  text: string,
  folded: string,
  index: number,
  order: NumericDateOrder,
  pick: 'first' | 'last' = 'last',
  labelStart?: number,
) {
  const line = text.slice(index, balanceLineEnd(folded, index, [...OPENING, ...CLOSING]));
  let withoutDates = line;
  for (const found of findFullDates(line, order).reverse()) {
    withoutDates = `${withoutDates.slice(0, found.index)} ${withoutDates.slice(found.index + found.length)}`;
  }
  const amounts = amountsWithoutDates(withoutDates);
  return (
    (pick === 'first' ? amounts[0] : amounts[amounts.length - 1]) ??
    (labelStart === undefined
      ? null
      : figureUnderLabel(text, folded, { start: labelStart, end: index }))
  );
}

function labelledAmount(text: string, folded: string, labels: string[], order: NumericDateOrder) {
  for (const label of labels) {
    for (let at = folded.indexOf(label); at !== -1; at = folded.indexOf(label, at + 1)) {
      const value = amountAfter(text, folded, at + label.length, order, 'last', at);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Opening and closing balance from their labels, or from two "balance as of
 * <date>" lines (the earlier date opens).
 */
export function findStatementBalances(
  text: string,
  order: NumericDateOrder,
): { start: number | null; end: number | null } {
  const folded = foldText(text).replace(/’/g, "'");
  const start = labelledAmount(text, folded, OPENING, order);
  const end = labelledAmount(text, folded, CLOSING, order);
  if (start !== null || end !== null) {
    return { start, end };
  }

  const dated = Array.from(folded.matchAll(DATED_BALANCE), match => {
    const after = (match.index ?? 0) + match[0].length;
    const lineEnd = folded.indexOf('\n', after);
    const line = text.slice(after, lineEnd === -1 ? undefined : lineEnd);
    const [date] = findFullDates(line, order);
    return { date: date?.date, amount: amountAfter(text, folded, after, order, 'first') };
  }).filter(
    (entry): entry is { date: Date; amount: number } => !!entry.date && entry.amount !== null,
  );
  if (dated.length < 2) {
    return { start: null, end: null };
  }
  dated.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { start: dated[0].amount, end: dated[dated.length - 1].amount };
}

/** Labels of the printed sums of a statement's credits and of its debits. */
const TOTAL_CREDITS = [
  'money in',
  'total money in',
  'total credits',
  'total deposits',
  'deposits and other additions',
  'total paid in',
  'soucet prijmu',
  'suma prijmov',
  'prijmy celkem',
  'kreditni polozky',
  'kreditnipolozky',
];
const TOTAL_DEBITS = [
  'money out',
  'total money out',
  'total debits',
  'total withdrawals',
  'withdrawals and other subtractions',
  'total paid out',
  'soucet vydaju',
  'suma vydavkov',
  'vydaje celkem',
  'debetni polozky',
  'debetnipolozky',
];

/** Words that open a line of sums, not of a movement. */
const TOTAL_WORDS = ['total', 'totals', 'subtotal', 'sub total', 'summe', 'gesamt', 'итого'];

/**
 * A line that sums the rows above it ("Total 1,035.33", "TRANSACTION TOTAL",
 * "Money out 611.96"), not one more row: one of the labels as whole words.
 */
export function isTotalsLabel(description: string): boolean {
  const folded = ` ${foldText(description)
    .replace(/[\s:]+/g, ' ')
    .trim()} `;
  return [...TOTAL_WORDS, ...TOTAL_CREDITS, ...TOTAL_DEBITS].some(label =>
    folded.includes(` ${label} `),
  );
}

/**
 * The statement's printed sums of money in and money out ("Money in
 * £11,450.43", "Total withdrawals 2,040.00"): the first figure after the
 * label, as a box printed beside it can end the same line. Null for a side
 * the statement does not total.
 */
/** Totals labels that print how many items before their sum. */
const COUNTED = /polozky$/;

export function findStatementTotals(
  text: string,
  order: NumericDateOrder,
): { credits: number | null; debits: number | null } {
  const folded = foldText(text);
  const total = (labels: string[]) => {
    for (const label of labels) {
      // "Total Withdrawals & Other Debits" totals one section, not the statement.
      const pattern = new RegExp(`(?:^|[^a-z])${label}(?![a-z]|\\s*(?:&|and)\\s+[a-z])`, 'g');
      for (const match of folded.matchAll(pattern)) {
        const end = (match.index ?? 0) + match[0].length;
        // "Debetní položky 3 245,90 CZK": a count of items comes before their sum (mBank).
        const count = COUNTED.test(label)
          ? (folded.slice(end).match(/^\s*\d+\s+(?=\d)/)?.[0] ?? '')
          : '';
        const value = amountAfter(text, folded, end + count.length, order, 'first');
        if (value !== null) {
          return Math.abs(value);
        }
      }
    }
    return null;
  };
  return { credits: total(TOTAL_CREDITS), debits: total(TOTAL_DEBITS) };
}

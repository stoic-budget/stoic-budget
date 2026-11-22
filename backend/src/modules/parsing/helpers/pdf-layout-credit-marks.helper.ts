import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { LayoutTransaction } from './pdf-layout-table.helper';
import { parseStatementAmount } from './statement-amount.helper';

/** A figure and the side written after it, glued on or not: "2,500.00 Cr", "3,193.31Cr". */
const MARKED_FIGURE = /(?<![\d*.,])(\d{1,3}(?:[, ]\d{3})+[.,]\d{2}|\d+[.,]\d{2})\s?(Cr|Dr)?\b/gi;

type Mark = 'cr' | 'dr' | null;

/** The figures of a printed line, each with its side when it has one. */
function figures(row: PdfTextRow): { value: number; mark: Mark }[] {
  return Array.from(row.text.matchAll(MARKED_FIGURE), match => ({
    value: Math.abs(parseStatementAmount(match[1].replace(/ /g, '')) ?? Number.NaN),
    mark: (match[2]?.toLowerCase() as Mark) ?? null,
  }));
}

const markOf = (
  found: { value: number; mark: Mark }[],
  value: number | undefined,
): Mark | undefined =>
  value === undefined ? undefined : found.find(figure => figure.value === Math.abs(value))?.mark;

/**
 * Statements that write "Cr" after money in and nothing after money out
 * (South African banks: "206.69", "2,500.00 Cr"; balances "3,193.31 Cr" and,
 * overdrawn, "51.14"). When a column marks some figures "Cr" and none "Dr",
 * an unmarked figure of it is a debit. A statement that marks both sides, or
 * neither, is left as read.
 */
export function withCreditMarks(
  rows: PdfTextRow[],
  transactions: LayoutTransaction[],
): LayoutTransaction[] {
  const lineOf = (row: LayoutTransaction) =>
    rows.find(line => row.at && line.page === row.at.page && line.y === row.at.y);
  const marks = transactions.map(row => {
    const line = lineOf(row);
    const found = line ? figures(line) : [];
    return { amount: markOf(found, row.amount), balance: markOf(found, row.balance) };
  });
  const creditOnly = (side: 'amount' | 'balance') =>
    marks.some(mark => mark[side] === 'cr') && !marks.some(mark => mark[side] === 'dr');
  const [amounts, balances] = [creditOnly('amount'), creditOnly('balance')];
  if (!(amounts || balances)) {
    return transactions;
  }
  const signed = (value: number | undefined, mark: Mark | undefined) =>
    value === undefined || mark === undefined
      ? value
      : mark === 'cr'
        ? Math.abs(value)
        : -Math.abs(value);
  return transactions.map((row, index) => ({
    ...row,
    ...(amounts && row.amount !== undefined && { amount: signed(row.amount, marks[index].amount) }),
    ...(balances &&
      row.balance !== undefined && { balance: signed(row.balance, marks[index].balance) }),
  }));
}

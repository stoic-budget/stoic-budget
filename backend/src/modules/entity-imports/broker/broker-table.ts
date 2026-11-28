import type { PnlSection } from './revolut-pnl';
import type { BrokerPeriod, BrokerRow, BrokerSection } from './revolut-trading';

/** The import wizard's columns for broker trades, in the words its mapping knows. */
export const TRADE_COLUMNS = [
  'Date',
  'Kind',
  'Symbol',
  'Name',
  'Asset class',
  'Quantity',
  'Price',
  'Fee',
  'Amount',
  'Currency',
  'Ratio',
  'Note',
] as const;

type Cells = Partial<Record<(typeof TRADE_COLUMNS)[number], string | number | null>>;
const line = (cells: Cells): string[] =>
  TRADE_COLUMNS.map(column => {
    const value = cells[column];
    return value === null || value === undefined ? '' : String(value);
  });

/** What the file says that its rows do not: a check the wizard shows before the import. */
export type BrokerCheck =
  | { code: 'cash_mismatch'; currency: string; expected: number; actual: number }
  | {
      code: 'holding_mismatch';
      currency: string;
      symbol: string;
      expected: number;
      actual: number;
    };

const round = (value: number) => Math.round(value * 1e8) / 1e8;
const money = (value: number) => Math.round(value * 100) / 100;

/** An ETF by its name or a fund's ISIN country (Ireland, Luxembourg). */
function assetClassOf(name: string, isin: string): 'etf' | 'stock' {
  return /\bETF\b|\bishares\b/i.test(name) || /^(?:IE|LU)/.test(isin) ? 'etf' : 'stock';
}

/** The cash a row moves, signed, with what it was for. */
function cashMove(row: BrokerRow): { amount: number; note: string } | null {
  const value = row.value ?? 0;
  switch (row.kind) {
    case 'buy':
      return { amount: -(value + row.fee), note: `Buy ${row.symbol}` };
    case 'sell':
      return { amount: value - row.fee, note: `Sell ${row.symbol}` };
    case 'dividend':
      return { amount: value, note: `Dividend ${row.symbol}` };
    case 'cash_in':
      return { amount: value, note: 'Top-up' };
    case 'cash_out':
      return { amount: -value, note: 'Withdrawal' };
    case 'fee':
      return { amount: -value, note: 'Custody fee' };
    default:
      return null;
  }
}

/**
 * A split's ratio, new units for old, from the quantity held at the end: the
 * units it added over those held before it ("2:1"). Null when the statement
 * does not tell them.
 */
function splitRatio(section: BrokerSection, split: BrokerRow): string | null {
  const end = section.holdings.find(holding => holding.symbol === split.symbol)?.quantity;
  if (end === undefined || !split.quantity) {
    return null;
  }
  const later = section.rows
    .filter(row => row.symbol === split.symbol && row.date > split.date)
    .reduce(
      (sum, row) =>
        sum + (row.kind === 'buy' ? 1 : row.kind === 'sell' ? -1 : 0) * (row.quantity ?? 0),
      0,
    );
  const before = end - later - split.quantity;
  if (before <= 0) {
    return null;
  }
  const factor = (before + split.quantity) / before;
  return Number.isInteger(round(factor))
    ? `${round(factor)}:1`
    : `${round(before + split.quantity)}:${round(before)}`;
}

/**
 * The account statement as the wizard's table: each section's trades and
 * splits, and its cash as a holding of its own ("USD cash"): the statement's
 * opening cash as a balance, then every top-up, withdrawal, buy, sale,
 * dividend and fee moving it. Dividends are income in the profit and loss
 * statement, which reads them gross with the tax withheld; here they move
 * cash only.
 */
export function tradingTable(
  sections: BrokerSection[],
  period: BrokerPeriod | null,
): { rows: string[][]; checks: BrokerCheck[] } {
  const rows: string[][] = [[...TRADE_COLUMNS]];
  const checks: BrokerCheck[] = [];
  for (const section of sections) {
    const { currency } = section;
    const cashName = `${currency} cash`;
    const held = new Map(section.holdings.map(holding => [holding.symbol, holding]));
    const security = (symbol: string) => {
      const holding = held.get(symbol);
      return {
        Symbol: symbol,
        Name: holding?.name ?? null,
        'Asset class': holding ? assetClassOf(holding.name, holding.isin) : null,
      };
    };
    const cash = (date: string, kind: string, quantity: number, note: string) =>
      line({
        Date: date,
        Kind: kind,
        Name: cashName,
        'Asset class': 'cash',
        Quantity: money(quantity),
        Price: 1,
        Currency: currency,
        Note: note,
      });
    // Without a printed period the opening cash is that of the first row's day.
    const opening = period?.from ?? [...section.rows].map(row => row.date).sort()[0];
    if (section.cash.start !== null && opening) {
      rows.push(cash(opening, 'balance', section.cash.start, 'Opening cash'));
    }
    let cashTotal = section.cash.start ?? 0;
    const units = new Map<string, number>();
    // Oldest first, whatever order the statement prints them in; one day's rows as printed.
    for (const row of [...section.rows].sort((a, b) => a.date.localeCompare(b.date))) {
      if (row.kind === 'buy' || row.kind === 'sell') {
        rows.push(
          line({
            Date: row.date,
            Kind: row.kind,
            ...security(row.symbol),
            Quantity: row.quantity,
            Price: row.price,
            Fee: row.fee || null,
            Amount: row.value,
            Currency: currency,
          }),
        );
        units.set(
          row.symbol,
          (units.get(row.symbol) ?? 0) + (row.kind === 'buy' ? 1 : -1) * (row.quantity ?? 0),
        );
      }
      if (row.kind === 'split') {
        rows.push(
          line({
            Date: row.date,
            Kind: 'split',
            ...security(row.symbol),
            Ratio: splitRatio(section, row),
            Currency: currency,
          }),
        );
        units.set(row.symbol, (units.get(row.symbol) ?? 0) + (row.quantity ?? 0));
      }
      const move = cashMove(row);
      if (move && move.amount !== 0) {
        rows.push(
          cash(
            row.date,
            move.amount > 0 ? 'transfer_in' : 'transfer_out',
            Math.abs(move.amount),
            move.note,
          ),
        );
        cashTotal += move.amount;
      }
    }
    if (
      section.cash.start !== null &&
      section.cash.end !== null &&
      Math.abs(money(cashTotal) - section.cash.end) > 0.005
    ) {
      checks.push({
        code: 'cash_mismatch',
        currency,
        expected: section.cash.end,
        actual: money(cashTotal),
      });
    }
    // Units held before the statement are none of its rows: the import cannot know their cost.
    for (const holding of section.holdings) {
      const read = round(units.get(holding.symbol) ?? 0);
      if (Math.abs(read - holding.quantity) > 1e-6) {
        checks.push({
          code: 'holding_mismatch',
          currency,
          symbol: holding.symbol,
          expected: holding.quantity,
          actual: read,
        });
      }
    }
  }
  return { rows, checks };
}

/** The profit and loss statement's dividends as the wizard's table: gross, the tax withheld as their fee. */
export function pnlTable(sections: PnlSection[]): { rows: string[][]; checks: BrokerCheck[] } {
  const rows: string[][] = [[...TRADE_COLUMNS]];
  for (const section of sections) {
    for (const dividend of section.dividends) {
      rows.push(
        line({
          Date: dividend.date,
          Kind: 'dividend',
          Symbol: dividend.symbol,
          Name: dividend.name,
          'Asset class': assetClassOf(dividend.name, dividend.isin),
          Fee: dividend.tax || null,
          Amount: dividend.gross,
          Currency: section.currency,
          Note: dividend.tax ? `Withholding tax ${dividend.tax}` : null,
        }),
      );
    }
  }
  return { rows, checks: [] };
}

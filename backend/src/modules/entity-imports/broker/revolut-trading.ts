// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.

/**
 * Revolut Securities' account statement, as its text reads: per currency an
 * "Account summary" (stocks and cash value, starting and ending), a
 * "Portfolio breakdown" (symbol, company, ISIN, quantity, price, value) and
 * "Transactions" ("05 Jan 2026 14:30:38 GMT ACMX Trade - Market 2 US$110.00
 * Buy US$220 US$0.25 US$0", "03 Jan 2026 09:15:02 GMT Cash top-up US$500").
 */

export type BrokerRowKind = 'buy' | 'sell' | 'split' | 'dividend' | 'cash_in' | 'cash_out' | 'fee';

export interface BrokerRow {
  /** ISO date, "2026-01-05". */
  date: string;
  kind: BrokerRowKind;
  symbol: string;
  quantity: number | null;
  price: number | null;
  /** The money moved, positive. */
  value: number | null;
  fee: number;
}

export interface BrokerHolding {
  symbol: string;
  name: string;
  isin: string;
  quantity: number;
}

export interface BrokerSection {
  currency: string;
  cash: { start: number | null; end: number | null };
  holdings: BrokerHolding[];
  rows: BrokerRow[];
}

export interface BrokerPeriod {
  from: string;
  to: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "05 Jan 2026" as "2026-01-05", or null. */
export function isoDate(day: string, month: string, year: string): string | null {
  const index = MONTHS.indexOf(month.toLowerCase().slice(0, 3));
  return index === -1
    ? null
    : `${year}-${String(index + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** "01 Jan 2026 - 31 Jan 2026". */
const PERIOD = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*-\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/;

export function brokerPeriod(text: string): BrokerPeriod | null {
  const match = text.match(PERIOD);
  const from = match && isoDate(match[1], match[2], match[3]);
  const to = match && isoDate(match[4], match[5], match[6]);
  return from && to ? { from, to } : null;
}

/** "US$1,230.00", "-US$145", "€8.16": signed figures in the order printed. */
const MONEY = /(-?)(?:US\$|€|£|\$)(\d[\d,]*(?:\.\d+)?)/g;
export const moneyIn = (text: string): number[] =>
  [...text.matchAll(MONEY)].map(match => (match[1] ? -1 : 1) * Number(match[2].replace(/,/g, '')));

const SECTION = /^(USD|EUR|GBP)\s+(Account summary|Portfolio breakdown|Transactions)\b/i;
/** "ACMX ACME Corp US0000000011 8 US$120.00 US$960.00 78.05%". */
const HOLDING = /^(\S+)\s+(.+?)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+(\d+(?:\.\d+)?)\s+\S+\s+\S+\s+[\d.]+%$/;
const ROW = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+\d{2}:\d{2}:\d{2}\s+GMT\s*(.*)$/;
const TYPES: [RegExp, BrokerRowKind | 'trade'][] = [
  [/Trade - (?:Market|Limit|Stop)/, 'trade'],
  [/Stock split/, 'split'],
  [/Cash top-up/, 'cash_in'],
  [/Cash withdrawal/, 'cash_out'],
  [/Dividend/, 'dividend'],
  [/Custody fee/, 'fee'],
];

/** One transaction line, or null when it is none Revolut prints. */
export function brokerRow(line: string): BrokerRow | null {
  const match = line.match(ROW);
  const date = match && isoDate(match[1], match[2], match[3]);
  if (!(match && date)) {
    return null;
  }
  for (const [type, kind] of TYPES) {
    const found = match[4].match(type);
    if (!found) {
      continue;
    }
    const symbol = match[4].slice(0, found.index).trim();
    const rest = match[4].slice((found.index ?? 0) + found[0].length).trim();
    const quantity = rest.match(/^(-?\d+(?:\.\d+)?)(?![\d,]*\.?\d*%)/);
    const figures = moneyIn(rest);
    if (kind === 'trade') {
      const [price, value, fee = 0, commission = 0] = figures.map(Math.abs);
      // A trade naming no security is no row we can book: its cash shows up in the cash check.
      if (!(quantity && symbol) || value === undefined) {
        return null;
      }
      return {
        date,
        kind: /\bSell/.test(rest) ? 'sell' : 'buy',
        symbol,
        quantity: Math.abs(Number(quantity[1])),
        price: price ?? null,
        value,
        fee: Math.round((fee + commission) * 1e6) / 1e6,
      };
    }
    if (kind === 'split') {
      return quantity
        ? { date, kind, symbol, quantity: Number(quantity[1]), price: null, value: null, fee: 0 }
        : null;
    }
    const value = figures[0];
    return value === undefined
      ? null
      : { date, kind, symbol, quantity: null, price: null, value: Math.abs(value), fee: 0 };
  }
  return null;
}

/** The statement's sections, each currency's summary, holdings and rows. */
export function readRevolutTrading(text: string): BrokerSection[] {
  const sections = new Map<string, BrokerSection>();
  let current: BrokerSection | undefined;
  let part = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = line.match(SECTION);
    if (heading) {
      const currency = heading[1].toUpperCase();
      current = sections.get(currency) ?? {
        currency,
        cash: { start: null, end: null },
        holdings: [],
        rows: [],
      };
      sections.set(currency, current);
      part = heading[2].toLowerCase();
      continue;
    }
    if (!current) {
      continue;
    }
    if (part === 'account summary' && /^Cash value\b/i.test(line)) {
      const [start, end] = moneyIn(line);
      current.cash = {
        start: end === undefined ? null : (start ?? null),
        end: end ?? start ?? null,
      };
    }
    const holding = part === 'portfolio breakdown' ? line.match(HOLDING) : null;
    if (holding) {
      current.holdings.push({
        symbol: holding[1],
        name: holding[2],
        isin: holding[3],
        quantity: Number(holding[4]),
      });
    }
    const row = part === 'transactions' ? brokerRow(line) : null;
    if (row) {
      current.rows.push(row);
    }
  }
  return [...sections.values()];
}

/** Revolut Securities' account statement: its sections, not Revolut's bank statement. */
export function isRevolutTrading(text: string): boolean {
  return /\bRevolut\b/i.test(text) && /\b(?:USD|EUR|GBP)\s+Portfolio breakdown\b/i.test(text);
}

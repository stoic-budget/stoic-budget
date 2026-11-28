// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import { moneyIn } from './revolut-trading';

/**
 * Revolut's profit and loss statement, as its text reads: per currency
 * ("USD Profit and Loss Statement") the sells ("2025-12-08 2026-01-20 ACMX
 * ACME Corp US0000000011 US 1 US$110.00 US$125.00 US$15.00 US$0.00": bought,
 * sold, symbol, name, ISIN, country, quantity, cost, proceeds, gain, fees) and
 * the other income ("2026-01-15 ACMX ACME Corp dividend US0000000011 US
 * US$10.59 US$1.59 US$9.00": gross, tax withheld, net).
 */

export interface PnlDividend {
  date: string;
  symbol: string;
  name: string;
  isin: string;
  gross: number;
  tax: number;
  net: number;
}

export interface PnlSell {
  acquired: string;
  sold: string;
  symbol: string;
  name: string;
  isin: string;
  quantity: number;
  cost: number;
  proceeds: number;
  fee: number;
}

export interface PnlSection {
  currency: string;
  dividends: PnlDividend[];
  sells: PnlSell[];
}

const SECTION = /^(USD|EUR|GBP)\s+Profit and Loss Statement\b/i;
const ISIN = /\s([A-Z]{2}[A-Z0-9]{9}\d)\s+[A-Z]{2}\s+/;
const SELL = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(\S+)\s+(.+)$/;
const OTHER = /^(\d{4}-\d{2}-\d{2})\s+(\S+)\s+(.+)$/;

/** "ACME Corp US0000000011 US 1 …": the name, ISIN and what follows. */
function splitAtIsin(rest: string): { name: string; isin: string; after: string } | null {
  const match = rest.match(ISIN);
  if (!match || match.index === undefined) {
    return null;
  }
  return {
    name: rest.slice(0, match.index).trim(),
    isin: match[1],
    after: rest.slice(match.index + match[0].length),
  };
}

export function readRevolutPnl(text: string): PnlSection[] {
  const sections = new Map<string, PnlSection>();
  let current: PnlSection | undefined;
  let part: 'sells' | 'other' | '' = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = line.match(SECTION);
    if (heading) {
      const currency = heading[1].toUpperCase();
      current = sections.get(currency) ?? { currency, dividends: [], sells: [] };
      sections.set(currency, current);
      part = '';
      continue;
    }
    if (/^Sells$/i.test(line)) {
      part = 'sells';
    } else if (/^Other income & fees$/i.test(line)) {
      part = 'other';
    } else if (/Summary$/i.test(line) || /^Total\b/i.test(line)) {
      part = '';
    }
    if (!current) {
      continue;
    }
    const sell = part === 'sells' ? line.match(SELL) : null;
    const sellParts = sell && splitAtIsin(` ${sell[4]}`);
    if (sell && sellParts) {
      const quantity = sellParts.after.match(/^(\d+(?:\.\d+)?)/);
      const [cost, proceeds, , fee = 0] = moneyIn(sellParts.after).map(Math.abs);
      if (quantity && cost !== undefined && proceeds !== undefined) {
        current.sells.push({
          acquired: sell[1],
          sold: sell[2],
          symbol: sell[3],
          name: sellParts.name,
          isin: sellParts.isin,
          quantity: Number(quantity[1]),
          cost,
          proceeds,
          fee,
        });
      }
    }
    const other = part === 'other' ? line.match(OTHER) : null;
    const otherParts = other && splitAtIsin(` ${other[3]}`);
    if (other && otherParts && /\bdividend$/i.test(otherParts.name)) {
      // A tax not withheld is printed "-".
      const [gross, tax = 0, net] = otherParts.after
        .trim()
        .split(/\s+/)
        .map(cell => (cell === '-' ? 0 : moneyIn(cell)[0]))
        .filter((cell): cell is number => cell !== undefined)
        .map(Math.abs);
      if (gross !== undefined) {
        current.dividends.push({
          date: other[1],
          symbol: other[2],
          name: otherParts.name.replace(/\s*dividend$/i, ''),
          isin: otherParts.isin,
          gross,
          tax,
          net: net ?? gross - tax,
        });
      }
    }
  }
  return [...sections.values()];
}

export function isRevolutPnl(text: string): boolean {
  return (
    /\bRevolut\b/i.test(text) && /^\s*(?:USD|EUR|GBP)\s+Profit and Loss Statement\b/im.test(text)
  );
}

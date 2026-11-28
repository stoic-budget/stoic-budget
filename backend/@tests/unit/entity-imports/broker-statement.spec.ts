import { pnlTable, tradingTable } from '@/modules/entity-imports/broker/broker-table';
import { isRevolutPnl, readRevolutPnl } from '@/modules/entity-imports/broker/revolut-pnl';
import {
  brokerPeriod,
  brokerRow,
  isRevolutTrading,
  readRevolutTrading,
} from '@/modules/entity-imports/broker/revolut-trading';

/** A made-up Revolut account statement's text; numbers reconcile (cash 50 → 63.75, ACMX 3 + 2 − 1, split 2:1 → 8). */
const TRADING = [
  'Account statement',
  'Revolut Securities Europe UAB',
  'Member One',
  '01 Jan 2026 - 31 Jan 2026',
  'USD Account summary',
  'Starting Ending',
  'Stocks value US$1,000.00 US$1,230.00',
  'Cash value US$50.00 US$63.75',
  'Total US$1,050.00 US$1,293.75',
  'USD Portfolio breakdown',
  'Symbol Company ISIN Quantity Price Value % of Portfolio',
  'ACMX ACME Corp US0000000011 8 US$120.00 US$960.00 78.05%',
  'ACMF ACME World Index ETF IE0000000022 3 US$90.00 US$270.00 21.95%',
  'Stocks value US$1,230.00',
  'USD Transactions',
  'Date Symbol Type Quantity Price Side Value Fees Commission',
  '03 Jan 2026 09:15:02 GMT Cash top-up US$500',
  '05 Jan 2026 14:30:38 GMT ACMX Trade - Market 2 US$110.00 Buy US$220 US$0.25 US$0',
  '12 Jan 2026 15:02:11 GMT ACMF Trade - Limit 3 US$85.00 Buy US$255 US$0 US$0',
  '15 Jan 2026 10:00:00 GMT ACMX Dividend US$9.00',
  '20 Jan 2026 16:45:09 GMT ACMX Trade - Market 1 US$125.00 Sell US$125 US$0 US$0',
  '25 Jan 2026 11:20:00 GMT ACMX Stock split 4 US$0',
  '28 Jan 2026 08:00:00 GMT Cash withdrawal -US$145',
].join('\n');

const PNL = [
  'Profit and Loss Statement',
  'Revolut Securities Europe UAB',
  '01 Jan 2026 - 31 Jan 2026',
  'USD Profit and Loss Statement',
  'Sells',
  'Date acquired Date sold Symbol Security name ISIN Country Quantity Cost basis Gross proceeds Gross PnL Fees',
  '2026-01-05 2026-01-20 ACMX ACME Corp US0000000011 US 1 US$110.00 US$125.00 US$15.00 US$0.00',
  '2,295.70 CZK 2,535.00 CZK 239.30 CZK Rate: 20.870 Rate: 20.280',
  'Other income & fees',
  'Date Description Security ISIN Country Gross amount Withholding tax Net amount',
  '2026-01-15 ACMX ACME Corp dividend US0000000011 US US$10.59 US$1.59 US$9.00',
  '2026-01-28 ACMF ACME World Index ETF dividend IE0000000022 IE US$0.60 - US$0.60',
  'Total US$11.19 US$1.59 US$9.60',
].join('\n');

describe('Revolut account statement', () => {
  it('knows its statement and the profit and loss statement apart', () => {
    expect(isRevolutTrading(TRADING)).toBe(true);
    expect(isRevolutPnl(TRADING)).toBe(false);
    expect(isRevolutPnl(PNL)).toBe(true);
    expect(isRevolutTrading(PNL)).toBe(false);
  });

  it('reads trades of every order type, cash moves, dividends and splits', () => {
    expect(brokerRow('12 Jan 2026 15:02:11 GMT ACMF Trade - Limit 3 US$85.00 Buy US$255 US$0 US$0')).toEqual({
      date: '2026-01-12',
      kind: 'buy',
      symbol: 'ACMF',
      quantity: 3,
      price: 85,
      value: 255,
      fee: 0,
    });
    // Revolut may glue the ticker to "GMT" and the side to the value.
    expect(brokerRow('20 Jan 2026 16:45:09 GMTACMX Trade - Market 1 US$125.00 SellUS$125 US$0.10 US$0.05')).toMatchObject({
      kind: 'sell',
      symbol: 'ACMX',
      value: 125,
      fee: 0.15,
    });
    expect(brokerRow('28 Jan 2026 08:00:00 GMT Cash withdrawal -US$145')).toMatchObject({ kind: 'cash_out', value: 145 });
    expect(brokerRow('25 Jan 2026 11:20:00 GMT ACMX Stock split 4 US$0')).toMatchObject({ kind: 'split', quantity: 4 });
    expect(brokerRow('Date Symbol Type Quantity')).toBeNull();
  });

  it('reads each section: cash at the start and end, holdings, rows', () => {
    const [usd] = readRevolutTrading(TRADING);
    expect(brokerPeriod(TRADING)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    expect(usd.cash).toEqual({ start: 50, end: 63.75 });
    expect(usd.holdings.map(holding => [holding.symbol, holding.quantity])).toEqual([
      ['ACMX', 8],
      ['ACMF', 3],
    ]);
    expect(usd.rows.map(row => row.kind)).toEqual(['cash_in', 'buy', 'buy', 'dividend', 'sell', 'split', 'cash_out']);
  });

  it('becomes trades, a split ratio from the holdings, and a cash holding every move changes', () => {
    const { rows, checks } = tradingTable(readRevolutTrading(TRADING), brokerPeriod(TRADING));
    const [header, ...body] = rows;
    const column = (name: string) => header.indexOf(name);
    const cash = body.filter(row => row[column('Name')] === 'USD cash');
    expect(cash.map(row => [row[column('Kind')], row[column('Quantity')], row[column('Note')]])).toEqual([
      ['balance', '50', 'Opening cash'],
      ['transfer_in', '500', 'Top-up'],
      ['transfer_out', '220.25', 'Buy ACMX'],
      ['transfer_out', '255', 'Buy ACMF'],
      ['transfer_in', '9', 'Dividend ACMX'],
      ['transfer_in', '125', 'Sell ACMX'],
      ['transfer_out', '145', 'Withdrawal'],
    ]);
    expect(body.find(row => row[column('Kind')] === 'split')?.[column('Ratio')]).toBe('2:1');
    expect(body.find(row => row[column('Symbol')] === 'ACMF')?.[column('Asset class')]).toBe('etf');
    // Its dividends are income in the profit and loss statement: here they move cash only.
    expect(body.some(row => row[column('Kind')] === 'dividend')).toBe(false);
    // The cash adds up; the three ACMX held before the statement are none of its rows.
    expect(checks).toEqual([{ code: 'holding_mismatch', currency: 'USD', symbol: 'ACMX', expected: 8, actual: 5 }]);
  });

  it('reads a statement printed newest first oldest first', () => {
    const lines = TRADING.split('\n');
    const start = lines.findIndex(line => line.startsWith('03 Jan'));
    const newestFirst = [...lines.slice(0, start), ...lines.slice(start).reverse()].join('\n');
    const { rows } = tradingTable(readRevolutTrading(newestFirst), brokerPeriod(newestFirst));
    const dates = rows.slice(1).map(row => row[0]);
    expect(dates).toEqual([...dates].sort());
  });

  it("keeps a reverse split's sign: ten old units become one", () => {
    const text = TRADING.replace('25 Jan 2026 11:20:00 GMT ACMX Stock split 4 US$0', '25 Jan 2026 11:20:00 GMT ACMX Stock split -9 US$0')
      .replace('ACMX ACME Corp US0000000011 8 US$120.00', 'ACMX ACME Corp US0000000011 1 US$120.00');
    const split = readRevolutTrading(text)[0].rows.find(row => row.kind === 'split');
    expect(split?.quantity).toBe(-9);
  });

  it('books no trade naming no security: its cash is left out and the cash check tells', () => {
    const text = TRADING.replace('GMT ACMX Trade - Market 2 US$110.00', 'GMT Trade - Market 2 US$110.00');
    const { rows, checks } = tradingTable(readRevolutTrading(text), brokerPeriod(text));
    expect(rows.some(row => row.includes('Buy '))).toBe(false);
    expect(checks.map(check => check.code)).toContain('cash_mismatch');
  });

  it('opens the cash on the first row\'s day when no period is printed', () => {
    const text = TRADING.replace('01 Jan 2026 - 31 Jan 2026\n', '');
    const [header, ...body] = tradingTable(readRevolutTrading(text), brokerPeriod(text)).rows;
    const opening = body.find(row => row[header.indexOf('Kind')] === 'balance');
    expect(opening?.[header.indexOf('Date')]).toBe('2026-01-03');
  });

  it('is a Revolut statement only when Revolut names it', () => {
    expect(isRevolutTrading(TRADING.replace('Revolut Securities Europe UAB', 'ACME Securities'))).toBe(false);
    expect(isRevolutPnl(PNL.replace('Revolut Securities Europe UAB', 'ACME Securities'))).toBe(false);
  });

  it('tells when the cash moves do not add up to the closing cash', () => {
    const missing = TRADING.replace('03 Jan 2026 09:15:02 GMT Cash top-up US$500\n', '');
    const { checks } = tradingTable(readRevolutTrading(missing), brokerPeriod(missing));
    expect(checks).toContainEqual({ code: 'cash_mismatch', currency: 'USD', expected: 63.75, actual: -436.25 });
  });
});

describe('Revolut profit and loss statement', () => {
  it('reads sells and dividends, a tax not withheld printed "-"', () => {
    const [usd] = readRevolutPnl(PNL);
    expect(usd.sells).toEqual([
      expect.objectContaining({ symbol: 'ACMX', quantity: 1, cost: 110, proceeds: 125, sold: '2026-01-20' }),
    ]);
    expect(usd.dividends).toEqual([
      expect.objectContaining({ symbol: 'ACMX', name: 'ACME Corp', gross: 10.59, tax: 1.59, net: 9 }),
      expect.objectContaining({ symbol: 'ACMF', gross: 0.6, tax: 0, net: 0.6 }),
    ]);
  });

  it('becomes dividends, gross, with the tax withheld as their fee', () => {
    const [header, ...body] = pnlTable(readRevolutPnl(PNL)).rows;
    const at = (row: string[], name: string) => row[header.indexOf(name)];
    expect(body.map(row => [at(row, 'Kind'), at(row, 'Symbol'), at(row, 'Amount'), at(row, 'Fee')])).toEqual([
      ['dividend', 'ACMX', '10.59', '1.59'],
      ['dividend', 'ACMF', '0.6', ''],
    ]);
  });
});

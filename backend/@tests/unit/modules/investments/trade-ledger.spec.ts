import { addLot, type Lot, takeFromLots } from '@/common/lots/lot-book';
import {
  countsUnits,
  orderTrades,
  replayTrades,
  splitFactorSince,
  type TradeEvent,
  TradeReplayError,
} from '@/modules/investments/trade-ledger';

let sequence = 0;
const trade = (kind: TradeEvent['kind'], date: string, fields: Partial<TradeEvent> = {}) => ({
  id: `t-${++sequence}`,
  kind,
  date,
  quantity: 0,
  price: 0,
  fee: 0,
  amount: null,
  splitFrom: null,
  splitTo: null,
  acquiredOn: null,
  ...fields,
});
const buy = (date: string, quantity: number, price: number, fee = 0) =>
  trade('buy', date, { quantity, price, fee });
const sell = (date: string, quantity: number, price: number, fee = 0) =>
  trade('sell', date, { quantity, price, fee });

describe('replayTrades', () => {
  it('sells the oldest lot first under FIFO', () => {
    const ledger = replayTrades(
      [buy('2025-01-10', 10, 100), buy('2025-03-10', 10, 200), sell('2025-06-01', 15, 250)],
      'fifo',
    );
    // 10 × 100 + 5 × 200 = 2000 against 15 × 250 = 3750.
    expect(ledger.sales[0]).toMatchObject({ cost: 2000, proceeds: 3750, gain: 1750 });
    expect(ledger.sales[0].acquiredOn).toBe('2025-01-10');
    expect(ledger.quantity).toBe(5);
    expect(ledger.costBasis).toBe(1000);
    expect(ledger.openLots).toEqual([
      expect.objectContaining({ acquiredOn: '2025-03-10', quantity: 5, unitCost: 200 }),
    ]);
  });

  it('sells at the pool average under average cost, and the rest keeps it', () => {
    const trades = [
      buy('2025-01-10', 10, 100),
      buy('2025-03-10', 10, 200),
      sell('2025-06-01', 15, 250),
    ];
    const ledger = replayTrades(trades, 'average');
    // Average 150: 15 × 150 = 2250 against 3750.
    expect(ledger.sales[0]).toMatchObject({ cost: 2250, gain: 1500 });
    expect(ledger.quantity).toBe(5);
    expect(ledger.costBasis).toBe(750);
    expect(ledger.averageCost).toBe(150);
    // The same trades under FIFO realise more: the methods really differ.
    expect(replayTrades(trades, 'fifo').realizedGain).toBe(1750);
    expect(ledger.realizedGain).toBe(1500);
  });

  it('puts a buy fee into the basis and takes a sale fee off the proceeds', () => {
    const ledger = replayTrades([buy('2025-01-10', 10, 100, 5), sell('2025-02-10', 10, 120, 7)], 'fifo');
    expect(ledger.sales[0]).toMatchObject({ cost: 1005, proceeds: 1193, fee: 7, gain: 188 });
    expect(ledger.fees).toBe(12);
  });

  it('keeps the basis of what a partial sale leaves', () => {
    const ledger = replayTrades([buy('2025-01-10', 10, 100, 10), sell('2025-02-10', 4, 150)], 'fifo');
    // Unit cost 101 with the fee: 4 sold at 101, 6 held at 101.
    expect(ledger.sales[0]).toMatchObject({ cost: 404, gain: 196 });
    expect(ledger.quantity).toBe(6);
    expect(ledger.costBasis).toBe(606);
  });

  it('splits forward: three times the shares at a third of the cost, basis unchanged', () => {
    const ledger = replayTrades(
      [buy('2025-01-10', 10, 300), trade('split', '2025-05-01', { splitFrom: 1, splitTo: 3 })],
      'fifo',
    );
    expect(ledger.quantity).toBe(30);
    expect(ledger.costBasis).toBe(3000);
    expect(ledger.openLots[0].unitCost).toBe(100);
  });

  it('splits in reverse: a tenth of the shares at ten times the cost', () => {
    const ledger = replayTrades(
      [
        buy('2025-01-10', 100, 2),
        trade('split', '2025-05-01', { splitFrom: 10, splitTo: 1 }),
        sell('2025-06-01', 5, 30),
      ],
      'fifo',
    );
    expect(ledger.sales[0]).toMatchObject({ quantity: 5, cost: 100, proceeds: 150, gain: 50 });
    expect(ledger.quantity).toBe(5);
    expect(ledger.costBasis).toBe(100);
  });

  it('applies a split before a buy on the same day, whatever order they were entered in', () => {
    const ledger = replayTrades(
      [buy('2025-05-01', 3, 100), trade('split', '2025-05-01', { splitFrom: 1, splitTo: 3 })],
      'fifo',
    );
    // The buy is already in new units: it is not tripled.
    expect(ledger.quantity).toBe(3);
  });

  it('carries the basis and acquisition date a transfer in is given', () => {
    const ledger = replayTrades(
      [
        buy('2025-01-10', 10, 100),
        trade('transfer_in', '2025-04-01', { quantity: 5, price: 40, acquiredOn: '2019-06-01' }),
        sell('2025-06-01', 5, 120),
      ],
      'fifo',
    );
    // The transferred shares are the older lot, so FIFO sells them first.
    expect(ledger.sales[0]).toMatchObject({ cost: 200, gain: 400, acquiredOn: '2019-06-01' });
    expect(ledger.sales[0].heldDays).toBeGreaterThan(2000);
    expect(ledger.costBasis).toBe(1000);
  });

  it('moves lots out on a transfer out without realising a gain', () => {
    const ledger = replayTrades(
      [buy('2025-01-10', 10, 100), trade('transfer_out', '2025-02-01', { quantity: 4, price: 500 })],
      'fifo',
    );
    expect(ledger.sales).toEqual([]);
    expect(ledger.realizedGain).toBe(0);
    expect(ledger.quantity).toBe(6);
    expect(ledger.costBasis).toBe(600);
  });

  it('refuses to sell more than is held', () => {
    const over = sell('2025-02-01', 11, 100);
    expect(() => replayTrades([buy('2025-01-10', 10, 100), over], 'fifo')).toThrow(
      TradeReplayError,
    );
    expect(() => replayTrades([buy('2025-01-10', 10, 100), over], 'average')).toThrow(
      expect.objectContaining({ tradeId: over.id }),
    );
  });

  it('drops a lot a FIFO sale empties, float leftovers and all', () => {
    // 0.1 + 0.2 is not 0.3 in floats: the second lot keeps ~3e-17 unless it is called spent.
    const ledger = replayTrades(
      [
        buy('2020-01-01', 0.1, 10),
        buy('2020-01-02', 0.2, 10),
        sell('2021-01-01', 0.3, 10),
        buy('2023-01-01', 1, 10),
        sell('2024-01-01', 1, 10),
      ],
      'fifo',
    );
    expect(ledger.openLots).toEqual([]);
    expect(ledger.sales[1]).toMatchObject({ acquiredOn: '2023-01-01', heldDays: 365 });
  });

  it('drops what a reverse split leaves of a lot once it is sold', () => {
    const ledger = replayTrades(
      [
        buy('2020-01-01', 3, 10),
        trade('split', '2020-06-01', { splitFrom: 10, splitTo: 1 }),
        sell('2020-07-01', 0.3, 100),
      ],
      'fifo',
    );
    expect(ledger.openLots).toEqual([]);
    expect(ledger.quantity).toBe(0);
  });

  it('refuses a sale dated before the buy that would cover it', () => {
    expect(() => replayTrades([sell('2025-01-01', 1, 100), buy('2025-01-10', 1, 100)], 'fifo')).toThrow(
      TradeReplayError,
    );
  });

  it('covers a same-day sale entered before its buy', () => {
    const ledger = replayTrades([sell('2025-01-10', 1, 110), buy('2025-01-10', 1, 100)], 'fifo');
    expect(ledger.realizedGain).toBe(10);
    expect(ledger.quantity).toBe(0);
  });

  it('counts dividends net of what was held back, per year with realised gains', () => {
    const ledger = replayTrades(
      [
        buy('2024-01-10', 10, 100),
        trade('dividend', '2024-06-30', { amount: 20, fee: 3 }),
        sell('2024-12-01', 5, 110),
        trade('dividend', '2025-06-30', { amount: 12 }),
        sell('2025-07-01', 5, 90),
      ],
      'fifo',
    );
    expect(ledger.dividends).toBe(29);
    expect(ledger.years).toEqual([
      { year: 2024, realizedGain: 50, dividends: 17 },
      { year: 2025, realizedGain: -50, dividends: 12 },
    ]);
    expect(ledger.realizedGain).toBe(0);
    expect(ledger.quantity).toBe(0);
    expect(ledger.averageCost).toBeNull();
  });
});

describe('countsUnits', () => {
  it('takes the quantity from trades once one moves units, never from dividends alone', () => {
    expect(countsUnits([])).toBe(false);
    expect(countsUnits([trade('dividend', '2025-01-01', { amount: 4 })])).toBe(false);
    expect(
      countsUnits([trade('dividend', '2025-01-01', { amount: 4 }), buy('2025-02-01', 1, 1)]),
    ).toBe(true);
    expect(countsUnits([trade('split', '2025-01-01', { splitFrom: 1, splitTo: 2 })])).toBe(true);
  });
});

describe('splitFactorSince', () => {
  it('multiplies the splits dated after the quote, and only those', () => {
    const trades = [
      trade('split', '2024-01-01', { splitFrom: 1, splitTo: 3 }),
      trade('split', '2025-06-01', { splitFrom: 1, splitTo: 2 }),
      trade('split', '2025-07-01', { splitFrom: 10, splitTo: 1 }),
      buy('2025-08-01', 1, 1),
    ];
    expect(splitFactorSince(trades, '2025-01-01')).toBeCloseTo(0.2);
    // A split on the quote's own day is taken as already in it.
    expect(splitFactorSince(trades, '2025-06-01')).toBeCloseTo(0.1);
    expect(splitFactorSince(trades, null)).toBeCloseTo(0.6);
    expect(splitFactorSince([], '2025-01-01')).toBe(1);
  });
});

describe('orderTrades', () => {
  it('orders by day, then split, in, income, out, then entry order', () => {
    const out = sell('2025-01-01', 1, 1);
    const inn = buy('2025-01-01', 1, 1);
    const split = trade('split', '2025-01-01', { splitFrom: 1, splitTo: 2 });
    const earlier = buy('2024-12-31', 1, 1);
    expect(orderTrades([out, inn, split, earlier]).map(item => item.id)).toEqual([
      earlier.id,
      split.id,
      inn.id,
      out.id,
    ]);
  });
});

describe('lot book', () => {
  it('slots an older lot in by date', () => {
    const lots: Lot[] = [{ quantity: 1, unitCost: 1, date: '2025-02-01' }];
    addLot(lots, { quantity: 1, unitCost: 2, date: '2024-01-01' });
    expect(lots.map(lot => lot.date)).toEqual(['2024-01-01', '2025-02-01']);
  });

  it('reports what an average-cost take could not cover', () => {
    const lots: Lot[] = [{ quantity: 2, unitCost: 10, date: '2025-01-01' }];
    const taken = takeFromLots(lots, 3, 'average');
    expect(taken).toMatchObject({ matched: 2, cost: 20, uncovered: 1 });
    expect(lots).toEqual([]);
  });
});

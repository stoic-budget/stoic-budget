import {
  closeOn,
  type DatedClose,
  type FeedHealth,
  healthView,
  holdingSeries,
  ledgerStates,
  mergeCloses,
  nextHealth,
  pricedValueOn,
  STALE_AFTER_FAILURES,
} from '@/modules/investments/price-history';
import type { TradeEvent } from '@/modules/investments/trade-ledger';

const feed = (date: string, close: number): DatedClose => ({
  date,
  close,
  currency: 'USD',
  source: 'auto',
});
const own = (date: string, close: number): DatedClose => ({
  date,
  close,
  currency: 'USD',
  source: 'manual',
});

function trade(partial: Partial<TradeEvent> & Pick<TradeEvent, 'kind' | 'date'>): TradeEvent {
  return {
    id: `${partial.kind}-${partial.date}`,
    quantity: 0,
    price: 0,
    fee: 0,
    amount: null,
    splitFrom: null,
    splitTo: null,
    acquiredOn: null,
    ...partial,
  };
}

describe('mergeCloses', () => {
  it('keeps one close per day, the workspace\'s own over the feed\'s', () => {
    const merged = mergeCloses(
      [feed('2026-03-03', 11), feed('2026-03-02', 10), feed('2026-03-04', 12)],
      [own('2026-03-03', 15), own('2026-03-05', 13)],
    );

    expect(merged.map(close => [close.date, close.close, close.source])).toEqual([
      ['2026-03-02', 10, 'auto'],
      ['2026-03-03', 15, 'manual'],
      ['2026-03-04', 12, 'auto'],
      ['2026-03-05', 13, 'manual'],
    ]);
  });

  it('adds nothing twice when a backfill brings days already stored', () => {
    const stored = [feed('2026-03-02', 10), feed('2026-03-03', 11)];
    const merged = mergeCloses([...stored, feed('2026-03-03', 11), feed('2026-03-04', 12)], []);

    expect(merged.map(close => close.date)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04']);
  });
});

describe('closeOn', () => {
  const closes = [feed('2026-03-06', 10), feed('2026-03-09', 11)];

  it('carries Friday\'s close over the weekend', () => {
    expect(closeOn(closes, '2026-03-08')?.close).toBe(10);
    expect(closeOn(closes, '2026-03-09')?.close).toBe(11);
  });

  it('has none before the first close', () => {
    expect(closeOn(closes, '2026-03-05')).toBeNull();
  });
});

describe('feed health', () => {
  const now = new Date('2026-03-10T05:00:00Z');
  const healthy: FeedHealth = { consecutiveFailures: 0, lastCloseOn: '2026-03-06', lastAttemptAt: now };

  it('counts fetches in a row that brought nothing', () => {
    let health: FeedHealth | null = null;
    for (let day = 0; day < STALE_AFTER_FAILURES; day += 1) {
      health = nextHealth(health, null, now);
    }
    expect(health).toMatchObject({ consecutiveFailures: STALE_AFTER_FAILURES, lastCloseOn: null });
  });

  it('does not count a weekend that brings Friday again as a failure', () => {
    const sunday = nextHealth(healthy, ['2026-03-05', '2026-03-06'], now);

    expect(sunday).toMatchObject({ consecutiveFailures: 0, lastCloseOn: '2026-03-06' });
  });

  it('starts again at zero after a fetch with a newer close, and never moves the last close back', () => {
    const failing = { ...healthy, consecutiveFailures: 7 };

    expect(nextHealth(failing, ['2026-03-09'], now)).toEqual({
      consecutiveFailures: 0,
      lastCloseOn: '2026-03-09',
      lastAttemptAt: now,
    });
    const later = { ...healthy, lastCloseOn: '2026-03-09' };
    expect(nextHealth(later, ['2026-03-05', '2026-03-06'], now)).toMatchObject({
      consecutiveFailures: 0,
      lastCloseOn: '2026-03-09',
    });
  });

  it('counts a halted feed that keeps answering last month\'s bars as failing', () => {
    const bars = ['2026-02-20', '2026-02-25', '2026-03-02'];
    let health = nextHealth(null, bars, new Date('2026-03-03T05:00:00Z'));
    expect(health).toMatchObject({ consecutiveFailures: 0, lastCloseOn: '2026-03-02' });
    // Tuesday to Friday: one to three sessions without a newer close is still a late feed.
    for (const day of ['2026-03-04', '2026-03-05', '2026-03-06']) {
      health = nextHealth(health, bars, new Date(`${day}T05:00:00Z`));
    }
    expect(health.consecutiveFailures).toBe(0);
    for (let day = 9; day < 9 + STALE_AFTER_FAILURES; day += 1) {
      health = nextHealth(health, bars, new Date(`2026-03-${String(day).padStart(2, '0')}T05:00:00Z`));
    }

    expect(health).toMatchObject({ consecutiveFailures: STALE_AFTER_FAILURES, lastCloseOn: '2026-03-02' });
    expect(healthView(health, null)).toMatchObject({ status: 'stale', lastCloseOn: '2026-03-02' });
  });

  it('does not count a long weekend with a holiday as a halted feed', () => {
    // Thursday's close; Friday is a holiday; asked again on Tuesday before the open.
    const thursday = { ...healthy, lastCloseOn: '2026-04-02' };

    expect(nextHealth(thursday, ['2026-04-01', '2026-04-02'], new Date('2026-04-07T05:00:00Z'))).toMatchObject({
      consecutiveFailures: 0,
    });
  });

  it('reads pending before any close, ok after one, stale after the failures', () => {
    expect(healthView(null, null).status).toBe('pending');
    expect(healthView({ ...healthy, consecutiveFailures: 1, lastCloseOn: null }, null).status).toBe(
      'pending',
    );
    expect(healthView({ ...healthy, consecutiveFailures: STALE_AFTER_FAILURES - 1 }, null)).toEqual({
      status: 'ok',
      lastCloseOn: '2026-03-06',
      failures: STALE_AFTER_FAILURES - 1,
    });
    expect(healthView({ ...healthy, consecutiveFailures: STALE_AFTER_FAILURES }, null).status).toBe(
      'stale',
    );
  });

  it('a close of the workspace newer than the feed\'s clears stale, for that workspace', () => {
    const stale = { ...healthy, consecutiveFailures: STALE_AFTER_FAILURES + 3 };

    expect(healthView(stale, '2026-03-09')).toEqual({
      status: 'ok',
      lastCloseOn: '2026-03-09',
      failures: STALE_AFTER_FAILURES + 3,
    });
    // An older close of its own says nothing about today.
    expect(healthView(stale, '2026-01-02')).toMatchObject({ status: 'stale', lastCloseOn: '2026-03-06' });
  });

  it('a workspace with only its own closes for a symbol the feed never knew reads ok', () => {
    const unknown = { consecutiveFailures: 9, lastCloseOn: null, lastAttemptAt: now };

    expect(healthView(unknown, '2026-03-01')).toMatchObject({ status: 'ok', lastCloseOn: '2026-03-01' });
    expect(healthView(unknown, null).status).toBe('stale');
  });
});

describe('holding series', () => {
  const trades = [
    trade({ kind: 'buy', date: '2026-03-02', quantity: 10, price: 10, fee: 1 }),
    trade({ kind: 'sell', date: '2026-03-04', quantity: 4, price: 12 }),
    trade({ kind: 'split', date: '2026-03-05', splitFrom: 1, splitTo: 2 }),
    trade({ kind: 'dividend', date: '2026-03-05', amount: 3 }),
  ];
  const closes = [feed('2026-03-02', 10), feed('2026-03-03', 11), feed('2026-03-04', 12), feed('2026-03-05', 6.5)];
  const same = (amount: number) => amount;

  it('replays the trades into what was held and what it cost, day by day', () => {
    expect(ledgerStates(trades, 'fifo')).toEqual([
      { date: '2026-03-02', quantity: 10, costBasis: 101 },
      { date: '2026-03-04', quantity: 6, costBasis: 60.6 },
      { date: '2026-03-05', quantity: 12, costBasis: 60.6 },
    ]);
  });

  it('values what was held each day at that day\'s close, against its cost', () => {
    const points = holdingSeries({
      days: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'],
      closes,
      states: ledgerStates(trades, 'fifo'),
      convert: same,
    });

    expect(points.map(point => [point.date, point.quantity, point.value, point.unrealizedGain])).toEqual([
      // Before the first buy and the first close: nothing held.
      ['2026-03-01', 0, null, null],
      ['2026-03-02', 10, 100, -1],
      ['2026-03-03', 10, 110, 9],
      ['2026-03-04', 6, 72, 11.4],
      // The split doubles the units and the close is quoted in new units: no jump.
      ['2026-03-05', 12, 78, 17.4],
      ['2026-03-06', 12, 78, 17.4],
    ]);
  });

  it('has only the closes for a holding without trades', () => {
    const [point] = holdingSeries({ days: ['2026-03-03'], closes, states: null, convert: same });

    expect(point).toEqual({
      date: '2026-03-03',
      close: 11,
      quantity: null,
      value: null,
      costBasis: null,
      unrealizedGain: null,
    });
  });

  it('converts each close on its own day, and leaves a day without a rate unknown', () => {
    const points = holdingSeries({
      days: ['2026-03-02', '2026-03-03'],
      closes,
      states: ledgerStates(trades, 'fifo'),
      convert: (amount, _currency, date) => (date === '2026-03-02' ? amount * 0.5 : null),
    });

    expect(points.map(point => point.value)).toEqual([50, null]);
  });
});

describe('pricedValueOn', () => {
  const states = ledgerStates(
    [trade({ kind: 'buy', date: '2026-03-02', quantity: 2, price: 10 })],
    'fifo',
  );

  it('adds what every holding held at the close', () => {
    const value = pricedValueOn(
      [
        { states, closes: [feed('2026-03-02', 10)] },
        { states, closes: [feed('2026-03-01', 5)] },
      ],
      '2026-03-03',
      amount => amount,
    );

    expect(value).toBe(30);
  });

  it('is unknown when a held unit has no close yet, and zero before anything was held', () => {
    const holdings = [{ states, closes: [feed('2026-03-05', 10)] }];

    expect(pricedValueOn(holdings, '2026-03-03', amount => amount)).toBeNull();
    expect(pricedValueOn(holdings, '2026-03-01', amount => amount)).toBe(0);
  });
});

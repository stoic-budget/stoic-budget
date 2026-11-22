import { EffectRuntime } from '@/common/effect/effect-runtime';
import { StockPriceService } from '@/modules/investments/stock-price.service';
import { readYahooCloses, type YahooHistory } from '@/modules/investments/yahoo-closes';

vi.mock('@/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: vi.fn(async () => undefined),
}));

/** Seconds since the epoch of a UTC wall-clock time. */
const at = (iso: string) => Date.parse(iso) / 1000;

/**
 * The shape Yahoo really answers with (checked against a live answer once):
 * timestamps at the exchange's open, `gmtoffset` in seconds, splits keyed by
 * timestamp, closes already divided by every later split.
 */
function chart(input: {
  currency?: string;
  gmtoffset?: number;
  bars: Array<[string, number | null]>;
  splits?: Array<{ at: string; numerator: number; denominator: number }>;
}): YahooHistory {
  return {
    chart: {
      result: [
        {
          meta: { currency: input.currency ?? 'USD', gmtoffset: input.gmtoffset ?? -18000 },
          timestamp: input.bars.map(([stamp]) => at(stamp)),
          events: input.splits
            ? {
                splits: Object.fromEntries(
                  input.splits.map(split => [
                    String(at(split.at)),
                    { date: at(split.at), numerator: split.numerator, denominator: split.denominator },
                  ]),
                ),
              }
            : undefined,
          indicators: { quote: [{ close: input.bars.map(([, close]) => close) }] },
        },
      ],
    },
  };
}

describe('readYahooCloses', () => {
  it('dates each bar by the exchange day and drops days without a close', () => {
    const read = readYahooCloses(
      chart({
        bars: [
          ['2026-03-02T14:30:00Z', 101.5],
          ['2026-03-03T14:30:00Z', null],
          ['2026-03-04T14:30:00Z', 102.25],
        ],
      }),
    );

    expect(read).toEqual({
      currency: 'USD',
      closes: [
        { date: '2026-03-02', close: 101.5 },
        { date: '2026-03-04', close: 102.25 },
      ],
    });
  });

  it('keeps the local day of a market that opens before midnight UTC', () => {
    // Sydney in summer: 10:00 AEDT is 23:00 UTC the day before.
    const read = readYahooCloses(
      chart({ currency: 'AUD', gmtoffset: 39600, bars: [['2026-01-12T23:00:00Z', 45.1]] }),
    );

    expect(read?.closes).toEqual([{ date: '2026-01-13', close: 45.1 }]);
  });

  it('undoes the split adjustment, so closes stay as they were quoted then', () => {
    const read = readYahooCloses(
      chart({
        bars: [
          ['2024-06-06T13:30:00Z', 120.998],
          ['2024-06-07T13:30:00Z', 120.888],
          ['2024-06-10T13:30:00Z', 121.79],
        ],
        splits: [{ at: '2024-06-10T13:30:00Z', numerator: 10, denominator: 1 }],
      }),
    );

    expect(read?.closes).toEqual([
      { date: '2024-06-06', close: 1209.98 },
      { date: '2024-06-07', close: 1208.88 },
      { date: '2024-06-10', close: 121.79 },
    ]);
  });

  it('reads pence as pounds', () => {
    const read = readYahooCloses(
      chart({ currency: 'GBp', gmtoffset: 0, bars: [['2026-11-03T08:00:00Z', 117.2]] }),
    );

    expect(read).toEqual({ currency: 'GBP', closes: [{ date: '2026-11-03', close: 1.172 }] });
  });

  it('keeps the last bar of a day quoted twice', () => {
    const read = readYahooCloses(
      chart({
        bars: [
          ['2026-03-04T14:30:00Z', 100],
          ['2026-03-04T20:59:00Z', 101],
        ],
      }),
    );

    expect(read?.closes).toEqual([{ date: '2026-03-04', close: 101 }]);
  });

  it('has nothing for an answer without bars', () => {
    expect(readYahooCloses({ chart: { result: null } })).toBeNull();
    expect(readYahooCloses(chart({ bars: [['2026-03-02T14:30:00Z', null]] }))).toBeNull();
  });
});

describe('StockPriceService.fetchDailyCloses', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: StockPriceService;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new StockPriceService(new EffectRuntime());
    vi.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
  });

  it('asks Yahoo for the range under its market name, with the splits', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify(chart({ bars: [['2026-03-02T14:30:00Z', 10]] })), {
          status: 200,
        }),
    );

    const read = await service.fetchDailyCloses('ACME.UK', '10y');

    expect(read?.closes).toEqual([{ date: '2026-03-02', close: 10 }]);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/chart/ACME.L?');
    expect(url).toContain('range=10y');
    expect(url).toContain('events=split');
  });

  it('answers null when Yahoo does not know the symbol', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ chart: { result: null, error: { code: 'Not Found' } } }), {
          status: 404,
        }),
    );

    await expect(service.fetchDailyCloses('NOPE.US', '1mo')).resolves.toBeNull();
  });
});

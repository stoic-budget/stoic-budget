import { EffectRuntime } from '@/common/effect/effect-runtime';
import {
  normalizeStockSymbol,
  StockPriceService,
  yahooSymbol,
} from '@/modules/investments/stock-price.service';

vi.mock('@/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: vi.fn(async () => undefined),
}));

describe('stock symbols', () => {
  it('defaults a bare ticker to the US market', () => {
    expect(normalizeStockSymbol('acme')).toBe('ACME.US');
    expect(normalizeStockSymbol('acme.de')).toBe('ACME.DE');
  });

  it('translates the market suffixes positions already hold', () => {
    expect(yahooSymbol('ACME.US')).toBe('ACME');
    expect(yahooSymbol('ACME.UK')).toBe('ACME.L');
    expect(yahooSymbol('ACME.JP')).toBe('ACME.T');
  });

  it('passes through a suffix Yahoo uses itself', () => {
    expect(yahooSymbol('ACME.DE')).toBe('ACME.DE');
    expect(yahooSymbol('ACME.L')).toBe('ACME.L');
    expect(yahooSymbol('ACME.TA')).toBe('ACME.TA');
  });
});

describe('StockPriceService.getPrices', () => {
  const PRICE = 233.45;
  const chart = (price: number | null, currency: string) =>
    JSON.stringify({
      chart: { result: [{ meta: { regularMarketPrice: price, currency } }], error: null },
    });
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: StockPriceService;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new StockPriceService(new EffectRuntime());
  });

  it('quotes a symbol under its market name and caches it', async () => {
    fetchMock.mockImplementation(async () => new Response(chart(PRICE, 'USD'), { status: 200 }));

    const first = await service.getPrices(['acme']);
    const second = await service.getPrices(['ACME.US']);

    expect(first.get('ACME.US')).toMatchObject({ price: PRICE, currency: 'USD' });
    expect(second.get('ACME.US')?.price).toBe(PRICE);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/chart/ACME?');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['GBp', 'GBP'],
    ['GBX', 'GBP'],
    ['ILA', 'ILS'],
    ['ZAc', 'ZAR'],
  ])('reads a quote in %s as %s, not a hundred times too high', async (quoted, currency) => {
    fetchMock.mockImplementation(async () => new Response(chart(250, quoted), { status: 200 }));

    const prices = await service.getPrices(['ACME.UK']);

    expect(prices.get('ACME.UK')).toMatchObject({ price: 2.5, currency });
  });

  it('asks for every symbol, past one batch of requests', async () => {
    fetchMock.mockImplementation(async () => new Response(chart(PRICE, 'USD'), { status: 200 }));
    const symbols = Array.from({ length: 7 }, (_, index) => `ACME${index}`);

    const prices = await service.getPrices(symbols);

    expect(prices.size).toBe(7);
  });

  it('leaves out a symbol Yahoo does not know and keeps the others', async () => {
    fetchMock.mockImplementation(async (input: string) =>
      String(input).includes('/chart/NOPE?')
        ? new Response(JSON.stringify({ chart: { result: null, error: {} } }), { status: 404 })
        : new Response(chart(PRICE, 'USD'), { status: 200 }),
    );

    const prices = await service.getPrices(['NOPE', 'ACME']);

    expect([...prices.keys()]).toEqual(['ACME.US']);
  });

  it('leaves the price out when the answer has no price or no currency', async () => {
    fetchMock.mockImplementation(async () => new Response(chart(null, 'USD'), { status: 200 }));
    await expect(service.getPrices(['ACME'])).resolves.toEqual(new Map());

    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: PRICE } }] } }), {
          status: 200,
        }),
    );
    await expect(service.getPrices(['ACME'])).resolves.toEqual(new Map());
  });

  it('leaves the price out when Yahoo cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.getPrices(['ACME'])).resolves.toEqual(new Map());
  });
});

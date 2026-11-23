import { ExchangeRatesController } from '@/modules/exchange-rates/exchange-rates.controller';

describe('ExchangeRatesController', () => {
  let controller: ExchangeRatesController;
  const exchangeRatesService = {
    getRate: vi.fn(),
    getRateQuote: vi.fn(),
    getRateOrNull: vi.fn(),
  } as any;
  const workspaceRepository = { findOne: vi.fn() } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ExchangeRatesController(exchangeRatesService, workspaceRepository);
  });

  describe('getRate', () => {
    it('returns rate for a currency pair', async () => {
      exchangeRatesService.getRateQuote.mockResolvedValue({ rate: 3.67, rateDate: '2025-06-15', stale: false });
      const result = await controller.getRate('ws-1', { from: 'USD', to: 'ILS' });

      expect(result).toEqual({
        from: 'USD',
        to: 'ILS',
        rate: 3.67,
        date: null,
        rateDate: '2025-06-15',
        stale: false,
        missing: false,
      });
      expect(exchangeRatesService.getRateQuote).toHaveBeenCalledWith('USD', 'ILS', undefined, {
        workspaceId: 'ws-1',
      });
    });

    it('passes date when provided', async () => {
      exchangeRatesService.getRateQuote.mockResolvedValue({ rate: 3.6, rateDate: '2025-06-15', stale: false });
      const result = await controller.getRate('ws-1', { from: 'USD', to: 'ILS', date: '2025-06-15' });

      expect(result.date).toBe('2025-06-15');
      expect(exchangeRatesService.getRateQuote).toHaveBeenCalledWith(
        'USD',
        'ILS',
        new Date('2025-06-15'),
        { workspaceId: 'ws-1' },
      );
    });

    it('says so when no rate exists instead of a silent 1', async () => {
      exchangeRatesService.getRateQuote.mockResolvedValue(null);
      const result = await controller.getRate('ws-1', { from: 'ZZX', to: 'USD' });
      expect(result).toMatchObject({ rate: 1, missing: true, rateDate: null });
    });
  });

  describe('bulkConvert', () => {
    it("converts each item at its own day's rate", async () => {
      const rate = 3.67;
      exchangeRatesService.getRateOrNull.mockResolvedValue(rate);
      const dto = {
        items: [{ amount: 100, currency: 'USD', date: '2025-06-15' }],
        targetCurrency: 'ILS',
      };

      const result = await controller.bulkConvert('ws-1', dto);

      expect(result).toEqual({
        targetCurrency: 'ILS',
        results: [{ converted: 100 * rate, rate, source: 'exchange-rates-service', missing: false }],
      });
      expect(exchangeRatesService.getRateOrNull).toHaveBeenCalledWith(
        'USD',
        'ILS',
        new Date('2025-06-15'),
        'ws-1',
      );
    });

    it('says so when no rate exists, and uses the latest rate for an item without a date', async () => {
      exchangeRatesService.getRateOrNull.mockResolvedValue(null);
      const dto = {
        items: [{ amount: 50, currency: 'EUR' }],
        targetCurrency: 'USD',
      };

      const result = await controller.bulkConvert('ws-1', dto);

      expect(result.results).toEqual([
        { converted: 50, rate: 1, source: 'exchange-rates-service', missing: true },
      ]);
      expect(exchangeRatesService.getRateOrNull).toHaveBeenCalledWith('EUR', 'USD', undefined, 'ws-1');
    });
  });
});

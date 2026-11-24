import { describe, expect, it, vi } from 'vitest';
import { ForecastRates } from '../../../../src/modules/forecast/forecast-currency';

/** A currency with no rate counts at face value and is named for its workspace (#787). */
describe('ForecastRates', () => {
  const rates = (rate: number | null) => ({ getRateOrNull: vi.fn(async () => rate) });

  it('converts at the rate when there is one, and names nothing', async () => {
    const forecast = new ForecastRates(rates(0.5));
    const result = await (async () => {
      forecast.begin();
      const amount = await forecast.convert(10, 'usd', 'EUR', 'ws-1');
      return { amount, ...forecast.finish() };
    })();

    expect(result).toEqual({ amount: 5 });
  });

  it('counts a currency without a rate as it is, and names it once', async () => {
    const forecast = new ForecastRates(rates(null));
    const result = await (async () => {
      forecast.begin();
      const amount = await forecast.convert(10, 'xts', 'EUR', 'ws-1');
      await forecast.convert(3, 'XTS', 'EUR', 'ws-1');
      return { amount, ...forecast.finish() };
    })();

    expect(result).toEqual({ amount: 10, missingRates: ['XTS'] });
  });

  it('keeps each of two forecasts of one workspace at once to its own names', async () => {
    // A slow lookup, so the two calls overlap.
    const slow = { getRateOrNull: vi.fn(() => new Promise<null>(resolve => setTimeout(() => resolve(null), 10))) };
    const forecast = new ForecastRates(slow);
    const run = async (currency: string | null) => {
      forecast.begin();
      if (currency) await forecast.convert(10, currency, 'EUR', 'ws-1');
      // The one without a currency finishes last, after the others noted theirs.
      await new Promise(resolve => setTimeout(resolve, currency ? 5 : 40));
      return forecast.finish();
    };

    const [first, second, third] = await Promise.all([run('XTS'), run('XTS'), run(null)]);

    expect(first).toEqual({ missingRates: ['XTS'] });
    expect(second).toEqual({ missingRates: ['XTS'] });
    expect(third).toEqual({});
  });
});

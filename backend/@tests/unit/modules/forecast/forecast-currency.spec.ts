import { describe, expect, it, vi } from 'vitest';
import { ForecastRates } from '../../../../src/modules/forecast/forecast-currency';

/** A currency with no rate counts at face value and is named for its workspace (#787). */
describe('ForecastRates', () => {
  const rates = (rate: number | null) => ({ getRateOrNull: vi.fn(async () => rate) });

  it('converts at the rate when there is one, and names nothing', async () => {
    const forecast = new ForecastRates(rates(0.5));
    forecast.begin('ws-1');

    expect(await forecast.convert(10, 'usd', 'EUR', 'ws-1')).toBe(5);
    expect(forecast.finish('ws-1')).toEqual({});
  });

  it('counts a currency without a rate as it is, and names it once', async () => {
    const forecast = new ForecastRates(rates(null));
    forecast.begin('ws-1');

    expect(await forecast.convert(10, 'xts', 'EUR', 'ws-1')).toBe(10);
    await forecast.convert(3, 'XTS', 'EUR', 'ws-1');

    expect(forecast.finish('ws-1')).toEqual({ missingRates: ['XTS'] });
    // Forgotten after the forecast: the next one starts clean.
    expect(forecast.finish('ws-1')).toEqual({});
  });

  it('keeps one workspace\'s missing rates out of another\'s forecast', async () => {
    const forecast = new ForecastRates(rates(null));
    forecast.begin('ws-1');
    forecast.begin('ws-2');

    await forecast.convert(10, 'XTS', 'EUR', 'ws-1');

    expect(forecast.finish('ws-2')).toEqual({});
    expect(forecast.finish('ws-1')).toEqual({ missingRates: ['XTS'] });
  });
});

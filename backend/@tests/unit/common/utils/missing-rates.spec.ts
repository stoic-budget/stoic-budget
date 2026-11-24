import { describe, expect, it } from 'vitest';
import {
  beginMissingRates,
  noteMissingRate,
  withMissingRates,
} from '../../../../src/common/utils/currency.util';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The currencies one request met without a rate, kept per call (#787). */
describe('missing-rate record', () => {
  it('answers the face-value rate and adds the currency to the list already found', async () => {
    const result = await (async () => {
      beginMissingRates();
      expect(noteMissingRate('xts')).toBe(1);
      return withMissingRates(['ABC']);
    })();

    expect(result).toEqual(['ABC', 'XTS']);
  });

  it('keeps nothing outside a started record', async () => {
    const result = await (async () => {
      await pause(1);
      noteMissingRate('XTS');
      return withMissingRates([]);
    })();

    expect(result).toEqual([]);
  });

  it('keeps two requests at once apart', async () => {
    const request = async (currency: string | null, wait: number) => {
      beginMissingRates();
      await pause(wait);
      if (currency) noteMissingRate(currency);
      await pause(wait);
      return withMissingRates([]);
    };

    const [first, second] = await Promise.all([request('XTS', 5), request(null, 20)]);

    expect(first).toEqual(['XTS']);
    expect(second).toEqual([]);
  });
});

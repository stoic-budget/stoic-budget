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
      await pause(1);
      beginMissingRates();
      expect(noteMissingRate('xts')).toBe(1);
      noteMissingRate('ABC');
      noteMissingRate('DEF');
      return withMissingRates(['ZZZ', 'ABC']);
    })();

    // The found list keeps its order; new ones follow, once.
    expect(result).toEqual(['ZZZ', 'ABC', 'DEF', 'XTS']);
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
      await pause(0);
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

  /** As `getSnapshot` uses it: an await, then the record. */
  const snapshot = async (wait: number) => {
    await pause(0);
    beginMissingRates();
    await pause(wait);
    return withMissingRates([]);
  };
  const otherConversion = async (currency: string, wait: number) => {
    await pause(wait);
    noteMissingRate(currency);
  };

  it('does not take in what its caller converts meanwhile', async () => {
    const pending = snapshot(10);
    noteMissingRate('LEAK');

    expect(await pending).toEqual([]);
  });

  it('does not take in what a sibling converts', async () => {
    const [list] = await Promise.all([snapshot(20), otherConversion('XXB', 5)]);

    expect(list).toEqual([]);
  });

  it('leaves its caller without a record once done', async () => {
    await snapshot(1);
    noteMissingRate('AFTER');

    expect(withMissingRates([])).toEqual([]);
  });
});

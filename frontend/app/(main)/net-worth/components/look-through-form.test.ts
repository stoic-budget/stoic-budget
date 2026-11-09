import { describe, expect, it } from 'vitest';
import { assertMatchesContract } from '@/app/lib/contract-check';
import { checkRows, draftOf, parseWeight, weightsOf } from './look-through-form';

const rows = (...pairs: Array<[string, string]>) => pairs.map(([key, weight]) => ({ key, weight }));
const sends = (weights: ReturnType<typeof weightsOf>) =>
  assertMatchesContract(
    'HoldingClassificationBody',
    { lookThrough: { sector: null, region: weights, country: null } },
    '/test',
    'error',
  );

describe('parseWeight', () => {
  it('takes what the contract takes', () => {
    expect(parseWeight('8.2')).toBe(8.2);
    expect(parseWeight('12,5')).toBe(12.5);
    expect(parseWeight('100')).toBe(100);
    expect(parseWeight('0.01')).toBe(0.01);
  });

  it('refuses what the contract refuses', () => {
    for (const text of ['0', '100.01', '1.005', '-5', '', 'abc', '1e2']) {
      expect(parseWeight(text)).toBeNull();
    }
  });
});

describe('checkRows', () => {
  it('shows the remainder live, in hundredths so thirds add up', () => {
    expect(checkRows(rows(['europe', '33.33'], ['asia', '33.33'])).remainder).toBe(33.34);
    expect(checkRows(rows(['europe', '0.1'], ['asia', '0.2'])).remainder).toBe(99.7);
    expect(checkRows([]).remainder).toBe(100);
  });

  it('flags a sum over 100, a repeated name, a missing name and a bad weight', () => {
    expect(checkRows(rows(['europe', '60'], ['asia', '50']))).toMatchObject({
      over: true,
      valid: false,
    });
    expect(checkRows(rows(['europe', '10'], ['europe', '10'])).invalid).toEqual([1]);
    expect(checkRows(rows(['', '10'])).invalid).toEqual([0]);
    expect(checkRows(rows(['europe', '1.005'])).invalid).toEqual([0]);
  });
});

describe('weightsOf', () => {
  it('sends the rows and the remainder as other, which the contract accepts', () => {
    const weights = weightsOf(rows(['europe', '33.33'], ['asia', '33.33']));
    expect(weights).toEqual([
      { key: 'europe', weight: 33.33 },
      { key: 'asia', weight: 33.33 },
      { key: 'other', weight: 33.34 },
    ]);
    expect(() => sends(weights)).not.toThrow();
  });

  it('sends no other when the rows make 100, and nothing for no rows', () => {
    expect(weightsOf(rows(['europe', '8.2'], ['asia', '91.8']))).toEqual([
      { key: 'europe', weight: 8.2 },
      { key: 'asia', weight: 91.8 },
    ]);
    expect(() => sends(weightsOf(rows(['europe', '8.2'], ['asia', '91.8'])))).not.toThrow();
    expect(weightsOf([])).toBeNull();
  });
});

describe('draftOf', () => {
  it('turns the stored other back into the remainder', () => {
    const draft = draftOf({
      sector: null,
      region: [
        { key: 'europe', weight: 70 },
        { key: 'other', weight: 30 },
      ],
      country: null,
    });
    expect(draft.region).toEqual([{ key: 'europe', weight: '70' }]);
    expect(checkRows(draft.region).remainder).toBe(30);
    expect(draft.sector).toEqual([]);
  });
});

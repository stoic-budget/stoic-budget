import { describe, expect, it } from 'vitest';
import { parseOpeningBalance } from './opening-balance';

describe('parseOpeningBalance', () => {
  it.each([
    ['1 500', 1500],
    ['1.500', 1500],
    ['1,500', 1500],
    ['1 500,50', 1500.5],
    ['1.500,50', 1500.5],
    ['1,500.50', 1500.5],
    ['1500.5', 1500.5],
    ['12,5', 12.5],
    ['1.234.567', 1234567],
    ['-200', -200],
    ['−1 500,50', -1500.5],
    ['1’500', 1500],
    ["1'500", 1500],
    [',5', 0.5],
    ['0,99', 0.99],
    ['999 999 999 999,99', 999999999999.99],
    ['', 0],
    ['  ', 0],
  ])('reads %j as %d', (text, value) => {
    expect(parseOpeningBalance(text)).toBe(value);
  });

  it.each([
    'abc',
    '1.50.0',
    '1,2345',
    '1e3',
    '0x1F',
    '--5',
    '1.5.',
    '12.345,6.7',
    // Three digits after a mark that cannot be grouping: a sub-cent amount.
    '0.125',
    '0,500',
    '1,500.505',
    '1.000,000',
    // A stray space is not a thousands mark.
    '1 50',
    '15 00',
    // More than a column of cents holds.
    '99999999999999999999',
  ])(
    'refuses %j instead of guessing',
    text => {
      expect(parseOpeningBalance(text)).toBe('invalid');
    },
  );
});

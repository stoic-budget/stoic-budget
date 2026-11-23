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
    ['', 0],
    ['  ', 0],
  ])('reads %j as %d', (text, value) => {
    expect(parseOpeningBalance(text)).toBe(value);
  });

  it.each(['abc', '1.50.0', '1,2345', '1e3', '0x1F', '--5', '1.5.', '12.345,6.7'])(
    'refuses %j instead of guessing',
    text => {
      expect(parseOpeningBalance(text)).toBe('invalid');
    },
  );
});

import * as Schema from 'effect/Schema';
import { describe, expect, it } from 'vitest';
import { CreditLimit } from '@/app/lib/contracts';
import { creditLimitState, parseCreditLimit } from './credit-limit';

const card = (balance: number, creditLimit: string | null = '5000.00') => ({
  type: 'credit_card' as const,
  balance,
  creditLimit,
});

describe('parseCreditLimit', () => {
  it('reads an empty field as no limit', () => {
    expect(parseCreditLimit('')).toBeNull();
    expect(parseCreditLimit('   ')).toBeNull();
  });

  it('accepts a decimal comma, and spaces around the amount', () => {
    expect(parseCreditLimit('1500,5')).toBe(1500.5);
    expect(parseCreditLimit(' 5000 ')).toBe(5000);
  });

  // Each could mean two numbers (five thousand or five), or is not how people
  // write money: the form says so instead of sending a number nobody typed.
  it.each(['5,000', '5.000', '1,234.56', '0x1F4', '1e3', 'Infinity', '5 000', '+5', '.5', '5.'])(
    'refuses %s as ambiguous',
    text => {
      expect(parseCreditLimit(text)).toBe('invalid');
    },
  );

  // The form must refuse exactly what the API refuses, no more and no less.
  it.each([
    '5000',
    '8.2',
    '0.01',
    '1500.55',
    '9999999999999.99',
    '149257142.61',
    '0',
    '0.00',
    '100.123',
    '10000000000000',
  ])('agrees with the contract on %s', text => {
    const parsed = parseCreditLimit(text);
    const accepted = Schema.is(CreditLimit)(Number(text));
    expect(parsed !== 'invalid').toBe(accepted);
  });
});

describe('creditLimitState', () => {
  it('shows what is left while money is owed (a card balance below zero)', () => {
    expect(creditLimitState(card(-1200))).toEqual({
      limit: 5000,
      available: 3800,
      usedShare: 0.24,
      over: null,
    });
  });

  it('shows more than the limit when the card was overpaid (a balance above zero)', () => {
    expect(creditLimitState(card(150))).toEqual({
      limit: 5000,
      available: 5150,
      usedShare: 0,
      over: null,
    });
  });

  it('has nothing left, and is not over, exactly at the limit', () => {
    expect(creditLimitState(card(-5000))).toMatchObject({ available: 0, usedShare: 1, over: null });
  });

  it('says by how much the limit is passed, with a full bar', () => {
    expect(creditLimitState(card(-5200.4))).toMatchObject({
      available: -200.4,
      usedShare: 1,
      over: 200.4,
    });
  });

  it('shows nothing without a limit or on an account that is not a card', () => {
    expect(creditLimitState(card(-1200, null))).toBeNull();
    expect(creditLimitState({ ...card(-1200), type: 'loan' })).toBeNull();
  });
});

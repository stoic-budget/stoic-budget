import { describe, expect, it } from 'vitest';
import { buildTrade, emptyForm, formFromTrade, parseDecimal, type TradeFormState } from './trade-form';

const form = (overrides: Partial<TradeFormState>): TradeFormState => ({
  ...emptyForm('USD', '2025-03-01'),
  ...overrides,
});

describe('buildTrade', () => {
  it('sends a buy with its quantity, price and fee, and nothing a buy does not show', () => {
    expect(buildTrade(form({ quantity: '10', price: '101,5', fee: '1', amount: '99' }))).toEqual({
      kind: 'buy',
      date: '2025-03-01',
      quantity: 10,
      price: 101.5,
      fee: 1,
      currency: 'USD',
      note: null,
    });
  });

  it('sends a dividend as an amount, without the units left in the form', () => {
    expect(
      buildTrade(form({ kind: 'dividend', amount: '12.5', fee: '2', quantity: '5', price: '9' })),
    ).toEqual({ kind: 'dividend', date: '2025-03-01', amount: 12.5, fee: 2, currency: 'USD', note: null });
  });

  it('sends the acquisition date only for a transfer in', () => {
    const transfer = buildTrade(
      form({ kind: 'transfer_in', quantity: '2', price: '40', acquiredOn: '2019-06-01' }),
    );
    expect(transfer).toMatchObject({ acquiredOn: '2019-06-01' });
    const sale = buildTrade(form({ kind: 'sell', quantity: '2', price: '40', acquiredOn: '2019-06-01' }));
    expect(sale).not.toHaveProperty('acquiredOn');
  });

  it('holds the server rules: quantity above zero, amount above zero, numbers zero or more', () => {
    expect(buildTrade(form({ quantity: '0' }))).toEqual({ error: 'invalidQuantity' });
    expect(buildTrade(form({ kind: 'dividend', amount: '0' }))).toEqual({ error: 'invalidAmount' });
    expect(buildTrade(form({ quantity: '1', price: '-2' }))).toEqual({ error: 'invalidNumber' });
    expect(buildTrade(form({ quantity: '1', fee: 'abc' }))).toEqual({ error: 'invalidNumber' });
    expect(buildTrade(form({ quantity: '1', date: '2025-13-01' }))).toEqual({ error: 'invalidDate' });
    expect(buildTrade(form({ quantity: '1', currency: 'EU' }))).toEqual({ error: 'invalidCurrency' });
  });

  it('takes any decimal the contract takes, and notes up to 500 characters', () => {
    expect(buildTrade(form({ quantity: '0.00000001', price: '8.2' }))).toMatchObject({
      quantity: 0.00000001,
      price: 8.2,
    });
    expect(buildTrade(form({ quantity: '1', note: 'x'.repeat(500) }))).not.toHaveProperty('error');
    expect(buildTrade(form({ quantity: '1', note: 'x'.repeat(501) }))).toEqual({ error: 'noteTooLong' });
  });
});

describe('parseDecimal', () => {
  it('reads comma and space-grouped decimals and refuses words', () => {
    expect(parseDecimal('1 234,5')).toBe(1234.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('1e3')).toBeNaN();
  });
});

describe('formFromTrade', () => {
  it('fills the form from a stored trade, zeros left blank', () => {
    const filled = formFromTrade({
      id: 't-1',
      holdingId: 'h-1',
      kind: 'dividend',
      date: '2025-06-30',
      quantity: 0,
      price: 0,
      fee: 2,
      amount: 12,
      currency: 'USD',
      splitFrom: null,
      splitTo: null,
      acquiredOn: null,
      transactionId: null,
      note: 'ACME Fund payout',
      createdAt: '2025-06-30T10:00:00Z',
    });
    expect(filled).toMatchObject({ kind: 'dividend', quantity: '', amount: '12', fee: '2' });
  });
});

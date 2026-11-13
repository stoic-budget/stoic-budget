import { describe, expect, it } from 'vitest';
import type { LoanTermsItem } from '@/app/lib/contracts';
import { emptyLoanForm, formToBody, type LoanForm, parseNumber, termsToForm } from './loan-form';

const filled = (patch: Partial<LoanForm> = {}): LoanForm => ({
  ...emptyLoanForm(12_000, '2026-03-15'),
  termMonths: '60',
  annualRate: '4,5',
  ...patch,
});

describe('loan form', () => {
  it('reads a comma as the decimal mark and refuses what is not a number', () => {
    expect(parseNumber('4,5')).toBe(4.5);
    expect(parseNumber(' 12 ')).toBe(12);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('starts a new loan from what the account owes, on today’s day of the month', () => {
    expect(emptyLoanForm(12_000, '2026-03-15')).toMatchObject({
      principal: '12000',
      startDate: '2026-03-15',
      paymentDay: '15',
    });
    expect(emptyLoanForm(0, '2026-03-15').principal).toBe('');
  });

  it('sends the terms it shows', () => {
    expect(
      formToBody(
        filled({
          rateChanges: [{ from: '2027-03-15', annualRate: '3.9' }],
          extraPayments: [{ date: '2026-09-15', amount: '500' }],
          monthlyExtra: '50',
          monthlyExtraFrom: '2026-04-15',
          extraMode: 'reduce_payment',
        }),
      ),
    ).toEqual({
      principal: 12_000,
      startDate: '2026-03-15',
      termMonths: 60,
      paymentDay: 15,
      method: 'annuity',
      dayCount: '30/360',
      annualRate: 4.5,
      rateChanges: [{ from: '2027-03-15', annualRate: 3.9 }],
      extraPayments: [{ date: '2026-09-15', amount: 500 }],
      recurringExtra: { amount: 50, from: '2026-04-15' },
      extraMode: 'reduce_payment',
    });
  });

  it('sends nothing rather than drop a half-filled row it shows', () => {
    expect(formToBody(filled({ rateChanges: [{ from: '', annualRate: '3' }] }))).toBeNull();
    expect(formToBody(filled({ extraPayments: [{ date: '2026-09-15', amount: '' }] }))).toBeNull();
    expect(formToBody(filled({ monthlyExtra: '50', monthlyExtraFrom: '' }))).toBeNull();
  });

  it('refuses terms the API would refuse', () => {
    expect(formToBody(filled({ paymentDay: '32' }))).toBeNull();
    expect(formToBody(filled({ termMonths: '12.5' }))).toBeNull();
    expect(formToBody(filled({ annualRate: '101' }))).toBeNull();
    expect(formToBody(filled({ principal: '0.001' }))).toBeNull();
    expect(formToBody(filled({ startDate: '' }))).toBeNull();
  });

  it('leaves the monthly extra out when its amount is empty', () => {
    expect(formToBody(filled())?.recurringExtra).toBeNull();
  });

  it('round-trips stored terms', () => {
    const terms: LoanTermsItem = {
      id: 'terms-1',
      walletId: 'wallet-1',
      currency: 'EUR',
      principal: '9000.00',
      startDate: '2026-01-31',
      termMonths: 48,
      paymentDay: 31,
      method: 'linear',
      dayCount: 'actual/365',
      annualRate: '4.9000',
      rateChanges: [{ from: '2027-01-31', annualRate: 3.9 }],
      extraPayments: [],
      recurringExtra: { amount: 25, from: '2026-06-30' },
      extraMode: 'reduce_term',
      createdAt: '2026-01-31T10:00:00.000Z',
      updatedAt: '2026-01-31T10:00:00.000Z',
    };
    expect(formToBody(termsToForm(terms))).toEqual({
      principal: 9000,
      startDate: '2026-01-31',
      termMonths: 48,
      paymentDay: 31,
      method: 'linear',
      dayCount: 'actual/365',
      annualRate: 4.9,
      rateChanges: [{ from: '2027-01-31', annualRate: 3.9 }],
      extraPayments: [],
      recurringExtra: { amount: 25, from: '2026-06-30' },
      extraMode: 'reduce_term',
    });
  });
});

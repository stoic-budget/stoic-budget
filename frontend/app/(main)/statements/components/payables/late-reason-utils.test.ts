import { describe, expect, it } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import { paidLate, wasLate } from './late-reason-utils';

const bill = (fields: Partial<Payable>) =>
  ({
    direction: 'payable',
    dueDate: '2026-09-10',
    status: 'to_pay',
    paidAt: null,
    skippedAt: null,
    lateReason: null,
    ...fields,
  }) as Payable;
const today = '2026-09-20';

describe('wasLate', () => {
  it('is a bill to pay still unpaid past its due date', () => {
    expect(wasLate(bill({}), today)).toBe(true);
    expect(wasLate(bill({ dueDate: '2026-09-25' }), today)).toBe(false);
  });

  it('is a bill paid after its due date, not one paid in time', () => {
    expect(wasLate(bill({ status: 'paid', paidAt: '2026-09-12T08:00:00.000Z' }), today)).toBe(true);
    expect(wasLate(bill({ status: 'paid', paidAt: '2026-09-09T08:00:00.000Z' }), today)).toBe(false);
  });

  it('is never money owed to the workspace, a skipped or archived bill, or one with no date', () => {
    expect(wasLate(bill({ direction: 'receivable' }), today)).toBe(false);
    expect(wasLate(bill({ skippedAt: '2026-09-11T00:00:00.000Z' }), today)).toBe(false);
    expect(wasLate(bill({ status: 'archived' }), today)).toBe(false);
    expect(wasLate(bill({ dueDate: null }), today)).toBe(false);
  });

  it('stays late once a reason is given, so the reason can be changed', () => {
    expect(wasLate(bill({ status: 'paid', paidAt: null, lateReason: 'forgot' }), today)).toBe(true);
  });
});

describe('paidLate', () => {
  it('compares the day of the payment with the due date', () => {
    expect(paidLate(bill({}), '2026-09-11')).toBe(true);
    expect(paidLate(bill({}), '2026-09-10')).toBe(false);
    expect(paidLate(bill({}), undefined)).toBe(false);
    expect(paidLate(bill({ direction: 'receivable' }), '2026-09-11')).toBe(false);
  });
});

import type { ForecastEvent } from '@/modules/forecast/forecast.engine';
import { withoutInvoicedIncome } from '@/modules/forecast/invoiced-income';

const payday = (date: string, label = 'ACME Client'): ForecastEvent => ({
  date,
  label,
  amount: 1000,
  kind: 'income',
  sourceId: 'income:0',
});
const invoice = (date: string, label = 'ACME Client'): ForecastEvent => ({
  date,
  label,
  amount: 1000,
  kind: 'invoice',
  sourceId: 'invoice-1',
});
const monthly = () => 30;

describe('withoutInvoicedIncome', () => {
  it('lets an open invoice stand for the payday of the same client', () => {
    const income = [payday('2026-11-10'), payday('2026-12-10')];

    expect(withoutInvoicedIncome(income, [invoice('2026-11-10')], monthly)).toEqual([
      payday('2026-12-10'),
    ]);
  });

  it('matches the client under a longer name and a few days off', () => {
    const income = [payday('2026-11-10', 'ACME Client')];

    expect(withoutInvoicedIncome(income, [invoice('2026-11-16', 'Acme Client GmbH')], monthly)).toEqual([]);
  });

  it('keeps the paydays of other payers and those too far from the invoice', () => {
    const income = [payday('2026-11-10', 'Corner Cafe'), payday('2026-12-10')];

    expect(withoutInvoicedIncome(income, [invoice('2026-11-10')], monthly)).toEqual(income);
  });

  it('drops one payday per invoice', () => {
    const income = [payday('2026-11-10'), payday('2026-12-10')];

    expect(
      withoutInvoicedIncome(income, [invoice('2026-11-10'), invoice('2026-11-12')], monthly),
    ).toEqual([payday('2026-12-10')]);
  });

  it('marks the invoice to end "safe to spend" as the payday did', () => {
    const bill = invoice('2026-11-10');
    withoutInvoicedIncome([payday('2026-11-10')], [bill], monthly);
    expect(bill.standsForIncome).toBe(true);
  });

  it('keeps the payday for an overdue invoice, which is the payday it missed', () => {
    const income = [payday('2026-12-10')];
    expect(withoutInvoicedIncome(income, [{ ...invoice('2026-12-04'), isOverdue: true }], monthly)).toEqual(income);
  });

  it('keeps the payday for a much smaller invoice, which is extra money', () => {
    const income = [payday('2026-11-10')];
    expect(withoutInvoicedIncome(income, [{ ...invoice('2026-11-10'), amount: 50 }], monthly)).toEqual(income);
  });

  it('matches within the payer\'s wobble only, like the paycheck planner', () => {
    const income = [payday('2026-11-10')];
    expect(withoutInvoicedIncome(income, [invoice('2026-11-20')], monthly)).toEqual(income);
  });
});

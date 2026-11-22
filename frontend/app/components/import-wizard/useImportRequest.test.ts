// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initialImportChoices } from './import-choices';
import type { PreparedSheet } from './import-wizard-utils';
import { useImportRequest } from './useImportRequest';

const sheet: PreparedSheet = {
  headers: ['Date', 'Merchant', 'Amount'],
  rows: [['2026-02-10', 'Corner Cafe', '-5']],
  samples: [],
};
const mapping = { date: 0, merchant: 1, amount: 2 };
const account = { id: 'w-1', currency: 'EUR', period: { from: '2026-02-01', to: '2026-02-28' } };

describe('useImportRequest', () => {
  it('sends the gap’s dates with the account while the import is held to them', () => {
    const choices = initialImportChoices(account, 'USD');
    const { result } = renderHook(() => useImportRequest(sheet, 'transactions', mapping, 'export.csv', choices));
    expect(result.current?.options).toEqual({
      currency: 'EUR',
      categorize: true,
      walletId: 'w-1',
      investmentAccountId: null,
      createMissingHoldings: false,
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });
  });

  it('sends no dates once unticked, and none for another target', () => {
    const choices = { ...initialImportChoices(account, 'USD'), heldToPeriod: false };
    const unticked = renderHook(() => useImportRequest(sheet, 'transactions', mapping, 'export.csv', choices));
    expect(unticked.result.current?.options).not.toHaveProperty('dateFrom');

    const held = initialImportChoices(account, 'USD');
    const budgets = renderHook(() => useImportRequest(sheet, 'budgets', mapping, 'export.csv', held));
    expect(budgets.result.current?.options).toEqual({
      currency: 'EUR',
      categorize: true,
      walletId: null,
      investmentAccountId: null,
      createMissingHoldings: false,
    });
  });

  it('sends the investment account and "create missing" for trades only, never the gap', () => {
    const choices = {
      ...initialImportChoices(account, 'USD'),
      investmentAccountId: 'inv-1',
      createMissingHoldings: true,
    };
    const trades = renderHook(() => useImportRequest(sheet, 'trades', mapping, 'export.csv', choices));
    expect(trades.result.current?.options).toEqual({
      currency: 'EUR',
      categorize: true,
      walletId: null,
      investmentAccountId: 'inv-1',
      createMissingHoldings: true,
    });
    const rows = renderHook(() => useImportRequest(sheet, 'transactions', mapping, 'export.csv', choices));
    expect(rows.result.current?.options).toMatchObject({
      investmentAccountId: null,
      createMissingHoldings: false,
    });
  });

  it('opens on the whole sheet without a period', () => {
    expect(initialImportChoices({ id: 'w-1', currency: 'EUR' }, 'USD')).toMatchObject({
      period: null,
      heldToPeriod: false,
    });
    expect(initialImportChoices(undefined, 'USD')).toMatchObject({ currency: 'USD', walletId: '' });
  });
});

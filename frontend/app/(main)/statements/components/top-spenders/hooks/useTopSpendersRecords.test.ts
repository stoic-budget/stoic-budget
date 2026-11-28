import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReceiptDocument, Transaction } from '../../../types/statement-types';
import { DEFAULT_STATEMENT_FILTERS } from '../../filters/statement-filters';
import { useTopSpendersRecords } from './useTopSpendersRecords';

const STATEMENT = {
  id: 'st-bank',
  fileName: 'march.pdf',
  fileType: 'pdf',
  bankName: 'other',
  status: 'completed',
  totalDebit: 1200,
  totalCredit: 0,
  currency: 'EUR',
  createdAt: '2026-03-31',
  statementDateFrom: '2026-03-01',
  statementDateTo: '2026-03-31',
} as never;

const row = (id: string, debit: number): Transaction => ({
  id,
  statementId: 'st-bank',
  debit,
  transactionDate: '2026-03-12',
  currency: 'EUR',
  isVerified: true,
});

const spend = (transactions: Transaction[], receipts: ReceiptDocument[] = []) =>
  renderHook(() =>
    useTopSpendersRecords({
      statements: [STATEMENT],
      transactions,
      receipts,
      workspaceCurrency: 'EUR',
      appliedFilters: DEFAULT_STATEMENT_FILTERS,
      searchInput: '',
      activeFlowType: 'spend',
    }),
  ).result.current.flowFilteredRecords.map(record => [record.id, record.amount]);

describe('useTopSpendersRecords', () => {
  it('sums a statement from its confirmed spending rows, not the file total', () => {
    // 1,200 on the file: a 200 purchase and a 1,000 transfer, which keepConfirmed left out.
    expect(spend([row('purchase', 200)])).toEqual([['st-bank', 200]]);
  });

  it('leaves out a statement none of whose rows count yet', () => {
    expect(spend([])).toEqual([]);
  });

  it('counts a row with an approved receipt once, as the receipt', () => {
    const receipt = {
      id: 'rc-1',
      subject: 'ACME Store',
      sender: 'ACME Store',
      receivedAt: '2026-03-12',
      status: 'approved',
      transactionId: 'purchase',
      parsedData: { amount: 200, currency: 'EUR', vendor: 'ACME Store', date: '2026-03-12' },
    } as ReceiptDocument;

    expect(spend([row('purchase', 200)], [receipt])).toEqual([['rc-1', 200]]);
  });
});

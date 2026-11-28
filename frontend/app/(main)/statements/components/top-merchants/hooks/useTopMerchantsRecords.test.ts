import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReceiptDocument, Transaction } from '../../../types/statement-types';
import { DEFAULT_STATEMENT_FILTERS } from '../../filters/statement-filters';
import { useTopMerchantsRecords } from './useTopMerchantsRecords';

const SHOP = 'ACME Store';

describe('useTopMerchantsRecords', () => {
  it('counts an approved scan once: its receipt is the row it booked', () => {
    const row: Transaction = {
      id: 'tx-scan',
      statementId: 'st-scan',
      counterpartyName: SHOP,
      transactionDate: '2026-03-12',
      debit: 50,
      amount: 50,
      currency: 'EUR',
      transactionType: 'expense',
      isVerified: true,
    };
    const receipt = {
      id: 'rc-scan',
      subject: SHOP,
      sender: SHOP,
      receivedAt: '2026-03-12',
      status: 'approved',
      transactionId: row.id,
      parsedData: { amount: 50, currency: 'EUR', vendor: SHOP, date: '2026-03-12' },
    } as ReceiptDocument;

    const { result } = renderHook(() =>
      useTopMerchantsRecords({
        statements: [],
        transactions: [row],
        receipts: [receipt],
        workspaceCurrency: 'EUR',
        appliedFilters: DEFAULT_STATEMENT_FILTERS,
        searchInput: '',
        activeFlowType: 'spend',
      }),
    );

    expect(result.current.flowFilteredRecords).toHaveLength(1);
  });
});

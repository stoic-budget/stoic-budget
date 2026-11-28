// @vitest-environment jsdom
import { render, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomTableColumn, CustomTableGridRow } from '../utils/types';
import { useGridColumns } from './useGridColumns';

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));

const AMOUNT = {
  id: 'a',
  key: 'amount',
  title: 'Amount',
  type: 'currency',
  position: 0,
  config: { currency: 'USD', precision: 2, source: { kind: 'app_field', field: 'amount' } },
} as unknown as CustomTableColumn;
const CODE = {
  id: 'c',
  key: 'code',
  title: 'Currency',
  type: 'text',
  position: 1,
  config: { source: { kind: 'app_field', field: 'currency' } },
} as unknown as CustomTableColumn;

describe('useGridColumns money cells (#648)', () => {
  it("renders a transactions table's amount in its row's currency", () => {
    const props = {
      columns: [AMOUNT, CODE],
      fallbackCurrency: 'USD',
      sourceKind: null,
      aggregates: {},
      aggregateValues: {},
      onAggregateChange: () => {},
      onUpdateCell: async () => {},
      onEditColumn: () => {},
      onDeleteColumn: () => {},
      labels: { yes: 'Yes', no: 'No', selectAll: 'All', selectRow: 'Row', rowNumber: '#' },
    } as never;
    const { result } = renderHook(() => useGridColumns(props));
    const amount = result.current.find(column => column.id === 'amount') as unknown as {
      cell: (context: unknown) => React.ReactElement;
    };
    const original = { id: 'r1', rowNumber: 1, data: { amount: 3500, code: 'ILS' } };

    const { container } = render(
      amount.cell({ row: { original: original as unknown as CustomTableGridRow } }),
    );

    expect(container.textContent).toMatch(/₪/);
  });
});

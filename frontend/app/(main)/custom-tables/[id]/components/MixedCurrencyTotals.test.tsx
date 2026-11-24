// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MIXED_CURRENCIES } from '../hooks/useTableAggregates';
import type { CustomTableColumn } from '../utils/types';
import { AggregateFooter } from './AggregateFooter';
import { GroupSummary } from './GroupSummary';

const amount = { key: 'amount', title: 'Amount', type: 'currency', config: { currency: 'USD' } } as CustomTableColumn;
const mixed = 'Several currencies';

describe('money totals over several currencies (#648)', () => {
  it('shows the footer total as several currencies, not a sum', () => {
    render(
      <AggregateFooter
        column={amount}
        fallbackCurrency="USD"
        aggregates={{ amount: 'sum' }}
        aggregateValues={{ amount: MIXED_CURRENCIES }}
        onAggregateChange={vi.fn()}
        labels={{ noTotal: 'No total', mixedCurrencies: mixed, aggregates: { sum: 'Sum' } } as never}
      />,
    );

    expect(screen.getByText(mixed)).toBeTruthy();
    expect(screen.queryByText(/mixed-currencies/)).toBeNull();
  });

  it('says so for a group whose rows are in several currencies', () => {
    render(
      <GroupSummary
        groupColumn={{ ...amount, key: 'shop', title: 'Shop', type: 'text' } as CustomTableColumn}
        columns={[amount]}
        groups={[
          {
            key: 'ACME Store',
            count: 2,
            aggregates: [{ col: 'amount', fn: 'sum', value: null, mixedCurrencies: true }],
          },
        ]}
        loading={false}
        fallbackCurrency="USD"
        onPick={vi.fn()}
        labels={{ title: 'Groups', empty: 'Empty', rows: '{{count}} rows', loading: 'Loading', mixedCurrencies: mixed }}
      />,
    );

    expect(screen.getByText(new RegExp(mixed))).toBeTruthy();
  });
});

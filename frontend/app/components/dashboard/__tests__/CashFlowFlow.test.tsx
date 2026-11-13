// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/app/test/query-wrapper';

const options = vi.hoisted(() => [] as Array<Record<string, unknown>>);
/** Charts created: ECharts plays a sankey's line reveal only on a chart's first draw. */
const mounts = vi.hoisted(() => ({ count: 0 }));
const fetchMap = vi.hoisted(() => vi.fn());

vi.mock('@/app/components/ui/lazy-echarts', () => ({
  LazyECharts: ({ option }: { option: Record<string, unknown> }) => {
    options.push(option);
    React.useEffect(() => {
      mounts.count += 1;
    }, []);
    return <div data-testid="flow-chart" />;
  },
}));
vi.mock('@/app/(main)/statements/components/analytics/flow/SpendFlowSkeleton', () => ({
  SpendFlowSkeleton: () => <div data-testid="flow-skeleton" />,
}));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded: fetchMap }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/app/lib/privacy-mode', () => ({ usePrivacyMode: () => false }));
// Stable, as the real hook's useCallback is.
const categoryName = vi.hoisted(() => (name: string) => name);
vi.mock('@/app/lib/use-category-name', () => ({ useCategoryName: () => categoryName }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    other: { value: 'Other' },
    empty: 'No cash flow data yet',
    missingRates: { value: 'No rate for {{currencies}}' },
  }),
}));

import { CashFlowFlow } from '../CashFlowFlow';

/** One month's flow: a payer, the total and one category. */
const flowOf = (income: number) => ({
  sankey: {
    nodes: [
      { id: 'source:ACME Payroll', name: 'ACME Payroll', kind: 'source' },
      { id: 'total', name: 'Total', kind: 'total' },
      { id: 'cat:food', name: 'Food', kind: 'category' },
    ],
    links: [
      { source: 'source:ACME Payroll', target: 'total', value: income },
      { source: 'total', target: 'cat:food', value: income },
    ],
  },
  missingRates: [],
});

describe('CashFlowFlow', () => {
  it('keeps the last month on screen while the next loads, then draws it in a short take', async () => {
    let finishNext: (value: unknown) => void = () => {};
    fetchMap.mockImplementation(({ params }: { params: { dateFrom: string } }) =>
      params.dateFrom.startsWith('2026-09')
        ? Promise.resolve(flowOf(900))
        : new Promise(resolve => {
            finishNext = resolve;
          }),
    );
    const client = createTestQueryClient();
    // The same tree both times: the dashboard keeps the card mounted while the month changes.
    const at = (month: string) => (
      <QueryClientProvider client={client}>
        <CashFlowFlow month={month} formatAmount={String} />
      </QueryClientProvider>
    );
    const view = render(at('2026-09'));

    await screen.findByTestId('flow-chart');
    // The first month opens with the full animation, ECharts' own.
    expect(options.at(-1)?.animationDuration).toBeUndefined();
    const drawnFirst = options.at(-1);

    view.rerender(at('2026-10'));
    // No skeleton and no redraw of the old month while the next one loads.
    expect(screen.queryByTestId('flow-skeleton')).toBeNull();
    expect(screen.getByTestId('flow-chart')).toBeInTheDocument();
    expect(options.at(-1)).toBe(drawnFirst);
    expect(mounts.count).toBe(1);

    finishNext(flowOf(1200));
    await waitFor(() => expect(options.at(-1)).not.toBe(drawnFirst));
    // A fresh chart, so the reveal plays, and a short one.
    expect(mounts.count).toBe(2);
    expect(options.at(-1)).toMatchObject({ animationDuration: 400 });
  });
});

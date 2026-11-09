import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvestmentHolding } from '../hooks/useInvestments';
import type { HoldingPriceHistory as History, SecurityClose } from '../hooks/usePriceHistory';
import { localToday } from './close-form';
import { HoldingPriceHistory } from './HoldingPriceHistory';

const hookMock = vi.hoisted(() => ({
  history: null as History | null,
  closes: [] as SecurityClose[],
  addClose: vi.fn(async () => undefined),
  deleteClose: vi.fn(async () => undefined),
  importCloses: vi.fn(async () => ({ created: 2, updated: 1, skipped: [] })),
}));

vi.mock('../hooks/usePriceHistory', () => ({
  usePriceHistory: () => ({ ...hookMock, isPending: false, saving: false }),
}));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyReturnsArea: (props: { points: unknown[] }) => (
    <div data-testid="returns-area">{props.points.length}</div>
  ),
  LazyNetWorthArea: () => <div data-testid="close-area" />,
}));

const holding: InvestmentHolding = {
  id: 'h-1',
  symbol: 'ACME.US',
  name: 'ACME Corp',
  assetClass: 'stock',
  quantity: 3,
  price: 52,
  priceCurrency: 'USD',
  priceSource: 'auto',
  pricedAt: '2026-03-10T05:00:00Z',
  value: 156,
  hasTrades: true,
  priceHealth: { status: 'ok', lastCloseOn: '2026-03-09', failures: 0 },
};

const point = (date: string, value: number | null, costBasis: number | null) => ({
  date,
  close: value === null ? null : value / 3,
  quantity: 3,
  value,
  costBasis,
  unrealizedGain: value === null || costBasis === null ? null : value - costBasis,
});

describe('HoldingPriceHistory', () => {
  beforeEach(() => {
    hookMock.closes = [];
    hookMock.addClose.mockClear();
    hookMock.importCloses.mockClear();
    hookMock.history = {
      holdingId: 'h-1',
      symbol: 'ACME.US',
      currency: 'USD',
      basis: 'trades',
      health: { status: 'ok', lastCloseOn: '2026-03-09', failures: 0 },
      firstCloseOn: '2026-03-01',
      points: [point('2026-03-01', null, 0), point('2026-03-02', 150, 144), point('2026-03-03', 156, 144)],
    };
  });

  it('charts the value against the cost from the first close on', () => {
    render(<HoldingPriceHistory holding={holding} locale="en" />);

    // The day before the first close has no value to draw.
    expect(screen.getByTestId('returns-area')).toHaveTextContent('2');
    expect(screen.getByTestId('price-health')).toHaveTextContent('Last close Mar 9, 2026');
  });

  it('says the feed stopped and what to do about it', () => {
    hookMock.history = {
      ...(hookMock.history as History),
      health: { status: 'stale', lastCloseOn: '2026-03-02', failures: 5 },
    };
    render(<HoldingPriceHistory holding={holding} locale="en" />);

    expect(screen.getByTestId('price-health')).toHaveTextContent('No quotes since Mar 2, 2026');
    expect(screen.getByText(/Enter a close to keep the figures current/)).toBeInTheDocument();
  });

  it('shows only the closes for a holding without trades', () => {
    hookMock.history = { ...(hookMock.history as History), basis: 'none' };
    render(<HoldingPriceHistory holding={holding} locale="en" />);

    expect(screen.queryByTestId('returns-area')).not.toBeInTheDocument();
    expect(screen.getByTestId('close-area')).toBeInTheDocument();
    expect(screen.getByText('Add trades to see the value and the gain over time.')).toBeInTheDocument();
  });

  it('sends a typed close as shown, in the holding\'s price currency', async () => {
    render(<HoldingPriceHistory holding={holding} locale="en" />);
    const add = screen.getByRole('button', { name: 'Add close' });
    expect(add).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Close (USD)'), { target: { value: '51,25' } });
    fireEvent.click(add);

    await vi.waitFor(() =>
      expect(hookMock.addClose).toHaveBeenCalledWith({
        date: localToday(),
        close: 51.25,
        currency: 'USD',
      }),
    );
  });

  it('does not send a close dated after today', () => {
    render(<HoldingPriceHistory holding={holding} locale="en" />);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2999-01-01' } });
    fireEvent.change(screen.getByLabelText('Close (USD)'), { target: { value: '10' } });

    expect(screen.getByRole('button', { name: 'Add close' })).toBeDisabled();
  });

  it('imports the text of a chosen file', async () => {
    render(<HoldingPriceHistory holding={holding} locale="en" />);
    const csv = 'Date,Close\n2026-03-02,50\n';

    fireEvent.change(screen.getByTestId('closes-file'), {
      target: { files: [new File([csv], 'acme.csv', { type: 'text/csv' })] },
    });

    await vi.waitFor(() => expect(hookMock.importCloses).toHaveBeenCalledWith(csv));
  });

  it('lists the workspace\'s own closes with where each came from', () => {
    hookMock.closes = [
      { id: 'c-1', symbol: 'ACME.US', date: '2026-03-05', close: 51, currency: 'USD', source: 'manual' },
      { id: 'c-2', symbol: 'ACME.US', date: '2026-03-04', close: 50, currency: 'USD', source: 'import' },
    ];
    render(<HoldingPriceHistory holding={holding} locale="en" />);

    expect(screen.getByTestId('close-2026-03-05')).toHaveTextContent('typed in');
    expect(screen.getByTestId('close-2026-03-04')).toHaveTextContent('imported');
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2026-03-05' }));
    expect(hookMock.deleteClose).toHaveBeenCalledWith('c-1');
  });

  it('asks for a symbol before keeping closes', () => {
    render(<HoldingPriceHistory holding={{ ...holding, symbol: null }} locale="en" />);

    expect(screen.getByText('Give the holding a symbol to keep its daily closes.')).toBeInTheDocument();
    expect(screen.queryByTestId('holding-closes')).not.toBeInTheDocument();
  });
});

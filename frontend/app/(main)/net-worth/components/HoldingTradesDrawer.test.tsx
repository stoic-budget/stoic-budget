import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvestmentHolding } from '../hooks/useInvestments';
import type { HoldingLots, InvestmentTrade } from '../hooks/useInvestmentTrades';
import { HoldingTradesDrawer } from './HoldingTradesDrawer';

const hookMock = vi.hoisted(() => ({
  trades: [] as InvestmentTrade[],
  lots: null as HoldingLots | null,
  createTrade: vi.fn(async () => undefined),
  updateTrade: vi.fn(async () => undefined),
  deleteTrade: vi.fn(async () => undefined),
  setBasisMethod: vi.fn(async () => undefined),
}));

vi.mock('../hooks/useInvestmentTrades', () => ({
  useInvestmentTrades: () => ({ ...hookMock, basisMethod: 'fifo', isPending: false, saving: false }),
}));

const holding: InvestmentHolding = {
  id: 'h-1',
  symbol: 'ACME.US',
  name: 'ACME World ETF',
  assetClass: 'etf',
  quantity: 6,
  price: 130,
  priceCurrency: 'USD',
  priceSource: 'manual',
  pricedAt: '2025-03-01T00:00:00Z',
  value: 780,
  hasTrades: true,
};

const trade = (overrides: Partial<InvestmentTrade>): InvestmentTrade => ({
  id: 't-1',
  holdingId: 'h-1',
  kind: 'buy',
  date: '2025-01-10',
  quantity: 10,
  price: 100,
  fee: 1,
  amount: null,
  currency: 'USD',
  splitFrom: null,
  splitTo: null,
  acquiredOn: null,
  transactionId: null,
  note: null,
  createdAt: '2025-01-10T10:00:00Z',
  ...overrides,
});

const lots: HoldingLots = {
  holdingId: 'h-1',
  method: 'fifo',
  currency: 'USD',
  quantity: 6,
  costBasis: 600.6,
  averageCost: 100.1,
  marketValue: 780,
  unrealizedGain: 179.4,
  realizedGain: 77.6,
  dividends: 0,
  fees: 3,
  openLots: [{ tradeId: 't-1', acquiredOn: '2025-01-10', quantity: 6, unitCost: 100.1, cost: 600.6 }],
  sales: [],
  years: [{ year: 2025, realizedGain: 77.6, dividends: 0 }],
};

describe('HoldingTradesDrawer', () => {
  beforeEach(() => {
    hookMock.trades = [trade({})];
    hookMock.lots = lots;
    hookMock.createTrade.mockClear();
    hookMock.updateTrade.mockClear();
  });

  it('shows what the trades add up to', () => {
    render(<HoldingTradesDrawer holding={holding} locale="en" onClose={() => undefined} />);
    const figures = within(screen.getByTestId('holding-lots-figures'));
    expect(figures.getByText('Cost basis')).toBeInTheDocument();
    expect(figures.getByText('+$179.40')).toBeInTheDocument();
    expect(screen.getByText('Realized by year')).toBeInTheDocument();
  });

  it('still says a first buy replaces the typed quantity when only dividends are recorded', () => {
    const hint = 'Once a holding has trades, its quantity comes from them. Add a transfer in for what you already hold.';
    hookMock.trades = [trade({ kind: 'dividend', quantity: 0, price: 0, amount: 4 })];
    const typed = { ...holding, quantity: 7, hasTrades: false };
    const { unmount } = render(<HoldingTradesDrawer holding={typed} locale="en" onClose={() => undefined} />);
    expect(screen.getByText(hint)).toBeInTheDocument();
    unmount();
    hookMock.trades = [trade({})];
    render(<HoldingTradesDrawer holding={holding} locale="en" onClose={() => undefined} />);
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('adds a dividend sending only the fields a dividend shows', async () => {
    render(<HoldingTradesDrawer holding={holding} locale="en" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add trade' }));
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } });
    fireEvent.mouseDown(within(screen.getByTestId('trade-kind')).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Dividend' }));
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(hookMock.createTrade).toHaveBeenCalledTimes(1));
    expect(hookMock.createTrade).toHaveBeenCalledWith({
      kind: 'dividend',
      date: expect.any(String),
      amount: 12,
      fee: 0,
      currency: 'USD',
      note: null,
    });
  });

  it('corrects a trade from the refreshed list and records a split', async () => {
    render(<HoldingTradesDrawer holding={holding} locale="en" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit 2025-01-10' }));
    expect(screen.getByLabelText('Quantity')).toHaveValue('10');
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() =>
      expect(hookMock.updateTrade).toHaveBeenCalledWith('t-1', expect.objectContaining({ quantity: 12 })),
    );

    // The trade form closes first; the drawer under it is reachable again once it has gone.
    fireEvent.click(await screen.findByRole('button', { name: 'Split' }, { timeout: 3000 }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('New shares'), { target: { value: '3' } });
    expect(dialog.getByText('6 units held now would become 18.')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() =>
      expect(hookMock.createTrade).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'split', splitTo: 3, splitFrom: 1 }),
      ),
    );
  });
});

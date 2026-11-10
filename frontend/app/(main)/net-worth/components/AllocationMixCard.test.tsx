import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvestmentAllocation } from '../hooks/useInvestmentAllocation';
import { AllocationMixCard, classRings } from './AllocationMixCard';

const allocation = vi.hoisted(() => ({
  data: null as InvestmentAllocation | null,
  excluded: null as string[] | null,
}));
vi.mock('../hooks/useInvestmentAllocation', () => ({
  useInvestmentAllocation: (excluded: string[]) => {
    allocation.excluded = excluded;
    return { data: allocation.data };
  },
}));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyNestedDonut: ({ outer }: { outer: Array<{ key: string }> }) => (
    <div data-testid="donut">{outer.map(slice => slice.key).join(',')}</div>
  ),
}));

const DATA: InvestmentAllocation = {
  currency: 'EUR',
  total: 3000,
  unvalued: 1,
  classes: [
    {
      key: 'commodities',
      amount: 2000,
      percent: 66.67,
      subclasses: [{ key: 'gold', amount: 2000, percent: 66.67 }],
    },
    {
      key: 'equity',
      amount: 1000,
      percent: 33.33,
      subclasses: [
        { key: 'etf', amount: 600, percent: 20 },
        { key: 'stock', amount: 400, percent: 13.33 },
      ],
    },
  ],
  sectors: [{ key: 'unclassified', amount: 3000, percent: 100 }],
  regions: [
    { key: 'europe', amount: 700, percent: 23.33 },
    { key: 'other', amount: 300, percent: 10 },
    { key: 'unclassified', amount: 2000, percent: 66.67 },
  ],
  countries: [
    { key: 'DE', amount: 1000, percent: 33.33 },
    { key: 'unclassified', amount: 2000, percent: 66.67 },
  ],
};

describe('classRings', () => {
  it('gives each part its group’s tone in lighter shades', () => {
    const { inner, outer } = classRings(DATA.classes, (_dimension, key) => key);
    expect(inner.map(slice => slice.key)).toEqual(['commodities', 'equity']);
    const [etf, stock] = outer.filter(slice => slice.key.startsWith('equity:'));
    expect(etf.color).toBe(inner[1].color);
    expect(stock.color).toBe(inner[1].color);
    expect(stock.opacity).toBeLessThan(etf.opacity ?? 1);
  });
});

describe('AllocationMixCard', () => {
  it('stays away until something is held', () => {
    allocation.data = { ...DATA, total: 0, unvalued: 0, classes: [] };
    const { container } = render(<AllocationMixCard locale="en" excluded={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says why when nothing held has an exchange rate', () => {
    allocation.data = { ...DATA, total: 0, unvalued: 2, classes: [] };
    render(<AllocationMixCard locale="en" excluded={[]} />);
    expect(screen.getByText(/no exchange rate: 2/)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('donut')).not.toBeInTheDocument();
  });

  it('asks for the mix without the accounts the page leaves out', () => {
    allocation.data = DATA;
    render(<AllocationMixCard locale="en" excluded={['account-1']} />);
    expect(allocation.excluded).toEqual(['account-1']);
  });

  it('shows the classes with their parts, then the other cuts as bars', () => {
    allocation.data = DATA;
    render(<AllocationMixCard locale="en" excluded={[]} />);
    expect(screen.getByTestId('donut')).toHaveTextContent('commodities:gold,equity:etf,equity:stock');
    expect(screen.getByText('Commodities')).toBeInTheDocument();
    expect(screen.getByText('ETFs')).toBeInTheDocument();
    expect(screen.getByText(/no exchange rate: 1/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Region' }));
    expect(screen.getByTestId('allocation-bar-europe')).toHaveTextContent('Europe');
    expect(screen.getByTestId('allocation-bar-unclassified')).toHaveTextContent('Not set');

    fireEvent.click(screen.getByRole('tab', { name: 'Country' }));
    expect(screen.getByTestId('allocation-bar-DE')).toHaveTextContent('Germany');
  });
});

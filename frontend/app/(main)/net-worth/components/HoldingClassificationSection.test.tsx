import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertMatchesContract } from '@/app/lib/contract-check';
import { selectOption } from '@/app/test/select';
import type { InvestmentHolding } from '../hooks/useInvestments';
import { HoldingClassificationSection } from './HoldingClassificationSection';

const hook = vi.hoisted(() => ({
  save: vi.fn(async (_body: Record<string, unknown>) => undefined),
  suggestSector: vi.fn(async (): Promise<string | null> => null),
}));
vi.mock('../hooks/useHoldingClassification', () => ({
  useHoldingClassification: () => ({ ...hook, saving: false, looking: false }),
}));

const fund: InvestmentHolding = {
  id: 'h-1',
  symbol: 'ACMEW.DE',
  name: 'ACME World ETF',
  assetClass: 'etf',
  quantity: 4,
  price: 100,
  priceCurrency: 'EUR',
  priceSource: 'manual',
  pricedAt: '2026-10-01T00:00:00Z',
  value: 400,
  hasTrades: false,
  sector: null,
  region: null,
  country: 'IE',
  lookThrough: {
    sector: null,
    region: [
      { key: 'europe', weight: 70 },
      { key: 'other', weight: 30 },
    ],
    country: null,
  },
};

const sent = () => hook.save.mock.calls.at(-1)?.[0];

describe('HoldingClassificationSection', () => {
  beforeEach(() => {
    hook.save.mockClear();
    hook.suggestSector.mockReset();
  });

  it('shows the stored rest as the remainder and keeps it live while typing', () => {
    render(<HoldingClassificationSection holding={fund} />);
    const region = within(screen.getByTestId('look-through-region'));
    expect(screen.getByTestId('look-through-region-remainder')).toHaveTextContent('30%');
    fireEvent.change(region.getByLabelText('Weight, %'), { target: { value: '66.67' } });
    expect(screen.getByTestId('look-through-region-remainder')).toHaveTextContent('33.33%');
  });

  it('sends exactly what it shows, the remainder as other, which the contract accepts', () => {
    render(<HoldingClassificationSection holding={fund} />);
    const region = within(screen.getByTestId('look-through-region'));
    fireEvent.change(region.getByLabelText('Weight, %'), { target: { value: '33.33' } });
    fireEvent.click(region.getByRole('button', { name: /Add a line/ }));
    selectOption(region.getAllByRole('combobox')[1], 'Asia');
    fireEvent.change(region.getAllByLabelText('Weight, %')[1], { target: { value: '33.33' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const body = sent();
    expect(body).toEqual({
      sector: null,
      region: null,
      country: 'IE',
      lookThrough: {
        sector: null,
        region: [
          { key: 'europe', weight: 33.33 },
          { key: 'asia', weight: 33.33 },
          { key: 'other', weight: 33.34 },
        ],
        country: null,
      },
    });
    expect(() =>
      assertMatchesContract('HoldingClassificationBody', body, '/test', 'error'),
    ).not.toThrow();
  });

  it('will not save weights over 100', () => {
    render(<HoldingClassificationSection holding={fund} />);
    const region = within(screen.getByTestId('look-through-region'));
    fireEvent.change(region.getByLabelText('Weight, %'), { target: { value: '100.5' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(region.getByLabelText('Weight, %'), { target: { value: '80' } });
    fireEvent.click(region.getByRole('button', { name: /Add a line/ }));
    selectOption(region.getAllByRole('combobox')[1], 'Asia');
    fireEvent.change(region.getAllByLabelText('Weight, %')[1], { target: { value: '30' } });
    expect(screen.getByRole('alert')).toHaveTextContent('more than 100%');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows no breakdown for a share and sends none', () => {
    render(<HoldingClassificationSection holding={{ ...fund, assetClass: 'stock', lookThrough: null }} />);
    expect(screen.queryByTestId('look-through-region')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(sent()).toEqual({ sector: null, region: null, country: 'IE' });
  });

  it('fills the sector the quote source names, and says when it names none', async () => {
    hook.suggestSector.mockResolvedValueOnce('financials').mockResolvedValueOnce(null);
    render(<HoldingClassificationSection holding={fund} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look up sector' }));
    await screen.findByText('Financials');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(sent()).toMatchObject({ sector: 'financials' });
    fireEvent.click(screen.getByRole('button', { name: 'Look up sector' }));
    await screen.findByText('No sector found for this symbol');
  });
});

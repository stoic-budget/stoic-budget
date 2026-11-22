import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyLine } from '@/app/lib/contracts';
import { PropertyCard } from './PropertyCard';

const hookMock = vi.hoisted(() => ({
  save: vi.fn(async (_id: string, _body: unknown) => true),
  options: [] as Array<{ kind: 'wallet' | 'liability'; id: string; name: string; linkedTo: string | null }>,
}));

vi.mock('../../hooks/useProperty', () => ({
  useSaveProperty: () => ({ save: hookMock.save, saving: false }),
  usePropertyDebts: () => ({ options: hookMock.options, isPending: false }),
}));

const flat: PropertyLine = {
  accountId: 'flat-1',
  name: 'Real estate',
  kind: 'real_estate',
  value: 300_000,
  estimated: false,
  valuedOn: '2026-10-01',
  depreciationRate: null,
  attributes: { area: 72, areaUnit: 'm2', address: '1 Example Street' },
  debt: { kind: 'liability', id: 'mortgage-1', name: 'Mortgage', amount: 200_000 },
  equity: 100_000,
  ltv: 0.6667,
};
const car: PropertyLine = {
  accountId: 'car-1',
  name: 'Vehicles',
  kind: 'vehicle',
  value: 17_000,
  estimated: true,
  valuedOn: '2025-11-09',
  depreciationRate: 15,
  attributes: { make: 'ACME', model: 'Roadster' },
  debt: null,
  equity: 17_000,
  ltv: null,
};

describe('PropertyCard', () => {
  beforeEach(() => {
    hookMock.save.mockClear();
    hookMock.options = [
      { kind: 'liability', id: 'mortgage-1', name: 'Mortgage', linkedTo: 'flat-1' },
      { kind: 'wallet', id: 'loan-1', name: 'ACME Bank - Car loan', linkedTo: 'other-1' },
    ];
  });

  it('shows nothing without property lines', () => {
    const { container } = render(<PropertyCard properties={[]} currency="USD" locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('puts the value, the debt, the equity and the ratio side by side', () => {
    render(<PropertyCard properties={[flat]} currency="USD" locale="en" />);
    expect(screen.getByText('72 m² · 1 Example Street')).toBeInTheDocument();
    expect(screen.getByText('$300,000')).toBeInTheDocument();
    expect(screen.getByText('$200,000')).toBeInTheDocument();
    expect(screen.getByText('$100,000')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
    expect(screen.queryByText('Estimated')).not.toBeInTheDocument();
  });

  it('marks a depreciated value as an estimate', () => {
    render(<PropertyCard properties={[car]} currency="USD" locale="en" />);
    expect(screen.getByText('Estimated')).toBeInTheDocument();
    expect(screen.getByText('ACME Roadster')).toBeInTheDocument();
  });

  it('opens the vehicle form with its own fields and a debt linked elsewhere unavailable', async () => {
    render(<PropertyCard properties={[flat, car]} currency="USD" locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Details: Vehicles' }));

    expect(await screen.findByLabelText('Make')).toHaveValue('ACME');
    expect(screen.getByLabelText('Depreciation, % a year')).toHaveValue('15');
    expect(screen.queryByLabelText('Floor area')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(hookMock.save).toHaveBeenCalledWith('car-1', {
      attributes: { make: 'ACME', model: 'Roadster' },
      debt: null,
      depreciationRate: 15,
    });
  });
});

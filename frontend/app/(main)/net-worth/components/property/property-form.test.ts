import { describe, expect, it } from 'vitest';
import type { PropertyLine } from '@/app/lib/contracts';
import { formToBody, invalidFields, toForm } from './property-form';

const line = (patch: Partial<PropertyLine> = {}): PropertyLine => ({
  accountId: 'account-1',
  name: 'Real estate',
  kind: 'real_estate',
  value: 300_000,
  estimated: false,
  valuedOn: '2026-10-01',
  depreciationRate: null,
  attributes: null,
  debt: null,
  equity: 300_000,
  ltv: null,
  ...patch,
});

describe('property form', () => {
  it('reads what the property holds now', () => {
    const form = toForm(
      line({
        attributes: { area: 72.5, areaUnit: 'ft2', address: '1 Example Street' },
        debt: { kind: 'liability', id: 'mortgage-1', name: 'Mortgage', amount: 1 },
      }),
    );
    expect(form).toMatchObject({
      area: '72.5',
      areaUnit: 'ft2',
      address: '1 Example Street',
      debt: 'liability:mortgage-1',
      depreciationRate: '',
    });
  });

  it('sends a flat its own fields only, never a car’s or a depreciation rate', () => {
    const form = {
      ...toForm(line()),
      area: '64',
      yearBuilt: '1998',
      make: 'ACME',
      depreciationRate: '15',
      debt: 'wallet:loan-1',
    };
    expect(formToBody(form, 'real_estate')).toEqual({
      attributes: { area: 64, areaUnit: 'm2', yearBuilt: 1998 },
      debt: { kind: 'wallet', id: 'loan-1' },
    });
  });

  it('sends a car its fields and its rate, and a unit only with its number', () => {
    const form = {
      ...toForm(line({ kind: 'vehicle' })),
      make: ' ACME ',
      year: '2019',
      depreciationRate: '12,5',
      area: '50',
    };
    expect(formToBody(form, 'vehicle')).toEqual({
      attributes: { make: 'ACME', year: 2019 },
      debt: null,
      depreciationRate: 12.5,
    });
  });

  it('clears what was emptied', () => {
    const form = toForm(
      line({
        kind: 'vehicle',
        attributes: { make: 'ACME' },
        depreciationRate: 10,
        debt: { kind: 'wallet', id: 'loan-1', name: 'Loan', amount: 1 },
      }),
    );
    expect(formToBody({ ...form, make: '', depreciationRate: '', debt: '' }, 'vehicle')).toEqual({
      attributes: null,
      debt: null,
      depreciationRate: null,
    });
  });

  it('takes a two-decimal rate whatever floating point makes of it', () => {
    const vehicle = toForm(line({ kind: 'vehicle' }));
    for (const rate of ['2.3', '8.2', '16.4', '1.15']) {
      const form = { ...vehicle, depreciationRate: rate };
      expect(invalidFields(form, 'vehicle')).toEqual([]);
      expect(formToBody(form, 'vehicle')?.depreciationRate).toBe(Number(rate));
    }
    expect(invalidFields({ ...vehicle, depreciationRate: '8.255' }, 'vehicle')).toEqual([
      'depreciationRate',
    ]);
  });

  it('holds back numbers the server would refuse, only among the fields shown', () => {
    const form = { ...toForm(line()), yearBuilt: '1998.5', mileage: 'far' };
    expect(invalidFields(form, 'real_estate')).toEqual(['yearBuilt']);
    expect(formToBody(form, 'real_estate')).toBeNull();
    expect(invalidFields({ ...form, depreciationRate: '101' }, 'vehicle')).toEqual([
      'mileage',
      'depreciationRate',
    ]);
  });
});

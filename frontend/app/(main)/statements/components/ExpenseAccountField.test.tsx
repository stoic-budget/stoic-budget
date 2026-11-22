// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { ExpenseAccountField } from './ExpenseAccountField';

const api = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});

const EURO = walletItem({ id: '11111111-1111-4111-8111-111111111111', name: 'Euro card', currency: 'EUR' });
const DOLLAR = walletItem({ id: '22222222-2222-4222-8222-222222222222', name: 'Dollar card', currency: 'USD' });

describe('ExpenseAccountField', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: [EURO, DOLLAR] });
  });

  it('drops a chosen account once the expense is in another currency', async () => {
    const onChange = vi.fn();
    renderWithQuery(<ExpenseAccountField currency="USD" value={EURO.id} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
  });

  it('drops a chosen account when there is no account in the currency at all', async () => {
    const onChange = vi.fn();
    renderWithQuery(<ExpenseAccountField currency="GBP" value={EURO.id} onChange={onChange} />);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(undefined));
  });

  it('keeps an account in the expense currency', async () => {
    const onChange = vi.fn();
    const { findByText } = renderWithQuery(
      <ExpenseAccountField currency="EUR" value={EURO.id} onChange={onChange} />,
    );

    await findByText('Euro card');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the choice while the accounts are still loading', () => {
    api.get.mockReset().mockReturnValue(new Promise(() => undefined));
    const onChange = vi.fn();
    renderWithQuery(<ExpenseAccountField currency="USD" value={EURO.id} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
  });
});

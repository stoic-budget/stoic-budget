// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaycheckPlanResponse } from '@/app/lib/contracts';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { usePaycheckPlan } from './usePaycheckPlan';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));

const plan: PaycheckPlanResponse = {
  currency: 'USD',
  today: '2026-11-09',
  basis: 'paydays',
  incomeStatus: 'regular',
  buffer: 0,
  streams: [
    {
      id: 'detected:a',
      label: 'ACME Payroll',
      kind: 'detected',
      amount: 3000,
      cadence: 'monthly',
      nextDate: '2026-11-25',
      selected: true,
    },
    {
      id: 'declared:b',
      label: 'Example Client',
      kind: 'declared',
      amount: 800,
      cadence: 'other',
      nextDate: '2026-11-20',
      selected: false,
    },
  ],
  accounts: [
    { id: 'w-1', name: 'Checking', currency: 'USD', balance: 5000, selected: true },
    { id: 'w-2', name: 'Cash box', currency: 'USD', balance: 100, selected: true },
  ],
  rates: [],
  periods: [],
};

const paycheckCalls = () =>
  apiGet.mock.calls.filter(([url]) => url === '/forecast/paychecks').map(([, config]) => config.params);

describe('usePaycheckPlan', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({ data: {} });
    apiGet.mockImplementation(async (url: string) =>
      url === '/view-preferences/forecast' ? { data: { state: null } } : { data: plan },
    );
  });

  it('asks for the server default until the person chooses', async () => {
    const { result } = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(paycheckCalls()).toEqual([{}]);
  });

  it('toggles from what the answer shows, and remembers the choice', async () => {
    const { result } = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.toggleStream('declared:b'));
    await waitFor(() =>
      expect(paycheckCalls()).toContainEqual({ streams: 'detected:a,declared:b' }),
    );
    expect(apiPut).toHaveBeenCalledWith('/view-preferences/forecast', {
      state: { streams: ['detected:a', 'declared:b'], walletIds: null, buffer: 0 },
    });
  });

  it('sends "no payer" when the last stream is unticked, so the month is used', async () => {
    const { result } = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.toggleStream('detected:a'));
    await waitFor(() => expect(paycheckCalls()).toContainEqual({ streams: 'none' }));
  });

  it('reads one account, and never none', async () => {
    const { result } = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(result.current.data).not.toBeNull());

    act(() => result.current.toggleWallet('w-2'));
    await waitFor(() => expect(paycheckCalls()).toContainEqual({ walletIds: 'w-1' }));

    apiPut.mockClear();
    apiGet.mockImplementation(async (url: string) =>
      url === '/view-preferences/forecast'
        ? { data: { state: { walletIds: ['w-1'] } } }
        : {
            data: {
              ...plan,
              accounts: plan.accounts.map(account => ({ ...account, selected: account.id === 'w-1' })),
            },
          },
    );
    const second = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(second.result.current.data?.accounts[1].selected).toBe(false));
    act(() => second.result.current.toggleWallet('w-1'));
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('sends the buffer and ignores a saved one the contract would refuse', async () => {
    apiGet.mockImplementation(async (url: string) =>
      url === '/view-preferences/forecast'
        ? { data: { state: { buffer: -5, streams: 'detected:a' } } }
        : { data: plan },
    );
    const { result } = renderHookWithQuery(() => usePaycheckPlan());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(paycheckCalls()).toEqual([{}]);

    act(() => result.current.setBuffer(150.5));
    await waitFor(() => expect(paycheckCalls()).toContainEqual({ buffer: 150.5 }));
  });
});

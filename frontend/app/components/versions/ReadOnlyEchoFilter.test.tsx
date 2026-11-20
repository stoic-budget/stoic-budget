import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountMutations } from '@/app/(main)/accounts/hooks/useAccounts';
import apiClient from '@/app/lib/api';
import { ReadOnlyEchoFilter } from './ReadOnlyEchoFilter';

vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));

const REFUSAL = 'Demo refusal: nothing here can be changed';
const FAILED = 'Could not save the account';
const originalAdapter = apiClient.defaults.adapter;

function refuseWith(code: string): void {
  apiClient.defaults.adapter = (config =>
    Promise.reject({
      config,
      isAxiosError: true,
      response: { status: 403, data: { error: { code, message: REFUSAL } } },
    })) as typeof apiClient.defaults.adapter;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <Toaster />
      <ReadOnlyEchoFilter />
      {children}
    </QueryClientProvider>
  );
}

/** Toasts on screen; react-hot-toast renders each message in a `status` region. */
const visibleToasts = () => screen.queryAllByRole('status');

describe('ReadOnlyEchoFilter', () => {
  beforeEach(() => {
    localStorage.setItem('currentWorkspaceId', 'ws-1');
    // The Toaster asks for reduced motion; jsdom has no matchMedia.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    act(() => toast.remove());
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(['DEMO_READ_ONLY', 'VERSION_READ_ONLY'])(
    'shows a %s refusal once although the caller also reports it',
    async code => {
      refuseWith(code);
      const { result } = renderHook(() => useAccountMutations(FAILED), { wrapper });

      let saved: boolean | undefined;
      await act(async () => {
        saved = await result.current.remove('account-1');
      });

      // The caller's catch ran: it got its answer and the spinner can stop.
      expect(saved).toBe(false);
      expect(result.current.saving).toBe(false);
      // The note and the caller's red copy carry the same words (the server's,
      // or their translation): one of them is left.
      await waitFor(() => expect(visibleToasts()).toHaveLength(1));
    },
  );

  it('keeps an ordinary error toast', async () => {
    apiClient.defaults.adapter = (config =>
      Promise.reject({
        config,
        isAxiosError: true,
        response: { status: 409, data: { error: { message: REFUSAL } } },
      })) as typeof apiClient.defaults.adapter;
    const { result } = renderHook(() => useAccountMutations(FAILED), { wrapper });

    await act(async () => {
      await result.current.remove('account-1');
    });

    await waitFor(() => expect(visibleToasts()).toHaveLength(1));
    expect(visibleToasts()[0].textContent).toBe(REFUSAL);
  });

  it('keeps an error with other words beside the note', async () => {
    refuseWith('DEMO_READ_ONLY');
    render(<div />, { wrapper });

    await act(async () => {
      await apiClient.post('/wallets', {}).catch(() => toast.error(FAILED));
    });

    await waitFor(() => expect(visibleToasts()).toHaveLength(2));
  });
});

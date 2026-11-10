// @vitest-environment jsdom
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthCheck, healthQueue, systemHealth } from '@/app/test/fixtures/contracts';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'admin' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

import { SYSTEM_HEALTH_POLL_MS } from '@/app/hooks/useSystemHealth';
import { SystemHealthBanner } from './SystemHealthBanner';

describe('SystemHealthBanner', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiQueryDecoded.mockReset();
    auth.user = { role: 'admin' };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SystemHealthBanner />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('tells the admin Redis is down and links to the health page', async () => {
    apiQueryDecoded.mockResolvedValue(
      systemHealth({
        level: 'error',
        services: [healthCheck({ key: 'database' }), healthCheck({ key: 'redis', level: 'error', reason: 'unreachable' })],
      }),
    );
    await render();

    expect(apiQueryDecoded).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/system/health',
        contract: 'AdminSystemHealth',
        params: { origin: window.location.origin },
      }),
    );
    expect(container.textContent).toContain('Cannot reach Redis: background jobs are stopped.');
    expect(container.querySelector('a[href="/admin/health"]')?.textContent).toBe('Server health');
  });

  it('names when background jobs stopped', async () => {
    apiQueryDecoded.mockResolvedValue(
      systemHealth({
        level: 'error',
        queues: [
          healthQueue({ name: 'statement-parsing', level: 'error', reason: 'worker_stale', workerSeenAt: '2026-11-10T08:30:00.000Z' }),
        ],
      }),
    );
    await render();

    expect(container.textContent).toMatch(/^Background jobs have not run since .+2026.+\.Server health$/);
  });

  it('shows nothing on a healthy server', async () => {
    apiQueryDecoded.mockResolvedValue(systemHealth());
    await render();

    expect(container.textContent).toBe('');
  });

  it('never asks the server for anyone but its admin', async () => {
    auth.user = { role: 'user' };
    await render();

    expect(apiQueryDecoded).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  describe('polling', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
      apiQueryDecoded.mockResolvedValue(systemHealth());
    });
    afterEach(() => {
      focusManager.setFocused(undefined);
    });

    const renderNow = async () => {
      await act(async () => {
        root.render(
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <SystemHealthBanner />
          </QueryClientProvider>,
        );
        await vi.advanceTimersByTimeAsync(0);
      });
    };
    const wait = (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });

    it('asks again once a minute, not more often', async () => {
      await renderNow();
      expect(apiQueryDecoded).toHaveBeenCalledTimes(1);
      await wait(SYSTEM_HEALTH_POLL_MS - 1000);
      expect(apiQueryDecoded).toHaveBeenCalledTimes(1);
      await wait(1000);
      expect(apiQueryDecoded).toHaveBeenCalledTimes(2);
    });

    const httpError = (status: number) =>
      Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        response: { status, data: {} },
      });

    it('does not keep showing an old healthy answer once the check fails on the server', async () => {
      // With the database down, signing in itself fails: the check answers 500.
      await renderNow();
      expect(container.textContent).toBe('');
      apiQueryDecoded.mockRejectedValue(httpError(500));
      await wait(SYSTEM_HEALTH_POLL_MS);
      // The failed fetch settles over a few ticks; React Query then tells its observers.
      await wait(10);
      expect(apiQueryDecoded).toHaveBeenCalledTimes(2);
      expect(container.textContent).toMatch(
        /^The server could not run its health check: the database may be down\.Server health$/,
      );
    });

    it('stays quiet when the check is refused for the session, not failed', async () => {
      await renderNow();
      apiQueryDecoded.mockRejectedValue(httpError(403));
      await wait(SYSTEM_HEALTH_POLL_MS);
      await wait(10);
      expect(apiQueryDecoded).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe('');
    });

    it('stops asking while the tab is hidden', async () => {
      await renderNow();
      focusManager.setFocused(false);
      await wait(SYSTEM_HEALTH_POLL_MS * 3);
      expect(apiQueryDecoded).toHaveBeenCalledTimes(1);
    });
  });
});

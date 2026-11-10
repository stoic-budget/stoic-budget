// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { healthCheck, healthQueue, systemHealth } from '@/app/test/fixtures/contracts';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'admin' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

import SystemHealthPage from './page';

describe('SystemHealthPage', () => {
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
  });

  const render = async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SystemHealthPage />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  it('lists every check with its level in words and what to do', async () => {
    apiQueryDecoded.mockResolvedValue(
      systemHealth({
        level: 'error',
        services: [healthCheck({ key: 'database' }), healthCheck({ key: 'redis', level: 'error', reason: 'unreachable' })],
        queues: [
          healthQueue({
            name: 'statement-parsing',
            level: 'warning',
            reason: 'latency_high',
            waiting: 4,
            oldestWaitingSeconds: 12 * 60,
          }),
        ],
        config: [
          healthCheck({ key: 'smtp', level: 'off', reason: 'not_configured' }),
          healthCheck({ key: 'push', level: 'error', reason: 'keys_incomplete' }),
          healthCheck({ key: 'backups', level: 'warning', reason: 'low_space', freeBytes: 512 * 1024 ** 2 }),
          healthCheck({ key: 'app_url', level: 'warning', reason: 'mismatch', url: 'https://budget.example.co.il' }),
          healthCheck({ key: 'encryption_key', level: 'warning', reason: 'fallback_jwt' }),
        ],
      }),
    );
    await render();

    const text = container.textContent ?? '';
    expect(text).toContain('Not answering. Check that it is running and that REDIS_URL points to it.');
    expect(text).toContain('statement-parsing');
    expect(text).toContain('Jobs wait 12 minutes before they start.');
    expect(text).toContain('Waiting 4 · scheduled 0 · running 0 · failed 0');
    expect(text).toContain('Set SMTP_HOST and SMTP_FROM.');
    expect(text).toContain('Only one of the two keys is set.');
    expect(text).toContain('Only 512 MB free.');
    expect(text).toContain('Links in mail point to https://budget.example.co.il, but you opened the app at another address.');
    expect(text).toContain('so JWT_SECRET is used');
    // Each level is spelled out, not left to the dot's colour.
    expect(text).toContain('Not working');
    expect(text).toContain('Worth a look');
    expect(text).toContain('Not set up');
  });

  it('says when the last check failed above the earlier answer it still shows', async () => {
    apiQueryDecoded.mockResolvedValueOnce(systemHealth());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <SystemHealthPage />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Services');
    expect(container.textContent).not.toContain('Could not check the server');

    apiQueryDecoded.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status code 500'), {
        isAxiosError: true,
        response: { status: 500, data: {} },
      }),
    );
    await act(async () => {
      await client.refetchQueries();
    });
    // React Query tells its observers on the next tick.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Could not check the server.');
    expect(text).toContain('Services');
  });

  it('asks nothing of the server for anyone but its administrator', async () => {
    auth.user = { role: 'user' };
    await render();

    expect(apiQueryDecoded).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This page is for the server’s administrator only.');
  });
});

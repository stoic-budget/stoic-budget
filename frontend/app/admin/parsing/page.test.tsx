// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParserHealth } from '@/app/lib/contracts';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ user: { role: 'admin' } as { role: string } | null }));

vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));

import ParserHealthPage from './page';

const health: ParserHealth = {
  since: '2026-09-28T00:00:00.000Z',
  banks: [
    {
      bank: 'axis',
      statements: 12,
      needsReview: 3,
      errors: 1,
      declined: 2,
      reasons: [{ code: 'balance_chain', count: 3 }],
      layouts: [
        {
          fingerprint: 'bbbbbbbbbbbb',
          parser: 'AxisParser',
          headings: ['date:date | description:narration | debit:debit | credit:credit'],
          unknownWords: ['narration'],
          statements: 3,
          firstSeen: '2026-10-26T00:00:00.000Z',
          lastSeen: '2026-10-27T00:00:00.000Z',
          isNew: true,
        },
        {
          fingerprint: 'aaaaaaaaaaaa',
          parser: 'AxisParser',
          headings: ['date:date | description:particulars | debit:debit | credit:credit'],
          unknownWords: [],
          statements: 9,
          firstSeen: '2026-03-01T00:00:00.000Z',
          lastSeen: '2026-10-20T00:00:00.000Z',
          isNew: false,
        },
      ],
    },
  ],
};

describe('ParserHealthPage', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiQueryDecoded.mockReset();
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
          <ParserHealthPage />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  };

  const click = async (element: Element | null | undefined) => {
    expect(element).toBeTruthy();
    await act(async () => {
      (element as HTMLElement).click();
    });
  };

  it("lists each bank in a row with what went wrong, and opens its layouts on a click", async () => {
    auth.user = { role: 'admin' };
    apiQueryDecoded.mockResolvedValue(health);
    await render();

    expect(apiQueryDecoded).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/parsing/health', contract: 'ParserHealth' }),
    );
    const row = container.querySelector('button[aria-expanded]');
    // Closed: the bank, its count and its problems in words; no layout details yet.
    expect(row?.textContent).toContain('Axis Bank');
    expect(row?.textContent).toContain('Statements 12');
    expect(row?.textContent).toContain('Failed 1 · Held for review 3 · Declined by its parser 2 · New layout');
    expect(container.textContent).not.toContain('balance_chain');

    await click(row);
    const text = container.textContent ?? '';
    expect(text).toContain('balance_chain · 3');
    expect(text).toContain('AxisParser');
    // Exactly one of the two layouts is marked new (the row's own mark aside).
    expect(container.querySelectorAll('li li').length).toBe(2);
    expect([...container.querySelectorAll('li li')].filter(li => li.textContent?.includes('New layout'))).toHaveLength(1);
    // Headings stay folded until asked for.
    expect(text).not.toContain('description:narration');

    const headingsButtons = [...container.querySelectorAll('li li button')];
    await click(headingsButtons[0]);
    expect(container.textContent).toContain('description:narration');
    expect(container.textContent).toContain('Unknown words: narration');
  });

  it('leads back to the admin page', async () => {
    apiQueryDecoded.mockResolvedValue(health);
    await render();

    const back = container.querySelector('a[href="/admin"]');
    expect(back?.textContent).toBe('Admin panel');
  });

  it('asks nothing of the server for anyone but its administrator', async () => {
    auth.user = { role: 'user' };
    await render();

    expect(apiQueryDecoded).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This page is for the server administrator only.');
  });
});

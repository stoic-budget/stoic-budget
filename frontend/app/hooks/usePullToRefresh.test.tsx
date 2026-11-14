// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePullToRefresh } from './usePullToRefresh';

type PullToRefreshHook = ReturnType<typeof usePullToRefresh>;

let latestHook: {
  handlers: PullToRefreshHook['handlers'];
  isReadyToRefresh: boolean;
  isRefreshing: boolean;
  pullDistance: number;
} | null = null;

type TouchLikeEvent = {
  touches: Array<{ clientX: number; clientY: number }>;
  preventDefault: () => void;
};

function HookProbe({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  latestHook = usePullToRefresh({
    enabled: true,
    threshold: 40,
    maxPull: 100,
    resistance: 1,
    isAtTop: () => true,
    onRefresh,
  });

  return <div data-testid="pull-probe" />;
}

const createTouchEvent = (y: number): TouchLikeEvent => ({
  touches: [{ clientX: 0, clientY: y }],
  preventDefault: () => undefined,
});

describe('usePullToRefresh', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('triggers refresh after crossing threshold', async () => {
    const onRefresh = vi.fn(async () => undefined);
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<HookProbe onRefresh={onRefresh} />);
    });

    expect(latestHook).toBeTruthy();

    await act(async () => {
      latestHook?.handlers.onTouchStart(
        createTouchEvent(0) as unknown as React.TouchEvent<Element>,
      );
      latestHook?.handlers.onTouchMove(
        createTouchEvent(60) as unknown as React.TouchEvent<Element>,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      latestHook?.handlers.onTouchEnd();
      await Promise.resolve();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('takes no pull from a touch in a portal, such as a modal over the page', async () => {
    const onRefresh = vi.fn(async () => undefined);
    const root = createRoot(document.createElement('div'));
    await act(async () => {
      root.render(<HookProbe onRefresh={onRefresh} />);
    });
    const page = document.createElement('div');
    const modal = document.createElement('div');
    const inModal = (y: number) =>
      ({ ...createTouchEvent(y), currentTarget: page, target: modal }) as unknown as React.TouchEvent<Element>;

    await act(async () => {
      latestHook?.handlers.onTouchStart(inModal(0));
      latestHook?.handlers.onTouchMove(inModal(60));
    });
    await act(async () => {
      latestHook?.handlers.onTouchEnd();
      await Promise.resolve();
    });

    expect(latestHook?.pullDistance).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

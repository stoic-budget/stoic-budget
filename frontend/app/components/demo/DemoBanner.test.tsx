import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isDemoInstance, setDemoStatusForTests } from '@/app/hooks/useDemoStatus';
import { DEMO_ABOUT_URL, DemoBanner } from './DemoBanner';

const MESSAGE = 'Sample data, reset nightly';
const ABOUT = 'About the demo';

const query = vi.hoisted(() => ({ decoded: vi.fn() }));

vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded: query.decoded }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({ message: MESSAGE, about: ABOUT }),
}));

describe('DemoBanner', () => {
  beforeEach(() => {
    act(() => setDemoStatusForTests(null));
    query.decoded.mockReset();
    localStorage.clear();
  });
  afterEach(() => {
    act(() => setDemoStatusForTests(null));
  });

  it('asks the server once and shows the strip on a demo', async () => {
    query.decoded.mockResolvedValue({ enabled: true, account: null });
    render(<DemoBanner />);

    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText(ABOUT).getAttribute('href')).toBe(DEMO_ABOUT_URL);
    expect(query.decoded).toHaveBeenCalledTimes(1);
    expect(query.decoded).toHaveBeenCalledWith({ url: '/auth/demo', contract: 'DemoStatus' });
    // Remembered, so the next page load knows before it asks.
    expect(JSON.parse(localStorage.getItem('demo-status') ?? 'null')).toEqual({ enabled: true });
    expect(isDemoInstance()).toBe(true);
  });

  it('shows nothing on an ordinary server', async () => {
    query.decoded.mockResolvedValue({ enabled: false, account: null });
    const { container } = render(<DemoBanner />);

    await waitFor(() => expect(query.decoded).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
    expect(isDemoInstance()).toBe(false);
  });

  it('shows nothing when the server cannot say', async () => {
    query.decoded.mockRejectedValue(new Error('offline'));
    const { container } = render(<DemoBanner />);

    await waitFor(() => expect(query.decoded).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe('');
  });
});

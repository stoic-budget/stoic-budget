import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegistrationCard } from './RegistrationCard';

const { apiGet, apiPut, toastError } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: { get: apiGet, put: apiPut },
}));
vi.mock('react-hot-toast', () => ({ default: { error: toastError } }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    registration: {
      title: Object.assign(['Registration'], { value: 'Registration' }),
      openHint: 'Anyone can sign up',
      closedHint: 'Invitation only',
      saveFailed: { value: 'Could not save' },
    },
  }),
}));

describe('RegistrationCard', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ data: { open: true } });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => {
      root.render(<RegistrationCard />);
    });
    return container.querySelector('input[type="checkbox"]') as HTMLInputElement;
  };

  it('shows the current state and closes sign-up', async () => {
    apiPut.mockResolvedValue({ data: { open: false } });
    const toggle = await render();
    expect(toggle.checked).toBe(true);
    expect(container.textContent).toContain('Anyone can sign up');

    await act(async () => {
      toggle.click();
    });

    expect(apiPut).toHaveBeenCalledWith('/settings/instance/registration', { open: false });
    expect(container.textContent).toContain('Invitation only');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('keeps the state and says so when saving fails', async () => {
    apiPut.mockRejectedValue({ response: { status: 500, data: {} } });
    const toggle = await render();

    await act(async () => {
      toggle.click();
    });

    expect(toastError).toHaveBeenCalledWith('Could not save');
    expect(container.textContent).toContain('Anyone can sign up');
  });
});

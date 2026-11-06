import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAssistantDrawer } from './AiAssistantDrawer';

const CHATGPT = 'https://chatgpt.com/';

const navigation = vi.hoisted(() => ({ pathname: '/dashboard', search: '' }));
const buildPrompt = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<object>()),
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock('./prompt-templates', () => ({
  promptTemplates: [{ key: 'expense-summary', buildPrompt }],
}));

const open = () => render(<AiAssistantDrawer isOpen onClose={vi.fn()} />);
const clickCard = () => fireEvent.click(screen.getByText('Expense Summary'));

describe('AiAssistantDrawer', () => {
  let openWindow: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigation.pathname = '/dashboard';
    navigation.search = '';
    buildPrompt.mockReset().mockResolvedValue('Short prompt');
    openWindow = vi.fn(() => ({ opener: window }));
    vi.stubGlobal('open', openWindow);
    writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
  });

  it('offers the goals and subscriptions prompts next to the others', () => {
    open();

    expect(screen.getByText('Goals & Runway')).toBeInTheDocument();
    expect(screen.getByText('Subscriptions Review')).toBeInTheDocument();
    expect(screen.getByText('Who pays you and who you pay most')).toBeInTheDocument();
    expect(screen.getAllByText('Open in ChatGPT')).toHaveLength(8);
  });

  it('opens a short prompt in the address, cut off from this page', async () => {
    const tab = { opener: window as unknown };
    openWindow.mockReturnValue(tab);
    open();

    clickCard();

    await waitFor(() =>
      expect(openWindow).toHaveBeenCalledWith(`${CHATGPT}?q=Short%20prompt`, '_blank'),
    );
    await waitFor(() => expect(tab.opener).toBeNull());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies a prompt too long for an address, then opens ChatGPT', async () => {
    const long = 'x'.repeat(7000);
    buildPrompt.mockResolvedValue(long);
    open();

    clickCard();

    await waitFor(() => expect(openWindow).toHaveBeenCalledWith(CHATGPT, '_blank'));
    expect(writeText).toHaveBeenCalledWith(long);
    expect(toast.success).toHaveBeenCalled();
  });

  it('offers a second click when the browser refuses the window, and does not rebuild', async () => {
    openWindow.mockReturnValueOnce(null);
    open();

    clickCard();
    expect(await screen.findByText('Ready — click again to open')).toBeInTheDocument();

    clickCard();

    await waitFor(() => expect(openWindow).toHaveBeenCalledTimes(2));
    expect(buildPrompt).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByText('Ready — click again to open')).not.toBeInTheDocument(),
    );
  });

  it('offers a second click when the browser refuses the clipboard, without opening an empty chat', async () => {
    buildPrompt.mockResolvedValue('x'.repeat(7000));
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    open();

    clickCard();

    expect(await screen.findByText('Ready — click again to open')).toBeInTheDocument();
    expect(openWindow).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();

    clickCard();

    await waitFor(() => expect(openWindow).toHaveBeenCalledWith(CHATGPT, '_blank'));
  });

  it('says so when the data cannot be loaded', async () => {
    buildPrompt.mockRejectedValue(new Error('HTTP 500'));
    open();

    clickCard();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('passes the month picked on the dashboard and shows it', async () => {
    navigation.search = 'month=2026-02';
    open();

    expect(screen.getByText(/cover February 2026/)).toBeInTheDocument();
    clickCard();

    await waitFor(() => expect(buildPrompt).toHaveBeenCalled());
    expect(buildPrompt.mock.calls[0][0]).toMatchObject({
      month: '2026-02',
      locale: 'en',
    });
  });

  it('ignores a month parameter that belongs to another page', async () => {
    navigation.pathname = '/goals';
    navigation.search = 'month=2026-02';
    open();

    expect(screen.queryByText(/cover February 2026/)).not.toBeInTheDocument();
    clickCard();

    await waitFor(() => expect(buildPrompt).toHaveBeenCalled());
    expect(buildPrompt.mock.calls[0][0]).toMatchObject({ month: null });
  });
});

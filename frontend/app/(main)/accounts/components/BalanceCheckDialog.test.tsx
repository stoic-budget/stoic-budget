// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BalanceCheckResult } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { parseBankBalance } from '../balance-check-input';
import { AccountBalanceCheckNote } from './AccountReconciliation';
import { BalanceCheckDialog } from './BalanceCheckDialog';

const api = vi.hoisted(() => ({ post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));
vi.mock('@/app/components/ui/modal-shell', () => ({
  ModalShell: ({
    isOpen,
    children,
    footer,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        check: value('Check'),
        book: value('Book the difference'),
        checkLater: value('Check again later'),
        done: value('Done'),
        matchTitle: value('Matches your bank'),
        mismatchTitle: value('Off by {{amount}}'),
        invalidAmount: value('Enter an amount'),
        openReview: value('Open Review'),
        addStatement: value('Add a statement'),
        reasonInReview: value('{{count}} rows wait in Review ({{amount}})'),
        reasonGap: value('No statement covers {{from}} – {{to}}'),
        noReasons: value('No obvious reason'),
        bankBalance: value('bankBalance {{amount}}'),
      }),
  };
});

const account = walletItem({ id: 'w-1', name: 'Everyday', currency: 'EUR' });
const date = '2026-09-10';

const result = (overrides: Partial<BalanceCheckResult>): BalanceCheckResult => ({
  date,
  bankBalance: 150,
  ourBalance: 150,
  difference: 0,
  matches: true,
  reasons: [],
  ...overrides,
});

function open(onClose = vi.fn()) {
  renderWithQuery(<BalanceCheckDialog account={account} open onClose={onClose} />);
  fireEvent.change(screen.getByLabelText('balanceLabel'), { target: { value: '1 250,50' } });
  fireEvent.change(screen.getByLabelText('dateLabel'), { target: { value: date } });
  return onClose;
}

describe('BalanceCheckDialog', () => {
  beforeEach(() => {
    api.post.mockReset();
    toast.success.mockReset();
  });

  it('sends only the bank figure and the day, and remembers a match at once', async () => {
    api.post.mockResolvedValue(apiResponse(result({ bankBalance: 1250.5, ourBalance: 1250.5 })));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText('Matches your bank')).toBeTruthy();
    expect(api.post.mock.calls).toEqual([
      ['/wallets/w-1/balance-check', { date, balance: 1250.5 }],
      ['/wallets/w-1/balance-check/confirm', { date, balance: 1250.5 }],
    ]);
    expect(screen.queryByRole('button', { name: 'Book the difference' })).toBeNull();
  });

  it('refuses what is not an amount without asking the server', () => {
    renderWithQuery(<BalanceCheckDialog account={account} open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('balanceLabel'), { target: { value: '12abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(screen.getByText('Enter an amount')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the difference and its likely reasons, and saves nothing on "check again later"', async () => {
    api.post.mockResolvedValue(
      apiResponse(
        result({
          bankBalance: 1250.5,
          ourBalance: 1262.5,
          difference: -12,
          matches: false,
          reasons: [
            { kind: 'in_review', count: 2, amount: -12 },
            { kind: 'statement_gap', from: '2026-08-01', to: '2026-08-31' },
          ],
        }),
      ),
    );
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByTestId('balance-check-mismatch')).toBeTruthy();
    expect(screen.getByText(/Off by/).textContent).toContain('12.00');
    // What we read from the field, so a misread is seen at once.
    expect(screen.getByText(/^bankBalance/).textContent).toContain('1,250.50');
    expect(screen.getByText(/2 rows wait in Review/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Review' }).getAttribute('href')).toBe('/review');
    expect(screen.getByRole('link', { name: 'Add a statement' }).getAttribute('href')).toBe(
      '/statements',
    );

    // Rows still in Review would count twice once confirmed: nothing to book yet.
    expect(screen.queryByRole('button', { name: 'Book the difference' })).toBeNull();
    expect(screen.getByText('bookBlocked')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Check again later' }));
    expect(onClose).toHaveBeenCalled();
    // Only the read-only check went out: no confirm, no adjustment.
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('books the difference from the bank figure it checked, never a difference of its own', async () => {
    api.post.mockImplementation(async (url: string) =>
      url.endsWith('/balance-adjustment')
        ? apiResponse({ check: result({ bankBalance: 1250.5 }), transactionId: 'tx-1' })
        : apiResponse(result({ bankBalance: 1250.5, difference: -12, matches: false })),
    );
    const onClose = open();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Book the difference' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.post).toHaveBeenLastCalledWith('/wallets/w-1/balance-adjustment', {
      date,
      balance: 1250.5,
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('does not offer to book while rows in another currency have no rate', async () => {
    api.post.mockResolvedValue(
      apiResponse(
        result({
          difference: -12,
          matches: false,
          reasons: [{ kind: 'unconverted', currencies: ['XTS'] }],
        }),
      ),
    );
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(await screen.findByText(/reasonUnconverted/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Book the difference' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Check again later' })).toBeTruthy();
  });

  it('says so when nothing obvious explains the difference', async () => {
    api.post.mockResolvedValue(apiResponse(result({ difference: 3, matches: false })));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('No obvious reason')).toBeTruthy();
  });
});

describe('AccountBalanceCheckNote', () => {
  it('says nothing before the first check', () => {
    renderWithQuery(<AccountBalanceCheckNote account={account} />);
    expect(screen.queryByTestId('balance-check-note')).toBeNull();
  });

  it('says quietly when the books were last checked, and when a later change undid it', () => {
    const checked = { date, bankBalance: 150, stillMatches: true };
    const { rerender } = renderWithQuery(
      <AccountBalanceCheckNote account={{ ...account, balanceCheck: checked }} />,
    );
    expect(screen.getByTestId('balance-check-note').textContent).toBe('checkedNote');
    rerender(
      <AccountBalanceCheckNote
        account={{ ...account, balanceCheck: { ...checked, stillMatches: false } }}
      />,
    );
    expect(screen.getByTestId('balance-check-note').textContent).toBe('checkedStale');
  });
});

describe('parseBankBalance', () => {
  it.each([
    ['1234.56', 1234.56],
    ['1234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,56', 1234.56],
    ['1 234,56', 1234.56],
    ['1\u00a0234,5', 1234.5],
    ['1,234', 1234],
    ['1.234', 1234],
    ['-1,000', -1000],
    ['−8,2', -8.2],
    ['1,234,567.89', 1234567.89],
    ['0,5', 0.5],
    ['9999999999999.99', 9999999999999.99],
  ])('reads %s as %d', (typed, expected) => {
    expect(parseBankBalance(typed, false)).toBe(expected);
  });

  it.each([
    '',
    '12abc',
    '1,2,3',
    '12.34.5',
    '1,23,456',
    '1.234.56',
    '1,234,56',
    '12 34',
    '1234,567',
    '.5',
    '1.',
    '10000000000000',
  ])('refuses %j rather than guessing', typed => {
    expect(parseBankBalance(typed, false)).toBeNull();
  });

  it('keeps a debt below zero, as the person types what is owed', () => {
    expect(parseBankBalance('300', true)).toBe(-300);
  });
});

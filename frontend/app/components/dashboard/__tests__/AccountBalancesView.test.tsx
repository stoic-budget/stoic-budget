// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import type { WalletBalanceDays } from '@/app/lib/contracts';
import { AccountBalancesView } from '../AccountBalancesView';
import { value } from './intlayer-mock';
import { wholeLine } from './whole-line';

const chartProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const balancesMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/useDashboard', () => ({ useAccountBalanceDays: balancesMock }));
vi.mock('next/dynamic', () => ({
  default: () => (props: Record<string, unknown>) => {
    chartProps(props);
    return React.createElement('div', { 'data-testid': 'lines' });
  },
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    empty: value('No cash flow data yet'),
    accountsEmpty: value('Add an account to see its balance day by day'),
    viewChart: value('Accounts'),
    today: value('today'),
    total: value('Total'),
    other: value('Other'),
    missingRates: value('No exchange rate for {{currencies}}'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const EVERYDAY = { id: 'everyday', name: 'Everyday Account', type: 'checking' as const, currency: 'EUR' };
const CARD = { id: 'card', name: 'Card One', type: 'credit_card' as const, currency: 'EUR' };
const EVERYDAY_BALANCE = 500;
const CARD_BALANCE = -120;

function july(overrides: Partial<WalletBalanceDays> = {}): WalletBalanceDays {
  return {
    currency: 'EUR',
    accounts: [EVERYDAY, CARD],
    days: ['2026-07-01', '2026-07-02', '2026-07-03'].map(date => ({
      date,
      balances: { [EVERYDAY.id]: EVERYDAY_BALANCE, [CARD.id]: CARD_BALANCE },
    })),
    unconverted: [],
    ...overrides,
  };
}

const lastChart = () => chartProps.mock.calls.at(-1)?.[0] ?? {};

describe('AccountBalancesView', () => {
  beforeEach(() => {
    chartProps.mockClear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 2, 12));
  });
  afterEach(() => vi.useRealTimers());

  it("totals today's balances and draws a line per account, ending today", () => {
    balancesMock.mockReturnValue({ data: july(), isError: false });

    render(<AccountBalancesView month="2026-07" formatAmount={v => `€${v}`} />);

    expect(screen.getByText(`€${EVERYDAY_BALANCE + CARD_BALANCE}`)).toBeInTheDocument();
    expect(screen.getByText(wholeLine(`Card One −€${-CARD_BALANCE}`))).toBeInTheDocument();
    const { lines, rows, today } = lastChart() as {
      lines: Array<{ key: string }>;
      rows: Array<Record<string, unknown>>;
      today: string | null;
    };
    expect(lines.map(line => line.key)).toEqual([EVERYDAY.id, CARD.id]);
    expect(today).toBe('2026-07-02');
    expect(rows.map(row => row[EVERYDAY.id])).toEqual([EVERYDAY_BALANCE, EVERYDAY_BALANCE, null]);
  });

  it('hides an account when its legend entry is clicked, and leaves it out of the total', () => {
    balancesMock.mockReturnValue({ data: july(), isError: false });
    const { container } = render(
      <AccountBalancesView month="2026-07" formatAmount={v => `€${v}`} />,
    );

    const card = screen.getByRole('button', { name: /Card One/ });
    fireEvent.click(card);

    expect(card).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.seneca-chart__total')?.textContent).toBe(
      `€${EVERYDAY_BALANCE}`,
    );
    const { lines } = lastChart() as { lines: Array<{ key: string }> };
    expect(lines.map(line => line.key)).toEqual([EVERYDAY.id]);

    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks no today in a past month, whose lines run to its end', () => {
    balancesMock.mockReturnValue({
      data: july({ days: [{ date: '2026-06-30', balances: { [EVERYDAY.id]: 1, [CARD.id]: 2 } }] }),
      isError: false,
    });

    render(<AccountBalancesView month="2026-06" formatAmount={String} />);

    expect(lastChart()).toMatchObject({ today: null });
  });

  it('asks for an account when there is none', () => {
    balancesMock.mockReturnValue({ data: july({ accounts: [], days: [] }), isError: false });

    render(<AccountBalancesView month="2026-07" formatAmount={String} />);

    expect(screen.getByText('Add an account to see its balance day by day')).toBeInTheDocument();
    expect(screen.queryByTestId('lines')).toBeNull();
  });

  it('gives an account with no rate all month no figure rather than a zero', () => {
    const DOLLAR = { id: 'dollar', name: 'Dollar Account', type: 'checking' as const, currency: 'ZZX' };
    const days = july().days.map(day => ({ ...day, balances: { ...day.balances, [DOLLAR.id]: null } }));
    balancesMock.mockReturnValue({
      data: july({ accounts: [EVERYDAY, CARD, DOLLAR], days, unconverted: ['ZZX'] }),
      isError: false,
    });

    render(<AccountBalancesView month="2026-07" formatAmount={v => `€${v}`} />);

    expect(screen.getByRole('button', { name: /Dollar Account/ })).toHaveTextContent(
      'Dollar Account —',
    );
  });

  it('names the currencies it had no rate for', () => {
    balancesMock.mockReturnValue({ data: july({ unconverted: ['ZZX'] }), isError: false });

    render(<AccountBalancesView month="2026-07" formatAmount={String} />);

    expect(screen.getByText('No exchange rate for ZZX')).toBeInTheDocument();
  });
});

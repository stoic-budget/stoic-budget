import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaycheckPlanResponse } from '../hooks/usePaycheckPlan';
import { parseBuffer } from './PaycheckControls';
import { PaycheckPlanner } from './PaycheckPlanner';

const hook = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  toggleStream: vi.fn(),
  toggleWallet: vi.fn(),
  setBuffer: vi.fn(),
}));

vi.mock('../hooks/usePaycheckPlan', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/usePaycheckPlan')>()),
  usePaycheckPlan: () => hook.state,
}));

const SALARY = 'ACME Payroll';
const RENT = 'ACME Rent';

const plan: PaycheckPlanResponse = {
  currency: 'USD',
  today: '2026-11-09',
  basis: 'paydays',
  incomeStatus: 'regular',
  buffer: 100,
  streams: [
    {
      id: 'detected:a',
      label: SALARY,
      kind: 'detected',
      amount: 3000,
      cadence: 'monthly',
      nextDate: '2026-11-25',
      selected: true,
    },
  ],
  accounts: [
    { id: 'w-1', name: 'Checking', currency: 'USD', balance: 900, selected: true },
    { id: 'w-2', name: 'Cash box', currency: 'USD', balance: 100, selected: true },
  ],
  rates: [{ currency: 'EUR', rate: 1.08, rateDate: '2026-11-09' }],
  periods: [
    {
      start: '2026-10-25',
      end: '2026-11-24',
      nextPayday: '2026-11-25',
      daysLeft: 16,
      startingCash: 1000,
      startingCashProjected: false,
      income: 0,
      commitments: 500,
      safeToSpend: 400,
      safeToSpendPerDay: 25,
      items: [
        {
          date: '2026-11-12',
          label: RENT,
          amount: -500,
          kind: 'payable',
          sourceId: 'p-1',
          isOverdue: false,
          streamId: null,
        },
      ],
    },
    {
      start: '2026-11-25',
      end: '2026-12-24',
      nextPayday: '2026-12-25',
      daysLeft: 30,
      startingCash: 100,
      startingCashProjected: true,
      income: 3000,
      commitments: 3500,
      safeToSpend: -500,
      safeToSpendPerDay: 0,
      items: [
        {
          date: '2026-11-25',
          label: SALARY,
          amount: 3000,
          kind: 'income',
          sourceId: 'detected:a:2026-11-25',
          isOverdue: false,
          streamId: 'detected:a',
        },
      ],
    },
  ],
};

const setPlan = (overrides: Partial<PaycheckPlanResponse> = {}) => {
  hook.state = {
    data: { ...plan, ...overrides },
    isPending: false,
    isFetching: false,
    isError: false,
    buffer: 100,
    toggleStream: hook.toggleStream,
    toggleWallet: hook.toggleWallet,
    setBuffer: hook.setBuffer,
  };
};

describe('PaycheckPlanner', () => {
  beforeEach(() => {
    hook.toggleStream.mockReset();
    hook.toggleWallet.mockReset();
    hook.setBuffer.mockReset();
  });

  it('lists the periods with safe to spend, the current one open on what is due', () => {
    setPlan();
    render(<PaycheckPlanner />);

    const [current, next] = screen.getAllByRole('button', { expanded: undefined }).filter(button =>
      button.hasAttribute('aria-expanded'),
    );
    expect(current).toHaveAttribute('aria-expanded', 'true');
    expect(within(current).getByText(/\$400/)).toBeInTheDocument();
    expect(within(current).getByText(/\$25 a day/)).toBeInTheDocument();
    expect(screen.getByText(RENT)).toBeInTheDocument();
    // The next period is short, said in words, and opens on a click.
    expect(next).toHaveAttribute('aria-expanded', 'false');
    expect(within(next).getByText(/Short by \$500/)).toBeInTheDocument();
    fireEvent.click(next);
    expect(screen.getByText('Cash at the start, projected')).toBeInTheDocument();
    expect(screen.getByText(/1 EUR = 1.08 USD/)).toBeInTheDocument();
  });

  it('toggles a payer and an account', () => {
    setPlan();
    render(<PaycheckPlanner />);
    fireEvent.click(screen.getByText(/ACME Payroll · monthly/));
    expect(hook.toggleStream).toHaveBeenCalledWith('detected:a');
    fireEvent.click(screen.getByText('Cash box'));
    expect(hook.toggleWallet).toHaveBeenCalledWith('w-2');
  });

  it('explains month periods without income and links to the month setting', () => {
    setPlan({ basis: 'month', incomeStatus: 'none', streams: [] });
    render(<PaycheckPlanner />);
    expect(screen.getByText(/No regular income found yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose when your month starts' })).toHaveAttribute(
      'href',
      '/settings/profile?tab=data&section=month-start',
    );
  });

  it('says irregular income apart from a payer left unpicked', () => {
    setPlan({ basis: 'month', incomeStatus: 'irregular', streams: [] });
    const { unmount } = render(<PaycheckPlanner />);
    expect(screen.getByText(/does not come on a regular schedule/)).toBeInTheDocument();
    unmount();
    setPlan({ basis: 'month', streams: plan.streams.map(stream => ({ ...stream, selected: false })) });
    render(<PaycheckPlanner />);
    expect(screen.getByText(/No payer picked/)).toBeInTheDocument();
  });

  it('commits a valid buffer on Enter and puts back one the contract would refuse', () => {
    setPlan();
    render(<PaycheckPlanner />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '250,5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(hook.setBuffer).toHaveBeenCalledWith(250.5);

    fireEvent.change(input, { target: { value: '-3' } });
    fireEvent.blur(input);
    expect(hook.setBuffer).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('100');
  });
});

describe('parseBuffer', () => {
  it('takes what the contract takes: 0 to 10¹², decimals with either mark', () => {
    expect(parseBuffer('')).toBe(0);
    expect(parseBuffer('8.2')).toBe(8.2);
    expect(parseBuffer('1 000,25')).toBe(1000.25);
    expect(parseBuffer('1000000000000')).toBe(1e12);
    expect(parseBuffer('1000000000001')).toBeNull();
    expect(parseBuffer('-1')).toBeNull();
    expect(parseBuffer('abc')).toBeNull();
  });
});

// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { CashFlowCard } from '../CashFlowCard';
import { wholeLine } from './whole-line';

const accountsProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());
const entriesMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/hooks/useDashboard', () => ({ useCashFlowEntries: entriesMock }));
const flowProps = vi.hoisted(() => vi.fn());
vi.mock('../CashFlowFlow', () => ({
  CashFlowFlow: (props: Record<string, unknown>) => {
    flowProps(props);
    return React.createElement('div', { 'data-testid': 'flow' });
  },
}));

vi.mock('../AccountBalancesView', () => ({
  AccountBalancesView: (props: Record<string, unknown>) => {
    accountsProps(props);
    return React.createElement('div', { 'data-testid': 'accounts-view' });
  },
}));

// Mirrors react-intlayer's renderIntlayerNode: usable as a JSX child and via `.value`.
const value = (v: string) =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') return v;
      return Reflect.get(target, prop, receiver);
    },
  });

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    title: value('Cash flow'),
    empty: value('No cash flow data yet'),
    income: value('Income'),
    expense: value('Expense'),
    budgeted: value('Budgeted'),
    viewChart: value('Accounts'),
    viewCalendar: value('Calendar'),
    viewLabel: value('View'),
    viewFlow: value('Flow'),
    viewAll: value('View all'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const day = (date: string, income: number, expense: number, budgeted = 0) => ({
  date,
  income,
  expense,
  budgeted,
});

describe('CashFlowCard', () => {
  beforeEach(() => {
    accountsProps.mockClear();
    entriesMock.mockReset();
    entriesMock.mockReturnValue(undefined);
    window.localStorage.clear();
  });

  it("shows the accounts' balances for the picked month, linking to Accounts", () => {
    window.localStorage.setItem('seneca.cashFlowView', 'chart');
    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 900, 100)]}
      />,
    );

    expect(screen.getByTestId('accounts-view')).toBeInTheDocument();
    expect(accountsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ month: '2026-07' }),
    );
    expect(screen.getByText('View all').closest('a')).toHaveAttribute('href', '/accounts');
    // The month's income and spending belong to the other views.
    expect(screen.queryByText(/Income/)).toBeNull();
  });

  it('shows the accounts even in a month with no money in or out', () => {
    window.localStorage.setItem('seneca.cashFlowView', 'chart');
    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 0, 0)]}
      />,
    );

    expect(screen.getByTestId('accounts-view')).toBeInTheDocument();
    expect(screen.queryByText('No cash flow data yet')).toBeNull();
  });

  it('offers no period switch, only the accounts, calendar and flow views', () => {
    render(
      <CashFlowCard
        formatAmount={String}
        activeMonth="2026-07"
        days={[day('2026-07-01', 1, 0)]}
      />,
    );

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Accounts',
      'Calendar',
      'Flow',
    ]);
  });

  describe('headline of the calendar and flow', () => {
    beforeEach(() => window.localStorage.setItem('seneca.cashFlowView', 'calendar'));

    it("sums the picked month's days", () => {
      const days = [day('2026-07-01', 900, 100), day('2026-07-02', 0, 0), day('2026-07-03', 80, 468)];

      render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-07" days={days} />);

      expect(screen.getByText('Jul 2026')).toBeInTheDocument();
      expect(screen.getByText('$412')).toBeInTheDocument();
      expect(screen.getByText(wholeLine('Income $980'))).toBeInTheDocument();
      expect(screen.getByText(wholeLine('Expense $568'))).toBeInTheDocument();
    });

    it("sums the month's budgeted spending", () => {
      const days = [day('2026-10-03', 0, 60, 60), day('2026-10-09', 0, 70, 40), day('2026-10-12', 0, 20)];

      render(<CashFlowCard formatAmount={v => `$${v}`} activeMonth="2026-10" days={days} />);

      expect(screen.getByText(wholeLine('Expense $150'))).toBeInTheDocument();
      expect(screen.getByText(wholeLine('Budgeted $100'))).toBeInTheDocument();
    });

    it('leaves Budgeted out when no budget covered any spending', () => {
      render(
        <CashFlowCard
          formatAmount={v => `$${v}`}
          activeMonth="2026-10"
          days={[day('2026-10-03', 0, 60)]}
        />,
      );

      expect(screen.queryByText(/Budgeted/)).not.toBeInTheDocument();
    });

    it('shows a loss with a typographic minus', () => {
      render(
        <CashFlowCard
          formatAmount={v => `$${v}`}
          activeMonth="2026-07"
          days={[day('2026-07-05', 100, 250)]}
        />,
      );

      expect(screen.getByText('−$150')).toBeInTheDocument();
    });

    it('shows the empty state when the month has no money in or out', () => {
      const { container } = render(
        <CashFlowCard
          formatAmount={v => `$${v}`}
          activeMonth="2026-07"
          days={[day('2026-07-01', 0, 0), day('2026-07-02', 0, 0)]}
        />,
      );

      expect(container.querySelector('.seneca-chart__total')?.textContent).toBe('$0');
      expect(screen.getByText('No cash flow data yet')).toBeInTheDocument();
    });
  });

  describe('calendar view', () => {
    beforeEach(() => window.localStorage.clear());

    const days = [day('2026-07-01', 900, 4.5), day('2026-07-02', 0, 0), day('2026-07-03', 0, 468)];

    it('lays the same days out as a month, spending and income in each cell', () => {
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

      expect(screen.queryByTestId('accounts-view')).toBeNull();
      const first = screen.getByRole('button', { name: 'July 1, −4.5, +900' });
      expect(first).toHaveTextContent('4.5');
      expect(first).toHaveTextContent('+900');
      // A day without money is only its number, and opens nothing.
      expect(screen.getByRole('button', { name: 'July 2' })).toBeDisabled();
    });

    it("opens a day's rows under the grid and closes them on a second click", () => {
      const rent = { date: '2026-07-03', name: 'Example Rentals', kind: 'expense', amount: 468, budgeted: 0 };
      entriesMock.mockReturnValue([rent]);
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

      const third = screen.getByRole('button', { name: 'July 3, −468' });
      fireEvent.click(third);
      expect(third).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Example Rentals')).toBeInTheDocument();
      expect(screen.getByText('−468')).toBeInTheDocument();

      fireEvent.click(third);
      expect(screen.queryByText('Example Rentals')).toBeNull();
    });

    it("links a day's row to where it came from, and leaves one with nowhere to go plain", () => {
      const statementHref = '/statements/statement-1/edit';
      const rent = {
        date: '2026-07-03',
        name: 'Example Rentals',
        kind: 'expense',
        amount: 468,
        budgeted: 0,
        href: statementHref,
      };
      const cash = { date: '2026-07-03', name: 'ACME Kiosk', kind: 'expense', amount: 3, budgeted: 0, href: null };
      entriesMock.mockReturnValue([rent, cash]);
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
      fireEvent.click(screen.getByRole('button', { name: 'July 3, −468' }));

      expect(screen.getByRole('link', { name: /Example Rentals/ })).toHaveAttribute(
        'href',
        expect.stringContaining(statementHref),
      );
      expect(screen.getByText('ACME Kiosk').closest('a')).toBeNull();
    });

    it('remembers the view in this browser', () => {
      const { unmount } = render(
        <CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />,
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
      unmount();

      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(screen.queryByTestId('accounts-view')).toBeNull();
    });

    describe('on a phone', () => {
      beforeEach(() => {
        vi.stubGlobal(
          'matchMedia',
          vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          })),
        );
      });
      afterEach(() => vi.unstubAllGlobals());

      it('opens on the calendar when no view was picked', () => {
        render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);

        expect(screen.getByRole('tab', { name: 'Calendar' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        expect(screen.queryByTestId('accounts-view')).toBeNull();
      });

      it('keeps the view the reader picked', () => {
        window.localStorage.setItem('seneca.cashFlowView', 'chart');
        render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);

        expect(screen.getByRole('tab', { name: 'Accounts' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
        expect(screen.getByTestId('accounts-view')).toBeInTheDocument();
      });
    });

    it('opens on the flow on a wider screen when no view was picked', () => {
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);

      expect(screen.getByRole('tab', { name: 'Flow' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('flow')).toBeInTheDocument();
    });
  });

  describe('flow view', () => {
    beforeEach(() => {
      window.localStorage.clear();
      flowProps.mockClear();
    });

    const days = [day('2026-07-01', 900, 4.5)];

    it('asks for the flow only once shown, and links to the same month in Reports', () => {
      window.localStorage.setItem('seneca.cashFlowView', 'chart');
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(flowProps).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

      expect(screen.getByTestId('flow')).toBeInTheDocument();
      expect(screen.queryByTestId('accounts-view')).toBeNull();
      expect(flowProps).toHaveBeenLastCalledWith(expect.objectContaining({ month: '2026-07' }));
      expect(screen.getByText('View all').closest('a')).toHaveAttribute(
        'href',
        '/reports?tab=cash-flow&from=2026-07-01&to=2026-07-31',
      );
    });

    it('comes back as the remembered view', () => {
      window.localStorage.setItem('seneca.cashFlowView', 'flow');
      render(<CashFlowCard formatAmount={String} activeMonth="2026-07" days={days} />);
      expect(screen.getByTestId('flow')).toBeInTheDocument();
    });
  });
});

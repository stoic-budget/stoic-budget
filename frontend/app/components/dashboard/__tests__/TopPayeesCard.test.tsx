// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { TopPayeesCard } from '../TopPayeesCard';
import { value } from './intlayer-mock';

const overviewMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/components/payees/usePayees', () => ({ usePayeesOverview: overviewMock }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    empty: value('No payments to payees this month'),
    missingRates: value('No exchange rate for {{currencies}}'),
    operations: value('Operations'),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const MONTH = '2026-07';
const RENT = { id: 'payee-rent', name: 'ACME Rentals', count: 1, amount: 1100 };
const GROCER = { id: 'payee-grocer', name: 'ACME Grocer', count: 6, amount: 410 };
const KIOSK = { id: 'payee-kiosk', name: 'ACME Kiosk', count: 1, amount: 4 };
const TOTAL = 2000;

function overview(rows: Array<typeof RENT>, missingRates: string[] = []) {
  return {
    isPending: false,
    isError: false,
    data: {
      currency: 'USD',
      rows: rows.map(row => ({ ...row, mode: 'auto', category: null, lastSeen: `${MONTH}-03` })),
      totalPayees: rows.length,
      totalAmount: TOTAL,
      months: [],
      missingRates,
    },
  };
}

describe('TopPayeesCard', () => {
  beforeEach(() => overviewMock.mockReset());

  it("asks for the month's five biggest payees of spending", () => {
    overviewMock.mockReturnValue(overview([RENT]));

    render(<TopPayeesCard month={MONTH} formatAmount={v => `$${v}`} />);

    expect(overviewMock).toHaveBeenCalledWith(
      expect.objectContaining({ month: MONTH, direction: 'expense', page: 1, limit: 5 }),
    );
  });

  it('lists each payee with its payments, share of the month and amount, linking to its page', () => {
    overviewMock.mockReturnValue(overview([RENT, GROCER, KIOSK]));

    render(<TopPayeesCard month={MONTH} formatAmount={v => `$${v}`} />);

    const links = screen.getAllByRole('link');
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      `/statements/payees/${RENT.id}`,
      `/statements/payees/${GROCER.id}`,
      `/statements/payees/${KIOSK.id}`,
    ]);
    expect(links[0]).toHaveTextContent(RENT.name);
    expect(links[0]).toHaveTextContent(`Operations: ${RENT.count}`);
    expect(links[0]).toHaveTextContent(`${Math.round((RENT.amount / TOTAL) * 100)}%`);
    expect(links[0]).toHaveTextContent(`$${RENT.amount}`);
    // A sliver of the month reads as under one percent, not as nothing.
    expect(links[2]).toHaveTextContent('<1%');
  });

  it('says so when nothing was paid to a payee this month', () => {
    overviewMock.mockReturnValue(overview([]));

    render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(screen.getByText('No payments to payees this month')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('names the currencies it had no rate for', () => {
    overviewMock.mockReturnValue(overview([RENT], ['ZZX']));

    render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(screen.getByText('No exchange rate for ZZX')).toBeInTheDocument();
  });
});

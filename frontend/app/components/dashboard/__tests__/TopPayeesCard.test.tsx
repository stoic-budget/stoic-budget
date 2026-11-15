// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { SectionSpanProvider } from '../section-span';
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

function overview(
  rows: Array<typeof RENT & { vendorDomain?: string | null }>,
  missingRates: string[] = [],
) {
  return {
    isPending: false,
    isError: false,
    data: {
      currency: 'USD',
      rows: rows.map(row => ({
        vendorDomain: null,
        ...row,
        mode: 'auto',
        category: null,
        lastSeen: `${MONTH}-03`,
      })),
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

  it('shows a placeholder list while the month loads', () => {
    overviewMock.mockReturnValue({ isPending: true, isError: false, data: undefined });

    const { container } = render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('No payments to payees this month')).toBeNull();
  });

  it('keeps the list it has when a refetch fails', () => {
    overviewMock.mockReturnValue({ ...overview([RENT]), isError: true });

    render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(screen.getByText(RENT.name)).toBeInTheDocument();
    expect(screen.queryByText('No payments to payees this month')).toBeNull();
  });

  it('says nothing was paid when the first load fails', () => {
    overviewMock.mockReturnValue({ isPending: false, isError: true, data: undefined });

    render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(screen.getByText('No payments to payees this month')).toBeInTheDocument();
  });

  it('runs the list in two columns with the row to itself, in one otherwise', () => {
    overviewMock.mockReturnValue(overview([RENT, GROCER]));
    const columns = () => document.querySelector('.seneca-dashboard__list--columns');

    const { unmount } = render(
      <SectionSpanProvider value={12}>
        <TopPayeesCard month={MONTH} formatAmount={String} />
      </SectionSpanProvider>,
    );
    expect(columns()).not.toBeNull();
    unmount();

    render(
      <SectionSpanProvider value={6}>
        <TopPayeesCard month={MONTH} formatAmount={String} />
      </SectionSpanProvider>,
    );
    expect(columns()).toBeNull();
  });

  it("shows a payee's own website mark when it has one", () => {
    const domain = 'acme-rentals.example';
    overviewMock.mockReturnValue(overview([{ ...RENT, vendorDomain: domain }]));

    const { container } = render(<TopPayeesCard month={MONTH} formatAmount={String} />);

    expect(container.querySelector('img')?.getAttribute('src')).toContain(`/vendor-icons/${domain}`);
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

// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import type { CoverageRow } from '../data-coverage';
import { DataCoverageCard } from '../DataCoverageCard';
import { value } from './intlayer-mock';

const coverageMock = vi.hoisted(() => vi.fn());
const todayNote = vi.hoisted(() => ({ current: null as string | null }));
const UNNAMED_BANK = vi.hoisted(() => 'Some bank');

vi.mock('@/app/hooks/useDashboard', () => ({ useWalletCoverage: coverageMock }));
vi.mock('../overview-month', async importOriginal => ({
  ...(await importOriginal<typeof import('../overview-month')>()),
  useTodayNote: () => todayNote.current,
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    title: value('Data freshness'),
    dataTo: value('Data to {{date}}'),
    behind: value('No statement for {{month}}'),
    differs: value('Differs from the statement by {{amount}}'),
    waitingOne: value('{{count}} row in Review'),
    waitingFew: value('{{count}} rows in Review'),
    waitingMany: value('{{count}} rows in Review'),
    upToDate: value('Up to date'),
    lastStatement: value('Last statement: {{month}}'),
    inactiveOne: value('{{count}} inactive account'),
    inactiveFew: value('{{count}} inactive accounts'),
    inactiveMany: value('{{count}} inactive accounts'),
    viewAll: value('View all'),
    bank: value(UNNAMED_BANK),
  }),
  useLocale: () => ({ locale: 'en' }),
}));

const EVERYDAY: CoverageRow = {
  kind: 'account',
  walletId: 'w-everyday',
  name: 'Everyday Account',
  bankName: 'ACME Bank',
  accountTail: null,
  dataTo: '2026-11-11',
  pendingReview: 0,
  currency: 'EUR',
  reconciliation: null,
};
const CARD: CoverageRow = { ...EVERYDAY, walletId: 'w-card', name: 'Card One', dataTo: '2026-09-28' };
const BANK: CoverageRow = {
  ...EVERYDAY,
  kind: 'bank',
  walletId: null,
  name: null,
  bankName: 'ACME Savings',
  accountTail: '0042',
  pendingReview: 3,
  currency: null,
};

describe('DataCoverageCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 14, 12));
    todayNote.current = null;
    coverageMock.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  const listed = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.seneca-dashboard__list a'));

  it('says one thing of each account, what it needs or else how far it reaches, the one behind first', () => {
    coverageMock.mockReturnValue({ data: { rows: [EVERYDAY, BANK, CARD] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    const rows = listed(container);
    expect(rows.map(link => link.getAttribute('href'))).toEqual([
      `/accounts/${CARD.walletId}`,
      '/accounts',
      `/accounts/${EVERYDAY.walletId}`,
    ]);
    expect(rows[0]).toHaveTextContent('Card One');
    expect(rows[0]).toHaveTextContent('No statement for October');
    expect(rows[0]).not.toHaveTextContent('Data to');
    expect(rows[1]).toHaveTextContent(`••${BANK.accountTail}`);
    expect(rows[1]).toHaveTextContent('3 rows in Review');
    expect(rows[1]).not.toHaveTextContent('Data to');
    expect(rows[2]).toHaveTextContent('Data to Nov 11');
    expect(container.querySelectorAll('.seneca-dashboard__stat-dot')).toHaveLength(1);
  });

  it('counts the accounts silent for months instead of listing them', () => {
    const closed: CoverageRow = {
      ...EVERYDAY,
      walletId: 'w-closed',
      name: 'Closed Account',
      dataTo: '2026-03-31',
    };
    const oldBank: CoverageRow = { ...BANK, accountTail: '0099', dataTo: '2017-09-07' };
    coverageMock.mockReturnValue({
      data: { rows: [EVERYDAY, closed, oldBank] },
      isPending: false,
    });

    const { container } = render(<DataCoverageCard />);

    const rows = listed(container);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(EVERYDAY.name ?? '');
    expect(rows[1]).toHaveAttribute('href', '/accounts');
    expect(rows[1]).toHaveTextContent('2 inactive accounts');
    expect(screen.queryByText(closed.name ?? '')).not.toBeInTheDocument();
    expect(screen.queryByText(/Last statement/)).not.toBeInTheDocument();
  });

  it('says how far the data reaches when every account is inactive', () => {
    const lastKept: CoverageRow = { ...EVERYDAY, dataTo: '2025-02-28' };
    const older: CoverageRow = { ...BANK, dataTo: '2017-09-07' };
    coverageMock.mockReturnValue({ data: { rows: [older, lastKept] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    expect(screen.getByText('Last statement: February 2025')).toBeInTheDocument();
    expect(listed(container).map(link => link.textContent)).toEqual(['2 inactive accounts']);
  });

  it('lists five accounts at most, the ones that need something first', () => {
    const fine = Array.from({ length: 6 }, (_, index) => ({
      ...EVERYDAY,
      walletId: `w-${index}`,
      name: `Account ${index}`,
    }));
    coverageMock.mockReturnValue({ data: { rows: [...fine, CARD] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    const rows = listed(container);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent(CARD.name ?? '');
  });

  it("names a bank its statements do not name in the reader's language", () => {
    const unnamed: CoverageRow = { ...BANK, bankName: 'other', accountTail: '0001', pendingReview: 0 };
    coverageMock.mockReturnValue({ data: { rows: [unnamed] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    expect(listed(container)[0]).toHaveTextContent(`${UNNAMED_BANK} ••${unnamed.accountTail}`);
  });

  it('names how far a balance is off its statement', () => {
    coverageMock.mockReturnValue({
      data: {
        rows: [
          {
            ...EVERYDAY,
            reconciliation: {
              statementId: 'st-1',
              date: '2026-10-31',
              statementBalance: 120,
              computedBalance: 108,
              matches: false,
            },
          },
        ],
      },
      isPending: false,
    });

    render(<DataCoverageCard />);

    expect(screen.getByRole('link', { name: /Everyday Account/ })).toHaveTextContent(
      /Differs from the statement by .*12/,
    );
  });

  it('is left out when there is no bank statement at all', () => {
    coverageMock.mockReturnValue({ data: { rows: [] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says it tells today while another month is shown', () => {
    todayNote.current = 'Today';
    coverageMock.mockReturnValue({ data: { rows: [EVERYDAY] }, isPending: false });

    render(<DataCoverageCard />);

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});

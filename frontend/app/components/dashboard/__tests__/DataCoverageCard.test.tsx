// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import type { CoverageRow } from '../data-coverage';
import { DataCoverageCard } from '../DataCoverageCard';
import { value } from './intlayer-mock';

const coverageMock = vi.hoisted(() => vi.fn());
const todayNote = vi.hoisted(() => ({ current: null as string | null }));

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
    viewAll: value('View all'),
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

  it('lists each account with how far its data reaches and what it needs, the one behind first', () => {
    coverageMock.mockReturnValue({ data: { rows: [EVERYDAY, BANK, CARD] }, isPending: false });

    const { container } = render(<DataCoverageCard />);

    const rows = Array.from(container.querySelectorAll('.seneca-dashboard__list a'));
    expect(rows.map(link => link.getAttribute('href'))).toEqual([
      `/accounts/${CARD.walletId}`,
      '/accounts',
      `/accounts/${EVERYDAY.walletId}`,
    ]);
    expect(rows[0]).toHaveTextContent('Card One');
    expect(rows[0]).toHaveTextContent('No statement for October');
    expect(rows[1]).toHaveTextContent(`••${BANK.accountTail}`);
    expect(rows[1]).toHaveTextContent('3 rows in Review');
    expect(rows[2]).toHaveTextContent('Data to Nov 11');
    expect(rows[2]).toHaveTextContent('Up to date');
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

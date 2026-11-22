// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatementCoverage } from '@/app/lib/contracts';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { AccountCoverageCard } from './AccountCoverageCard';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const importButton = vi.hoisted(() => vi.fn());
const openImport = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/components/import-wizard/ImportFromFileButton', () => ({
  ImportFromFileButton: (props: { renderTrigger: (open: () => void, label: string) => React.ReactNode }) => {
    importButton(props);
    return <>{props.renderTrigger(openImport, 'Import spreadsheet')}</>;
  },
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
        coverageTitle: value('Statement coverage'),
        coverageRange: value('Statements cover {{from}} – {{to}}'),
        coverageNone: value('No dated statements yet.'),
        coverageAllGood: value('Every day covered.'),
        coverageUnexplained: value('Unexplained difference: {{amount}}'),
        coverageGap: value('No statement for {{from}} – {{to}}'),
        coverageSinceLast: value('No statement since {{from}}'),
        coverageImport: value('Import'),
        coverageChainBreak: value('{{date}}: closes at {{closing}}, next opens at {{opening}}'),
        coverageMovement: value('{{from}} – {{to}}: off by {{amount}}'),
        coverageOverlap: value('{{from}} – {{to}} is in two statements'),
        coverageDuplicate: value('{{name}} repeats an earlier statement'),
        coverageShowAll: value('Show all ({{count}})'),
      }),
  };
});

const account = walletItem({ id: 'w-everyday', name: 'Everyday', currency: 'EUR' });

const emptyCoverage: StatementCoverage = {
  walletId: account.id,
  currency: 'EUR',
  firstDay: null,
  lastDay: null,
  periods: [],
  gaps: [],
  sinceLast: null,
  overlaps: [],
  chainBreaks: [],
  movementMismatches: [],
  unexplained: 0,
  months: [],
};

function renderCard(coverage: StatementCoverage) {
  api.get.mockResolvedValue({ data: coverage });
  renderWithQuery(<AccountCoverageCard account={account} money={value => `€${value.toFixed(2)}`} />);
}

describe('AccountCoverageCard', () => {
  beforeEach(() => {
    api.get.mockReset();
    importButton.mockReset();
    openImport.mockReset();
  });

  it('asks for statements when none has dates', async () => {
    renderCard(emptyCoverage);
    expect(await screen.findByText('No dated statements yet.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(`/wallets/${account.id}/statement-coverage`, expect.anything());
  });

  it('marks every month and lists each problem, a gap opening the import held to its dates', async () => {
    renderCard({
      ...emptyCoverage,
      firstDay: '2026-01-01',
      lastDay: '2026-04-30',
      gaps: [{ from: '2026-02-01', to: '2026-02-28', days: 28 }],
      chainBreaks: [
        {
          fromStatementId: 'jan',
          toStatementId: 'mar',
          date: '2026-03-01',
          closing: 150,
          opening: 160,
          difference: 10,
          afterGap: true,
        },
      ],
      movementMismatches: [
        {
          statementId: 'mar',
          from: '2026-03-01',
          to: '2026-03-31',
          opening: 160,
          closing: 200,
          counted: 40,
          pending: -5,
          difference: 5,
        },
      ],
      unexplained: 15,
      months: [
        { month: '2026-01', state: 'covered', coveredDays: 31, days: 31 },
        { month: '2026-02', state: 'gap', coveredDays: 0, days: 28 },
        { month: '2026-03', state: 'partial', coveredDays: 20, days: 31 },
        { month: '2026-04', state: 'overlap', coveredDays: 30, days: 30 },
      ],
    });

    const card = await screen.findByTestId('account-coverage');
    expect(card).toHaveTextContent('Unexplained difference: €15.00');
    const cells = card.querySelectorAll('[role="img"]');
    expect([...cells].map(cell => cell.getAttribute('data-state'))).toEqual([
      'covered',
      'gap',
      'partial',
      'overlap',
    ]);
    expect(cells[1].getAttribute('aria-label')).toBe('February 2026: 0/28');

    const rows = [...card.querySelectorAll('[data-problem]')].map(row => row.getAttribute('data-problem'));
    expect(rows).toEqual(['chain', 'movement', 'gap']);
    expect(card.querySelector('[data-problem="chain"]')).toHaveTextContent(
      'closes at €150.00, next opens at €160.00',
    );
    expect(card.querySelector('[data-problem="chain"] a')).toHaveAttribute('href', '/statements/mar/edit');
    fireEvent.click(within(card).getByRole('button', { name: 'Import' }));
    expect(openImport).toHaveBeenCalledTimes(1);
    expect(importButton).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: 'transactions',
        account: {
          id: account.id,
          currency: 'EUR',
          period: { from: '2026-02-01', to: '2026-02-28' },
        },
      }),
    );
  });

  it('says all is well when nothing is wrong', async () => {
    renderCard({
      ...emptyCoverage,
      firstDay: '2026-01-01',
      lastDay: '2026-01-31',
      months: [{ month: '2026-01', state: 'covered', coveredDays: 31, days: 31 }],
    });
    expect(await screen.findByText('Every day covered.')).toBeInTheDocument();
    expect(screen.queryByText(/Unexplained/)).toBeNull();
  });
});

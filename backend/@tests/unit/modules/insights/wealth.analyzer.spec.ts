import { InsightSeverity, InsightType } from '@/entities/insight.entity';
import { isoDate, shiftDays } from '@/modules/balance/snapshot-series';
import { HISTORY_MONTHS } from '@/modules/insights/analyzers/spending-history';
import { MILESTONE_WINDOW_DAYS, WealthAnalyzer } from '@/modules/insights/analyzers/wealth.analyzer';

const CONTEXT = { userId: 'user-1', workspaceId: 'workspace-1' };
const NOW = new Date(2026, 10, 18, 12);
const TODAY = isoDate(new Date());

/** `date_trunc('month', …)` as the driver hands it back, `monthsAgo` before NOW. */
const monthOf = (monthsAgo: number) => new Date(2026, 10 - monthsAgo, 1);

type Row = {
  categoryId: string | null;
  categoryName: string | null;
  month: Date;
  currency: string;
  total: string;
};

const spend = (
  monthsAgo: number,
  total: number,
  category: { id: string | null; name: string | null } = { id: null, name: null },
  currency = 'EUR',
): Row => ({
  categoryId: category.id,
  categoryName: category.name,
  month: monthOf(monthsAgo),
  currency,
  total: String(total),
});

/** Six full months of 2 000 a month, none of it in a category. */
const steadyMonths = () =>
  Array.from({ length: HISTORY_MONTHS }, (_, index) => spend(index + 1, 2_000));

const dateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The first counted day of each month before NOW, as the coverage query
 * answers: every month from `firstDate` on, the first one from that day.
 */
function coverageFrom(firstDate: string | null): Array<{ month: Date; first: string }> {
  if (firstDate === null) {
    return [];
  }
  return Array.from({ length: HISTORY_MONTHS + 1 }, (_, index) => monthOf(index + 1))
    .filter(month => dateOnly(new Date(month.getFullYear(), month.getMonth() + 1, 0)) >= firstDate)
    .map(month => ({ month, first: firstDate > dateOnly(month) ? firstDate : dateOnly(month) }));
}

function createTransactionRepository(options: {
  rows: Row[];
  /** Data on every day from this one; '2026-01-01' unless given. */
  firstDate?: string | null;
  /** Or exactly these months (`monthsAgo` → first counted day). */
  coverage?: Record<number, string>;
  accounts?: number;
  balances?: Array<{ currency: string; balance: string }>;
}) {
  const coverage = options.coverage
    ? Object.entries(options.coverage).map(([monthsAgo, first]) => ({
        month: monthOf(Number(monthsAgo)),
        first,
      }))
    : coverageFrom(options.firstDate === undefined ? '2026-01-01' : options.firstDate);
  const createQueryBuilder = vi.fn(() => {
    const builder: any = { selects: [] as string[] };
    for (const method of ['leftJoin', 'where', 'andWhere', 'groupBy', 'addGroupBy']) {
      builder[method] = vi.fn(() => builder);
    }
    for (const method of ['select', 'addSelect']) {
      builder[method] = vi.fn((sql: string) => {
        builder.selects.push(sql);
        return builder;
      });
    }
    builder.getRawMany = vi.fn(async () =>
      builder.selects.includes('MIN(t.transaction_date)') ? coverage : options.rows,
    );
    return builder;
  });
  const query = vi.fn(async (sql: string) =>
    sql.includes('COUNT(*)')
      ? [{ count: options.accounts ?? 0 }]
      : (options.balances ?? []),
  );
  return { createQueryBuilder, query } as any;
}

function createNetWorthService(
  answers: Array<{ series?: Array<{ date: string; value: number }>; high?: number | null; highDate?: string }>,
) {
  const queue = [...answers];
  return {
    getNetWorth: vi.fn(async () => {
      const answer = queue.shift() ?? {};
      const series = answer.series ?? [];
      return {
        currency: 'EUR',
        current: series.at(-1)?.value ?? 0,
        series,
        allTimeHigh:
          answer.high === null || answer.high === undefined
            ? null
            : { value: answer.high, date: answer.highDate ?? TODAY },
      };
    }),
  } as any;
}

function createAnalyzer(
  transactionRepository: any,
  netWorthService = createNetWorthService([]),
) {
  return new WealthAnalyzer(
    transactionRepository,
    { findOne: vi.fn(async () => ({ id: 'workspace-1', currency: 'EUR' })) } as any,
    netWorthService,
    { getRateOrNull: vi.fn(async (from: string) => (from === 'USD' ? 0.9 : null)) } as any,
  );
}

const keys = (candidates: Array<{ messageKey: string }>) => candidates.map(item => item.messageKey);

describe('WealthAnalyzer', () => {
  it('needs a workspace', async () => {
    const analyzer = createAnalyzer(createTransactionRepository({ rows: [] }));
    expect(await analyzer.analyze({ userId: 'user-1', workspaceId: null }, NOW)).toEqual([]);
  });

  describe('idle cash', () => {
    it('names everyday cash beyond six months of spending', async () => {
      const repository = createTransactionRepository({
        rows: steadyMonths(),
        accounts: 1,
        balances: [
          { currency: 'EUR', balance: '15000' },
          { currency: 'USD', balance: '5000' },
        ],
      });
      const [card] = await createAnalyzer(repository).analyze(CONTEXT, NOW);

      expect(card).toMatchObject({
        type: InsightType.IDLE_CASH,
        severity: InsightSeverity.INFO,
        messageKey: 'pattern.idle_cash',
        messageParams: { cashAmount: 19_500, reserveAmount: 12_000, months: 9, currency: 'EUR' },
        deduplicationKey: 'financial:idle_cash:workspace-1',
      });
    });

    it('stays quiet without a real account, whatever the rows add up to', async () => {
      const repository = createTransactionRepository({
        rows: steadyMonths(),
        accounts: 0,
        balances: [{ currency: 'EUR', balance: '90000' }],
      });
      expect(keys(await createAnalyzer(repository).analyze(CONTEXT, NOW))).toEqual([]);
    });

    it('stays quiet when the history is too short to know the spending', async () => {
      const repository = createTransactionRepository({
        rows: steadyMonths(),
        firstDate: '2026-09-01',
        accounts: 1,
        balances: [{ currency: 'EUR', balance: '90000' }],
      });
      expect(keys(await createAnalyzer(repository).analyze(CONTEXT, NOW))).toEqual([]);
    });

    it('does not count a month the workspace joined halfway through', async () => {
      // Data from 10 August: September and October are full, August is not —
      // two months, too few, though three months have rows.
      const repository = createTransactionRepository({
        rows: [spend(1, 2_000), spend(2, 2_000), spend(3, 300)],
        firstDate: '2026-08-10',
        accounts: 1,
        balances: [{ currency: 'EUR', balance: '90000' }],
      });
      expect(keys(await createAnalyzer(repository).analyze(CONTEXT, NOW))).toEqual([]);
    });

    it('reads empty months after an old row as missing data, not as months of no spending', async () => {
      // A receipt from last year, nothing since, then two months of 2 000:
      // 10 000 is five months of spending, not fifteen.
      const repository = createTransactionRepository({
        rows: [spend(1, 2_000), spend(2, 2_000)],
        coverage: { 1: '2026-10-01', 2: '2026-09-01' },
        accounts: 1,
        balances: [{ currency: 'EUR', balance: '10000' }],
      });
      expect(keys(await createAnalyzer(repository).analyze(CONTEXT, NOW))).toEqual([]);
    });

    it('counts only the unbroken run of months back from the last one', async () => {
      // A month with no row at all breaks the history: the three months
      // before the break do not add to the two after it.
      const repository = createTransactionRepository({
        rows: [1, 2, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 2_000)),
        coverage: { 1: '2026-10-01', 2: '2026-09-01', 4: '2026-07-01', 5: '2026-06-01', 6: '2026-05-01' },
        accounts: 1,
        balances: [{ currency: 'EUR', balance: '90000' }],
      });
      expect(keys(await createAnalyzer(repository).analyze(CONTEXT, NOW))).toEqual([]);
      const unbroken = createTransactionRepository({
        rows: [1, 2, 3].map(monthsAgo => spend(monthsAgo, 2_000)),
        coverage: { 1: '2026-10-03', 2: '2026-09-02', 3: '2026-08-01' },
        accounts: 1,
        balances: [{ currency: 'EUR', balance: '90000' }],
      });
      // The 1st of a month is not always a day with a row: a month counts when
      // the one before it has data.
      expect(keys(await createAnalyzer(unbroken).analyze(CONTEXT, NOW))).toEqual([
        'pattern.idle_cash',
      ]);
    });
  });

  describe('net worth milestone', () => {
    const windowStart = shiftDays(TODAY, -(MILESTONE_WINDOW_DAYS - 1));

    it('announces the first crossing, dated', async () => {
      const crossed = shiftDays(TODAY, -2);
      const netWorth = createNetWorthService([
        {
          series: [
            { date: shiftDays(TODAY, -3), value: 98_000 },
            { date: crossed, value: 100_400 },
            { date: TODAY, value: 99_700 },
          ],
          high: 100_400,
          highDate: crossed,
        },
        { high: 97_000, highDate: shiftDays(windowStart, -20) },
      ]);
      const repository = createTransactionRepository({ rows: steadyMonths() });

      const cards = await createAnalyzer(repository, netWorth).analyze(CONTEXT, NOW);

      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({
        type: InsightType.NET_WORTH_MILESTONE,
        messageKey: 'pattern.net_worth_milestone',
        messageParams: { milestoneAmount: 100_000, date: crossed, currency: 'EUR' },
        deduplicationKey: 'financial:net_worth_milestone:workspace-1:100000',
      });
      expect(netWorth.getNetWorth).toHaveBeenLastCalledWith('workspace-1', {
        range: '30d',
        to: shiftDays(windowStart, -1),
      });
    });

    it('does not look further back when the all-time high is older than the window', async () => {
      const netWorth = createNetWorthService([
        {
          series: [{ date: TODAY, value: 100_400 }],
          high: 104_000,
          highDate: shiftDays(windowStart, -1),
        },
      ]);
      const repository = createTransactionRepository({ rows: steadyMonths() });

      expect(await createAnalyzer(repository, netWorth).analyze(CONTEXT, NOW)).toEqual([]);
      expect(netWorth.getNetWorth).toHaveBeenCalledTimes(1);
    });

    it('stays quiet without spending history to scale the line by', async () => {
      const netWorth = createNetWorthService([]);
      const repository = createTransactionRepository({ rows: [], firstDate: null });

      expect(await createAnalyzer(repository, netWorth).analyze(CONTEXT, NOW)).toEqual([]);
      expect(netWorth.getNetWorth).not.toHaveBeenCalled();
    });
  });

  describe('category anomaly', () => {
    const repairs = { id: 'category-1', name: 'Home Repairs' };

    it('names a category far above its usual month, in the workspace currency', async () => {
      const rows = [
        ...steadyMonths(),
        ...[300, 280, 320, 310, 290, 300].map((total, index) => spend(index + 1, total, repairs)),
        spend(0, 1_000, repairs, 'USD'),
      ];
      const [card] = await createAnalyzer(createTransactionRepository({ rows })).analyze(
        CONTEXT,
        NOW,
      );

      expect(card).toMatchObject({
        type: InsightType.CATEGORY_ANOMALY,
        severity: InsightSeverity.WARN,
        messageKey: 'trend.category_anomaly',
        messageParams: {
          category: 'Home Repairs',
          currentAmount: 900,
          usualAmount: 300,
          months: 6,
          currency: 'EUR',
        },
        deduplicationKey: 'financial:category_anomaly:workspace-1:category-1:2026-11',
        data: { month: '2026-11', categoryId: 'category-1' },
      });
    });

    it('writes one card per unusual category, each under its own key', async () => {
      const travel = { id: 'category-2', name: 'Travel' };
      const rows = [
        ...steadyMonths(),
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 300, repairs)),
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 200, travel)),
        spend(0, 900, repairs),
        spend(0, 1_500, travel),
      ];
      const cards = await createAnalyzer(createTransactionRepository({ rows })).analyze(
        CONTEXT,
        NOW,
      );
      expect(cards.map(card => card.deduplicationKey)).toEqual([
        'financial:category_anomaly:workspace-1:category-2:2026-11',
        'financial:category_anomaly:workspace-1:category-1:2026-11',
      ]);
    });

    it('never names the private or the uncategorised bucket, though both count in the total', async () => {
      const rows = [
        ...steadyMonths(),
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 300, { id: 'private', name: 'Private' })),
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo =>
          spend(monthsAgo, 300, { id: 'uncategorized', name: 'Uncategorized' }),
        ),
        spend(0, 5_000, { id: 'private', name: 'Private' }),
        spend(0, 5_000, { id: 'uncategorized', name: 'Uncategorized' }),
      ];
      expect(
        await createAnalyzer(createTransactionRepository({ rows })).analyze(CONTEXT, NOW),
      ).toEqual([]);
    });

    it('lets private money raise the floor without being shown', async () => {
      // Another member's private spending (bucket null) makes the household
      // bigger: a rise of 200 is then too small to mention.
      const rows = [
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 10_000)),
        ...[1, 2, 3, 4, 5, 6].map(monthsAgo => spend(monthsAgo, 100, repairs)),
        spend(0, 300, repairs),
      ];
      expect(
        await createAnalyzer(createTransactionRepository({ rows })).analyze(CONTEXT, NOW),
      ).toEqual([]);
      const smaller = rows.filter(row => row.total !== '10000');
      expect(
        keys(await createAnalyzer(createTransactionRepository({ rows: smaller })).analyze(CONTEXT, NOW)),
      ).toEqual(['trend.category_anomaly']);
    });
  });
});

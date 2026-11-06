import { flowsSql } from '@/common/utils/counted-transactions.util';
import { SubscriptionFrequency, SubscriptionStatus } from '@/entities/subscription.entity';
import { StoicBehaviorService } from '@/modules/insights/stoic/stoic-behavior.service';

/** Each query builder answers with the next prepared result, in call order. */
function transactionRepository(results: unknown[][]) {
  const queue = [...results];
  return {
    createQueryBuilder: vi.fn(() => {
      const rows = queue.shift() ?? [];
      const qb: any = {};
      for (const method of [
        'select',
        'addSelect',
        'where',
        'andWhere',
        'groupBy',
        'addGroupBy',
        'leftJoin',
      ]) {
        qb[method] = vi.fn(() => qb);
      }
      qb.getRawMany = vi.fn(async () => rows);
      qb.getCount = vi.fn(async () => rows.length);
      return qb;
    }),
  };
}

const exchangeRates = { getRateOrNull: vi.fn(async (from: string) => (from === 'USD' ? 0.5 : 1)) };

describe('StoicBehaviorService', () => {
  it('merges merchants across categories, currencies and bank spellings, and splits weekends', async () => {
    const transactions = transactionRepository([
      [
        { name: 'Cafe', bankName: 'CAFE 12', categoryId: 'fun', currency: 'EUR', total: '30' },
        { name: 'Cafe', bankName: 'CAFE 34', categoryId: 'food', currency: 'USD', total: '20' },
      ],
      [{ name: 'Cafe', count: '8' }],
      [{ name: 'Cafe', count: '11' }],
      [
        { categoryId: 'fun', currency: 'EUR', weekend: true, total: '40' },
        { categoryId: 'fun', currency: 'EUR', weekend: false, total: '10' },
      ],
      [
        { month: '2026-09', type: 'income', currency: 'EUR', total: '1000' },
        { month: '2026-09', type: 'expense', currency: 'USD', total: '400' },
        { month: '2026-08', type: 'income', currency: 'EUR', total: '900' },
      ],
      [{}, {}],
    ]);
    const service = new StoicBehaviorService(
      transactions as any,
      {
        find: vi.fn(async () => [
          { amount: '10', currency: 'EUR', frequency: SubscriptionFrequency.MONTHLY },
          { amount: '120', currency: 'EUR', frequency: SubscriptionFrequency.ANNUAL },
        ]),
      } as any,
      exchangeRates as any,
    );

    const behavior = await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    expect(behavior.merchants).toEqual([
      { name: 'Cafe', bankName: 'CAFE 12', categoryId: 'fun', count: 8, total: 40 },
    ]);
    expect(behavior.previousCounts).toEqual({ Cafe: 11 });
    expect(behavior.weekendByCategory).toEqual({ fun: 40 });
    expect(behavior.totalByCategory).toEqual({ fun: 50 });
    expect(behavior.cashFlow.slice(0, 2)).toEqual([
      { month: '2026-09', income: 1000, expense: 200 },
      { month: '2026-08', income: 900, expense: 0 },
    ]);
    expect(behavior.cashFlow).toHaveLength(8);
    expect(behavior.subscriptions).toEqual({ count: 2, monthlyTotal: 20 });
    expect(behavior.unconfirmedRows).toBe(2);
  });

  it('counts only subscriptions the person confirmed', async () => {
    const subscriptions = { find: vi.fn(async () => []) };
    const service = new StoicBehaviorService(
      transactionRepository([]) as any,
      subscriptions as any,
      exchangeRates as any,
    );

    await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    expect(subscriptions.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1', status: SubscriptionStatus.ACTIVE } }),
    );
  });

  it('counts the parts of a split as one purchase', async () => {
    const transactions = transactionRepository([]);
    const service = new StoicBehaviorService(
      transactions as any,
      { find: vi.fn(async () => []) } as any,
      exchangeRates as any,
    );

    await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    const [, counts] = transactions.createQueryBuilder.mock.results.map(result => result.value);
    expect(counts.addSelect).toHaveBeenCalledWith(
      'COUNT(DISTINCT COALESCE(t.split_group_id::text, t.id::text))',
      'count',
    );
  });

  it('reads every query from confirmed transactions only', async () => {
    const transactions = transactionRepository([]);
    const service = new StoicBehaviorService(
      transactions as any,
      { find: vi.fn(async () => []) } as any,
      exchangeRates as any,
    );

    await service.load('ws-1', 'EUR', new Date(2026, 8, 1));

    const builders = transactions.createQueryBuilder.mock.results.map(result => result.value);
    // The last one is the Review queue: what the figures do not count yet.
    expect(builders).toHaveLength(6);
    for (const qb of builders.slice(0, 5)) {
      expect(qb.andWhere).toHaveBeenCalledWith(flowsSql('t'));
    }
  });
});

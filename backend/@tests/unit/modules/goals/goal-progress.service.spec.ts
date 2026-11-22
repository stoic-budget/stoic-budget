import type { Goal } from '@/entities';
import type { Wallet } from '@/entities/wallet.entity';
import { GoalProgressService } from '@/modules/goals/goal-progress.service';
import { walletLedgers } from '@/modules/wallets/wallet-ledger';

vi.mock('@/modules/wallets/wallet-ledger', () => ({ walletLedgers: vi.fn() }));

const WORKSPACE_ID = 'workspace-1';
const SAVINGS = 'wallet-savings';

function goal(overrides: Partial<Goal> = {}): Goal {
  return { id: 'goal-1', currency: 'EUR', walletId: SAVINGS, ...overrides } as Goal;
}

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: SAVINGS,
    workspaceId: WORKSPACE_ID,
    name: 'ACME Savings',
    currency: 'EUR',
    initialBalance: 100,
    isActive: true,
    ownerMemberId: null,
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    ...overrides,
  } as Wallet;
}

function createService(options: {
  wallets?: Wallet[];
  /** Net movement per day of the savings account, in its own currency. */
  days?: Array<{ date: string; net: number }>;
  rate?: number | null;
  /** What the contribution sum answers, per goal. */
  contributed?: Array<{ goalId: string; total: string }>;
}) {
  const conditions: string[] = [];
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    addSelect: vi.fn(() => builder),
    where: vi.fn(() => builder),
    andWhere: vi.fn((clause: string) => {
      conditions.push(clause);
      return builder;
    }),
    groupBy: vi.fn(() => builder),
    getRawMany: vi.fn(async () => options.contributed ?? []),
  };
  const contributionRepository = { createQueryBuilder: vi.fn(() => builder) };
  const wallets = options.wallets ?? [wallet()];
  const walletRepository = {
    find: vi.fn(async () => wallets),
    findOne: vi.fn(
      async ({ where }: { where: { id: string; workspaceId: string } }) =>
        wallets.find(row => row.id === where.id && row.workspaceId === where.workspaceId) ?? null,
    ),
    exists: vi.fn(async ({ where }: { where: { id: string; isActive: boolean } }) =>
      wallets.some(row => row.id === where.id && row.isActive === where.isActive),
    ),
  };
  const days = options.days ?? [];
  vi.mocked(walletLedgers).mockResolvedValue(
    new Map(
      wallets.map(row => [
        row.id,
        {
          days,
          net: days.reduce((sum, day) => sum + day.net, 0),
          count: days.length,
          lastDate: null,
          unconverted: [],
        },
      ]),
    ),
  );
  const exchangeRates = {
    getRateOrNull: vi.fn(async () => (options.rate === undefined ? 0.5 : options.rate)),
  };
  return {
    service: new GoalProgressService(
      contributionRepository as never,
      walletRepository as never,
      {} as never,
      exchangeRates as never,
    ),
    conditions,
    exchangeRates,
  };
}

describe('GoalProgressService', () => {
  it("counts the followed account's balance, converted into the goal's currency", async () => {
    const { service, exchangeRates } = createService({
      wallets: [wallet({ currency: 'USD' })],
      days: [{ date: '2026-02-01', net: 900 }],
      rate: 0.5,
    });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    // 100 opening + 900 = 1,000 USD at 0.5 is 500 EUR.
    expect(progress?.amount).toBe(500);
    expect(progress?.account).toEqual({
      id: SAVINGS,
      name: 'ACME Savings',
      currency: 'USD',
      balance: 1000,
      status: 'following',
    });
    expect(exchangeRates.getRateOrNull).toHaveBeenCalledWith('USD', 'EUR', undefined, WORKSPACE_ID);
  });

  it('leaves the contributions of a following goal out of the sum', async () => {
    const { service } = createService({
      days: [{ date: '2026-02-01', net: 200 }],
      contributed: [{ goalId: 'goal-1', total: '5000' }],
    });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress?.amount).toBe(300);
  });

  it('brings the contributions back once the goal stops following', async () => {
    const { service } = createService({ contributed: [{ goalId: 'goal-1', total: '5000' }] });

    const progress = (await service.progress(WORKSPACE_ID, [goal({ walletId: null })])).get('goal-1');

    expect(progress).toEqual({ amount: 5000, account: null, since: null });
  });

  it('reads an overdrawn account as nothing saved, not as a negative amount', async () => {
    const { service } = createService({ days: [{ date: '2026-02-01', net: -400 }] });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress?.amount).toBe(0);
    expect(progress?.account?.balance).toBe(-300);
  });

  it('says there is no rate instead of counting the balance one to one', async () => {
    const { service } = createService({ wallets: [wallet({ currency: 'KZT' })], rate: null });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress?.amount).toBe(0);
    expect(progress?.account).toMatchObject({ status: 'no_rate', balance: 100, currency: 'KZT' });
  });

  it('falls back to the contributions while the account is archived, and says so', async () => {
    const { service } = createService({
      wallets: [wallet({ isActive: false })],
      contributed: [{ goalId: 'goal-1', total: '70' }],
    });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress?.amount).toBe(70);
    expect(progress?.account?.status).toBe('archived');
  });

  it('reads a goal whose account is gone as an ordinary contributions goal', async () => {
    // What a lookup by id and workspace answers when the id is not one of its accounts.
    const { service } = createService({ wallets: [], contributed: [{ goalId: 'goal-1', total: '70' }] });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress).toEqual({ amount: 70, account: null, since: null });
  });

  it('reads the balance as it stood before a date for a past month', async () => {
    const { service } = createService({
      days: [
        { date: '2026-02-10', net: 50 },
        { date: '2026-03-05', net: 1000 },
      ],
    });

    const progress = (await service.progress(WORKSPACE_ID, [goal()], '2026-03-01')).get('goal-1');

    expect(progress?.amount).toBe(150);
  });

  it("dates the history from the account's first movement when it predates the account", async () => {
    const { service } = createService({ days: [{ date: '2025-11-03', net: 10 }] });

    const progress = (await service.progress(WORKSPACE_ID, [goal()])).get('goal-1');

    expect(progress?.since).toEqual(new Date('2025-11-03'));
  });

  describe('movedBetween', () => {
    it("is the balance change inside the window, in the goal's currency", async () => {
      const { service } = createService({
        wallets: [wallet({ currency: 'USD' })],
        days: [
          { date: '2026-01-20', net: 400 },
          { date: '2026-02-03', net: 300 },
          { date: '2026-02-27', net: -100 },
          { date: '2026-03-02', net: 9000 },
        ],
        rate: 0.5,
      });

      const moved = await service.movedBetween(WORKSPACE_ID, [goal()], '2026-02-01', '2026-03-01');

      expect(moved.get('goal-1')).toBe(100);
    });

    it('leaves out an account that did not move in the window', async () => {
      const { service } = createService({ days: [{ date: '2026-01-20', net: 400 }] });

      const moved = await service.movedBetween(WORKSPACE_ID, [goal()], '2026-02-01', '2026-03-01');

      expect(moved.has('goal-1')).toBe(false);
    });

    it('sums contributions inside the half-open window for a goal that counts them', async () => {
      const { service, conditions } = createService({
        contributed: [{ goalId: 'goal-1', total: '40' }],
      });

      const moved = await service.movedBetween(
        WORKSPACE_ID,
        [goal({ walletId: null })],
        '2026-02-01',
        '2026-03-01',
      );

      expect(moved.get('goal-1')).toBe(40);
      expect(conditions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('>= :from'),
          expect.stringContaining('< :before'),
        ]),
      );
    });
  });

  describe('assertCanFollow', () => {
    it("accepts a shared account and the person's own", async () => {
      const { service } = createService({
        wallets: [wallet(), wallet({ id: 'mine', ownerMemberId: 'member-1' })],
      });

      await expect(service.assertCanFollow(WORKSPACE_ID, SAVINGS, 'member-1')).resolves.toBeUndefined();
      await expect(service.assertCanFollow(WORKSPACE_ID, 'mine', 'member-1')).resolves.toBeUndefined();
    });

    it("refuses another member's own account, an archived one and another workspace's", async () => {
      const { service } = createService({
        wallets: [
          wallet({ id: 'theirs', ownerMemberId: 'member-2' }),
          wallet({ id: 'archived', isActive: false }),
          wallet({ id: 'elsewhere', workspaceId: 'workspace-2' }),
        ],
      });

      for (const id of ['theirs', 'archived', 'elsewhere']) {
        await expect(service.assertCanFollow(WORKSPACE_ID, id, 'member-1')).rejects.toMatchObject({
          status: 400,
          response: expect.objectContaining({ code: 'GOAL_ACCOUNT_UNAVAILABLE' }),
        });
      }
    });
  });
});

import type { Mock } from 'vitest';
import * as nodeFs from 'node:fs';
import { PayableStatus } from '../../../src/entities/payable.entity';
import { SubscriptionFrequency } from '../../../src/entities/subscription.entity';
import { TransactionType } from '../../../src/entities/transaction.entity';
import { BudgetsTarget } from '../../../src/modules/entity-imports/targets/budgets.target';
import { PayablesTarget } from '../../../src/modules/entity-imports/targets/payables.target';
import { SubscriptionsTarget } from '../../../src/modules/entity-imports/targets/subscriptions.target';
import type { ImportContext } from '../../../src/modules/entity-imports/targets/target.types';
import { TransactionsTarget } from '../../../src/modules/entity-imports/targets/transactions.target';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

type RepoMock = {
  find: Mock;
  save: Mock;
  update: Mock;
  insert: Mock;
  create: Mock;
};

const repoMock = (found: unknown[] = []): RepoMock => {
  let counter = 0;
  return {
    find: vi.fn().mockResolvedValue(found),
    save: vi.fn(async (value: unknown) =>
      Array.isArray(value)
        ? value.map(item => ({ ...(item as object), id: `id-${++counter}` }))
        : { ...(value as object), id: `id-${++counter}` },
    ),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    insert: vi.fn().mockResolvedValue({}),
    create: vi.fn((value: unknown) => value),
  };
};

const buildContext = (
  mapping: Record<string, number>,
  repos: Record<string, RepoMock>,
): ImportContext => ({
  workspaceId: WORKSPACE_ID,
  userId: USER_ID,
  manager: {
    getRepository: (entity: { name: string }) => {
      const repo = repos[entity.name];
      if (!repo) {
        throw new Error(`No mock for ${entity.name}`);
      }
      return repo;
    },
  } as unknown as ImportContext['manager'],
  currency: 'USD',
  fileName: 'sheet.xlsx',
  categorize: false,
  walletId: null,
  period: null,
  headers: [],
  cell: (row, field) => (Number.isInteger(mapping[field]) ? String(row[mapping[field]] ?? '') : ''),
  category: vi.fn(async (name: string) => `cat-${name.toLowerCase()}`),
  created: [],
  updated: [],
});

describe('PayablesTarget', () => {
  it('creates new payables, skips ones already present and reports bad rows', async () => {
    const payables = repoMock([{ vendor: 'Landlord', amount: '1500.00', dueDate: '2026-10-01' }]);
    const ctx = buildContext({ vendor: 0, amount: 1, dueDate: 2, status: 3 }, { Payable: payables });
    const results = await new PayablesTarget().run(
      [
        ['Electric Co', '$120.50', '2026-10-15', 'unpaid'],
        ['Landlord', '1500', '2026-10-01', 'paid'],
        ['', '10', '', ''],
        ['Water', 'n/a', '', ''],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['created', 'skipped', 'error', 'error']);
    expect(results[1].reason).toBe('duplicate');
    expect(results[2].reason).toBe('vendor');
    expect(results[3].reason).toBe('amount');
    expect(payables.save).toHaveBeenCalledTimes(1);
    const saved = payables.save.mock.calls[0][0];
    expect(saved).toMatchObject({ vendor: 'Electric Co', amount: 120.5, currency: 'USD', status: PayableStatus.TO_PAY });
    expect(ctx.created).toEqual([{ kind: 'payable', id: 'id-1' }]);
  });

  it('writes nothing in a dry run', async () => {
    const payables = repoMock();
    const ctx = buildContext({ vendor: 0, amount: 1 }, { Payable: payables });
    const results = await new PayablesTarget().run([['A', '1'], ['B', '2']], ctx, true);
    expect(results.every(r => r.status === 'created')).toBe(true);
    expect(payables.save).not.toHaveBeenCalled();
  });
});

describe('SubscriptionsTarget', () => {
  it('updates a known vendor and remembers the previous values', async () => {
    const subscriptions = repoMock([
      { id: 'sub-1', vendorName: 'Netflix', amount: '12.00', frequency: SubscriptionFrequency.MONTHLY, nextChargeDate: null, currency: 'USD' },
    ]);
    const ctx = buildContext({ vendorName: 0, amount: 1, frequency: 2 }, { Subscription: subscriptions });
    const results = await new SubscriptionsTarget().run(
      [
        ['netflix', '15.99', 'monthly'],
        ['Spotify', '9.99', 'yearly'],
        ['Spotify', '9.99', 'yearly'],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['updated', 'created', 'skipped']);
    expect(subscriptions.update).toHaveBeenCalledWith('sub-1', expect.objectContaining({ amount: 15.99 }));
    expect(ctx.updated).toEqual([
      { kind: 'subscription', id: 'sub-1', before: { amount: 12, frequency: 'monthly', nextChargeDate: null, currency: 'USD' } },
    ]);
    expect(subscriptions.save.mock.calls[0][0]).toMatchObject({ vendorName: 'Spotify', frequency: SubscriptionFrequency.ANNUAL });
  });
});

describe('BudgetsTarget', () => {
  it('replaces the limit of an existing budget and creates missing ones', async () => {
    const budgets = repoMock([{ id: 'b-1', categoryId: 'cat-food', periodType: 'monthly', limitAmount: '400.00', currency: 'USD' }]);
    const ctx = buildContext({ category: 0, limit: 1, periodType: 2 }, { Budget: budgets });
    const results = await new BudgetsTarget().run(
      [
        ['Food', '500', 'monthly'],
        ['Rent', '1200', ''],
        ['Food', '500', 'monthly'],
      ],
      ctx,
      false,
    );
    expect(results.map(r => r.status)).toEqual(['updated', 'created', 'skipped']);
    expect(budgets.update).toHaveBeenCalledWith('b-1', { limitAmount: 500 });
    expect(ctx.updated[0]).toEqual({ kind: 'budget', id: 'b-1', before: { limitAmount: 400, currency: 'USD' } });
    expect(budgets.save.mock.calls[0][0]).toMatchObject({ categoryId: 'cat-rent', periodType: 'monthly', limitAmount: 1200 });
  });
});

describe('TransactionsTarget', () => {
  it('skips fingerprints already in the workspace and infers the type from signs only when mixed', async () => {
    const transactions = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions });
    const rows = [
      ['2026-09-01', 'Coffee', '-4.50'],
      ['2026-09-02', 'Salary', '3000'],
      ['2026-09-01', 'Coffee', '-4.50'],
      ['bad', 'x', '1'],
    ];
    const results = await new TransactionsTarget().run(rows, ctx, true);
    expect(results.map(r => r.status)).toEqual(['created', 'created', 'skipped', 'error']);
    expect(results[3].reason).toBe('date');
    expect(transactions.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: WORKSPACE_ID }) }),
    );
  });

  it('treats an all-positive sheet without a type column as expenses', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: statements });
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run(
      [
        ['2026-09-01', 'Coffee', '4.50'],
        ['2026-09-02', 'Lunch', '12'],
      ],
      ctx,
      false,
    );
    const saved = transactions.save.mock.calls[0][0] as Array<{ transactionType: TransactionType; debit: number | null }>;
    expect(saved.map(tx => tx.transactionType)).toEqual([TransactionType.EXPENSE, TransactionType.EXPENSE]);
    expect(saved[0].debit).toBe(4.5);
    expect(ctx.created[0]).toEqual({ kind: 'statement', id: 'id-1' });
    expect(statements.update).toHaveBeenCalledWith('id-1', expect.objectContaining({ fileData: expect.any(Buffer) }));
  });

  it('reads separate money-out and money-in columns, and rows with both or neither are errors', async () => {
    const transactions = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2, credit: 3 }, { Transaction: transactions });
    const rows = [
      ['2026-09-01', 'ACME Store - Wireless Buds', '19.99', ''],
      ['2026-09-02', 'Employer One', '', '1500'],
      ['2026-09-03', 'Both Sides', '5', '5'],
      ['2026-09-04', 'Neither', '', ''],
    ];
    const results = await new TransactionsTarget().run(rows, ctx, true);
    expect(results.map(r => r.status)).toEqual(['created', 'created', 'error', 'error']);
    expect(results[2].reason).toBe('amount');
    expect(results[3].reason).toBe('amount');
  });

  it('books money in from a credit column as income even when no row spends', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext(
      { date: 0, merchant: 1, amount: 2, credit: 3 },
      { Transaction: transactions, Statement: statements },
    );
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run([['2026-09-02', 'Employer One', '', '1500']], ctx, false);
    const [saved] = transactions.save.mock.calls[0][0] as Array<{ transactionType: TransactionType; credit: number | null }>;
    expect(saved.transactionType).toBe(TransactionType.INCOME);
    expect(saved.credit).toBe(1500);
  });

  it('books the rows and their statement to the account chosen for the sheet', async () => {
    const accountId = '33333333-3333-4333-8333-333333333333';
    const ownerId = '44444444-4444-4444-8444-444444444444';
    const transactions = repoMock();
    const statements = repoMock();
    const wallets = {
      ...repoMock(),
      findOne: vi.fn().mockResolvedValue({ id: accountId, ownerMemberId: ownerId, currency: 'usd' }),
    };
    const ctx = {
      ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: statements, Wallet: wallets }),
      walletId: accountId,
      headers: ['Date', ' Merchant ', 'Amount'],
    };
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run([['2026-09-01', 'Corner Cafe', '-4.50']], ctx, false);

    expect(wallets.findOne).toHaveBeenCalledWith({ where: { id: accountId, workspaceId: WORKSPACE_ID } });
    const statement = statements.save.mock.calls[0][0] as { walletId: string; parsingDetails: Record<string, any> };
    expect(statement.walletId).toBe(accountId);
    expect(statement.parsingDetails.metadataExtracted).toEqual({ normalizedHeader: 'date merchant amount' });
    const [row] = transactions.save.mock.calls[0][0] as Array<{ walletId: string; ownerMemberId: string }>;
    expect(row).toEqual(expect.objectContaining({ walletId: accountId, ownerMemberId: ownerId }));
  });

  it('refuses an account in another currency than the sheet', async () => {
    const wallets = {
      ...repoMock(),
      findOne: vi.fn().mockResolvedValue({ id: 'w1', ownerMemberId: null, currency: 'EUR' }),
    };
    const statements = repoMock();
    const ctx = {
      ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: repoMock(), Statement: statements, Wallet: wallets }),
      walletId: 'w1',
    };
    await expect(
      new TransactionsTarget().run([['2026-09-01', 'Corner Cafe', '-4.50']], ctx, false),
    ).rejects.toThrow();
    expect(statements.save).not.toHaveBeenCalled();
  });

  it('reads a month-first date column month-first once one date settles the order', async () => {
    const transactions = repoMock();
    const statements = repoMock();
    const ctx = buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: statements });
    vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
    await new TransactionsTarget().run(
      [
        ['01/02/2026', 'Corner Cafe', '-4.50'],
        ['12/31/2026', 'Corner Cafe', '-5.00'],
      ],
      ctx,
      false,
    );
    const saved = transactions.save.mock.calls[0][0] as Array<{ transactionDate: Date }>;
    expect(saved.map(tx => tx.transactionDate.toISOString().slice(0, 10))).toEqual(['2026-01-02', '2026-12-31']);
  });

  describe('held to a period (filling a gap between statements)', () => {
    const period = { from: '2026-03-03', to: '2026-04-17' };
    const sheet = [
      ['2026-03-01', 'ACME Store - Wireless Buds', '-19.99'],
      ['2026-03-05', 'Corner Cafe', '-4.50'],
      ['2026-04-15', 'Employer One', '1500'],
      ['2026-04-20', 'Corner Cafe', '-5.00'],
    ];

    it('imports only the rows dated in it and skips the rest as outside_period', async () => {
      const ctx = { ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: repoMock() }), period };
      const results = await new TransactionsTarget().run(sheet, ctx, true);
      expect(results.map(r => r.status)).toEqual(['skipped', 'created', 'created', 'skipped']);
      expect(results[0].reason).toBe('outside_period');
      expect(results[3].reason).toBe('outside_period');
    });

    it('takes the period as the statement dates at the ends the sheet reaches past', async () => {
      const statements = repoMock();
      const ctx = {
        ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: repoMock(), Statement: statements }),
        period,
      };
      vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
      await new TransactionsTarget().run(sheet.slice(0, 3), ctx, false);
      const statement = statements.save.mock.calls[0][0] as { statementDateFrom: Date; statementDateTo: Date };
      // Rows before the period: the sheet covers its start. None after: it ends at its last row.
      expect(statement.statementDateFrom.toISOString().slice(0, 10)).toBe(period.from);
      expect(statement.statementDateTo.toISOString().slice(0, 10)).toBe('2026-04-15');
    });

    it('records a quiet period as an empty statement when the sheet reaches past both ends', async () => {
      const statements = repoMock();
      const ctx = {
        ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: repoMock(), Statement: statements }),
        period: { from: '2026-03-10', to: '2026-04-10' },
      };
      vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
      const results = await new TransactionsTarget().run([sheet[1], sheet[3]], ctx, false);
      expect(results.map(r => r.reason)).toEqual(['outside_period', 'outside_period']);
      const statement = statements.save.mock.calls[0][0] as {
        statementDateFrom: Date;
        statementDateTo: Date;
        totalTransactions: number;
      };
      expect(statement.statementDateFrom.toISOString().slice(0, 10)).toBe('2026-03-10');
      expect(statement.statementDateTo.toISOString().slice(0, 10)).toBe('2026-04-10');
      expect(statement.totalTransactions).toBe(0);
      expect(ctx.created).toEqual([{ kind: 'statement', id: expect.any(String) }]);
    });

    it('records no quiet period when the sheet stops short of one end or a row inside could not be read', async () => {
      const period = { from: '2026-03-10', to: '2026-04-10' };
      for (const rows of [
        [sheet[0], sheet[1]],
        [sheet[1], ['2026-03-20', 'Corner Cafe', 'n/a'], sheet[3]],
      ]) {
        const statements = repoMock();
        const ctx = {
          ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: repoMock(), Statement: statements }),
          period,
        };
        await new TransactionsTarget().run(rows, ctx, false);
        expect(statements.save).not.toHaveBeenCalled();
        expect(ctx.created).toEqual([]);
      }
    });

    it('reads signs over the whole sheet, so income inside stays income when only spending lies outside', async () => {
      const transactions = repoMock();
      const ctx = {
        ...buildContext({ date: 0, merchant: 1, amount: 2 }, { Transaction: transactions, Statement: repoMock() }),
        period: { from: '2026-04-01', to: '2026-04-30' },
      };
      vi.spyOn(nodeFs.promises, 'writeFile').mockResolvedValue(undefined);
      await new TransactionsTarget().run(sheet.slice(0, 3), ctx, false);
      const [row] = transactions.save.mock.calls[0][0] as Array<{ transactionType: TransactionType }>;
      expect(row.transactionType).toBe(TransactionType.INCOME);
    });
  });
});

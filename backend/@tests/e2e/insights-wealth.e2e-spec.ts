vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Category, CategoryType } from '../../src/entities/category.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { Wallet } from '../../src/entities/wallet.entity';
import { Workspace } from '../../src/entities/workspace.entity';
import { InsightList, InsightsRefreshed } from '../../src/contracts';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail, type E2eAccount, registerAccount } from './helpers/e2e-app';

/** The new insights' types, which are also their message keys. */
const NEW_KEYS = ['trend.category_anomaly', 'pattern.idle_cash', 'pattern.net_worth_milestone'];
const now = new Date();
/** Noon on the 1st of the month `monthsAgo` back: every month from its first day. */
const firstOf = (monthsAgo: number) =>
  new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1, 12);
const daysAgo = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * The three household cards on a real database: each written once for the
 * workspace whose numbers support it, never for another workspace, and never
 * naming a private row's category.
 */
describe('Household insights (e2e)', () => {
  const email = `wealth-${randomUUID()}@example.com`;
  const otherEmail = `wealth-other-${randomUUID()}@example.com`;
  let ctx: ContractApp;
  let other: E2eAccount;
  let wallet: Wallet;

  const save = (overrides: Partial<Transaction>) =>
    ctx.dataSource.getRepository(Transaction).save({
      workspaceId: ctx.owner.workspaceId,
      transactionDate: firstOf(1),
      counterpartyName: 'ACME Store',
      paymentPurpose: 'purchase',
      currency: 'EUR',
      transactionType: TransactionType.EXPENSE,
      isVerified: true,
      ...overrides,
    } as Transaction);
  const expense = (categoryId: string, amount: number, date: Date, extra: Partial<Transaction> = {}) =>
    save({ categoryId, amount, debit: amount, credit: null, transactionDate: date, ...extra });
  /** The unusual-category cards among `cards`, by title (the refresh answer carries no data). */
  const unusual = (cards: ReadonlyArray<{ type: string; title: string }>) =>
    cards.filter(card => card.type === 'trend.category_anomaly').map(card => card.title);
  let repairsId: string;
  let giftsId: string;

  const refresh = (account: { token: string; workspaceId: string }) =>
    ctx.answer(
      InsightsRefreshed,
      request(ctx.app.getHttpServer())
        .post('/insights/refresh?locale=en')
        .set('Authorization', `Bearer ${account.token}`)
        .set('x-workspace-id', account.workspaceId),
    );
  const list = (account: { token: string; workspaceId: string }) =>
    ctx.answer(
      InsightList,
      request(ctx.app.getHttpServer())
        .get('/insights?limit=50&locale=en')
        .set('Authorization', `Bearer ${account.token}`)
        .set('x-workspace-id', account.workspaceId),
    );

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member One');
    other = await registerAccount(ctx.app, otherEmail, 'Member Two');
    await ctx.call('patch', `/workspaces/${ctx.owner.workspaceId}`, { currency: 'EUR' }).expect(200);

    const category = (name: string) =>
      ctx.dataSource.getRepository(Category).save({
        workspaceId: ctx.owner.workspaceId,
        userId: ctx.owner.userId,
        name,
        type: CategoryType.EXPENSE,
      } as Category);
    const groceries = await category('Groceries');
    const repairs = await category('Home Repairs');
    const gifts = await category('Gifts');
    repairsId = repairs.id;
    giftsId = gifts.id;

    for (let monthsAgo = 1; monthsAgo <= 6; monthsAgo += 1) {
      await expense(groceries.id, 2_000, firstOf(monthsAgo));
      await expense(repairs.id, 300, firstOf(monthsAgo));
      await expense(gifts.id, 300, firstOf(monthsAgo));
    }
    // Three times the usual month on repairs.
    await expense(repairs.id, 900, firstOf(0));
    // Private rows far above the usual gifts: they count, but are nobody's to name.
    // One as the app files them (in Private, the real category kept aside), one
    // as an older row may still be (private, yet in its own category).
    const privateCategory = await ctx.dataSource.getRepository(Category).save({
      workspaceId: ctx.owner.workspaceId,
      name: 'Private',
      type: CategoryType.EXPENSE,
      isSystem: true,
    } as Category);
    await expense(privateCategory.id, 4_000, firstOf(0), {
      isPrivate: true,
      privateCategoryId: gifts.id,
    });
    await expense(gifts.id, 5_000, firstOf(0), { isPrivate: true });
    // Rows that must not count: a duplicate, an unconfirmed one, a transfer leg.
    await expense(groceries.id, 50_000, firstOf(0), { isDuplicate: true });
    await expense(groceries.id, 50_000, firstOf(0), { isVerified: false });
    await expense(groceries.id, 50_000, firstOf(0), { transferPairId: randomUUID() });

    // 90 000 held since the start, and a payment two days ago takes net worth past 100 000.
    wallet = await ctx.dataSource.getRepository(Wallet).save({
      workspaceId: ctx.owner.workspaceId,
      userId: ctx.owner.userId,
      name: 'Everyday account',
      type: 'checking',
      currency: 'EUR',
      initialBalance: 90_000,
      isActive: true,
    } as unknown as Wallet);
    await save({
      walletId: wallet.id,
      transactionType: TransactionType.INCOME,
      amount: 12_000,
      credit: 12_000,
      debit: null,
      transactionDate: daysAgo(2),
    });

    // The other workspace: an old receipt, a long pause, then two months of
    // 2 000 and 10 000 in the account. Two months of history, not ten: the
    // empty months between are missing data, not months of no spending, and
    // the first workspace's six months are not this one's.
    await ctx.dataSource
      .getRepository(Workspace)
      .update({ id: other.workspaceId }, { currency: 'EUR' });
    const otherWallet = await ctx.dataSource.getRepository(Wallet).save({
      workspaceId: other.workspaceId,
      userId: other.userId,
      name: 'Everyday account',
      type: 'checking',
      currency: 'EUR',
      initialBalance: 10_000,
      isActive: true,
    } as unknown as Wallet);
    for (const [monthsAgo, amount] of [
      [10, 20],
      [2, 2_000],
      [1, 2_000],
    ]) {
      await save({
        workspaceId: other.workspaceId,
        walletId: otherWallet.id,
        amount,
        debit: amount,
        credit: null,
        transactionDate: firstOf(monthsAgo),
      });
    }
  });

  afterAll(async () => {
    await deleteUserByEmail(ctx.dataSource, email);
    await deleteUserByEmail(ctx.dataSource, otherEmail);
    await ctx.app.close();
  });

  it('writes each card once for the workspace whose numbers support it', async () => {
    const first = await refresh(ctx.owner);
    expect(
      first.newInsights.map(item => item.type).filter(type => NEW_KEYS.includes(type)).sort(),
    ).toEqual([...NEW_KEYS].sort());

    const second = await refresh(ctx.owner);
    expect(second.newInsights.filter(item => NEW_KEYS.includes(item.type))).toEqual([]);

    const cards = (await list(ctx.owner)).items;
    for (const key of NEW_KEYS) {
      expect(cards.filter(card => card.messageKey === key)).toHaveLength(1);
    }

    const anomaly = cards.find(card => card.messageKey === 'trend.category_anomaly');
    expect(anomaly).toMatchObject({ type: 'trend.category_anomaly', severity: 'warn' });
    expect(anomaly?.messageParams).toMatchObject({
      category: 'Home Repairs',
      currentAmount: 900,
      usualAmount: 300,
    });
    // The unusual card replaces the rising one about the same category.
    expect(
      cards.filter(
        card => card.messageKey === 'trend.category_rising' && card.data?.categoryName === 'Home Repairs',
      ),
    ).toEqual([]);

    const idle = cards.find(card => card.messageKey === 'pattern.idle_cash');
    // Spending is 2 600 a month: the 5 000 private row is this month's, and
    // the duplicate, unconfirmed and transfer rows never count.
    expect(idle?.data).toMatchObject({ cash: 102_000, monthlySpending: 2_600 });

    const milestone = cards.find(card => card.messageKey === 'pattern.net_worth_milestone');
    expect(milestone?.messageParams).toMatchObject({ milestoneAmount: 100_000 });
    expect(milestone?.title).toBe('Net worth passed €100,000');
  });

  it('never names a private row’s category, nor the Private one', async () => {
    const cards = (await list(ctx.owner)).items.filter(card =>
      NEW_KEYS.includes(card.messageKey ?? ''),
    );
    const text = cards.map(card => `${card.title} ${card.message} ${JSON.stringify(card.data)}`);
    expect(text.filter(line => /Gifts|Private/.test(line))).toEqual([]);
  });

  it('announces each unusual category once, however their order changes', async () => {
    // Gifts goes past Home Repairs, then Home Repairs past Gifts again: one
    // new card for Gifts, and Home Repairs is never retired and written anew.
    await expense(giftsId, 2_000, firstOf(0));
    const gifts = await refresh(ctx.owner);
    expect(unusual(gifts.newInsights)).toEqual(['Unusual spending on "Gifts"']);

    await expense(repairsId, 3_000, firstOf(0));
    const repairs = await refresh(ctx.owner);
    expect(unusual(repairs.newInsights)).toEqual([]);
    expect(unusual((await list(ctx.owner)).items).sort()).toEqual([
      'Unusual spending on "Gifts"',
      'Unusual spending on "Home Repairs"',
    ]);
  });

  it('writes none of them for another workspace', async () => {
    await refresh(other);
    const cards = (await list(other)).items;
    expect(cards.filter(card => NEW_KEYS.includes(card.messageKey ?? ''))).toEqual([]);
  });
});

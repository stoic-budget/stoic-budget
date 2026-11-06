vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { CategorizationRule } from '../../src/entities/categorization-rule.entity';
import { Category, CategoryType } from '../../src/entities/category.entity';
import { Payee } from '../../src/entities/payee.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../src/entities/subscription.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../src/entities/transaction.entity';
import { Wallet } from '../../src/entities/wallet.entity';
import { RuleHealthService } from '../../src/modules/classification/services/rule-health.service';
import { StoicBehaviorService } from '../../src/modules/insights/stoic/stoic-behavior.service';
import { InsightList } from '../../src/contracts';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

const PAYEE_NAME = 'ACME Store';
const BANK_SPELLING = 'ACME STORE 12';
const OTHER_SPELLING = 'ACME STORE 34';

const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12);

/** Advice read against a real database: the queries here are the ones mocks cannot check. */
describe('Advice on real rows (e2e)', () => {
  const email = `advice-${randomUUID()}@example.com`;
  let ctx: ContractApp;
  let spending: Category;
  let other: Category;
  let payee: Payee;

  const expense = (overrides: Partial<Transaction>) =>
    ctx.dataSource.getRepository(Transaction).save({
      workspaceId: ctx.owner.workspaceId,
      transactionDate: firstOfMonth,
      counterpartyName: BANK_SPELLING,
      paymentPurpose: 'purchase',
      amount: 10,
      debit: 10,
      credit: null,
      currency: 'USD',
      transactionType: TransactionType.EXPENSE,
      isVerified: true,
      categoryId: spending.id,
      categorySource: TransactionCategorySource.MANUAL,
      ...overrides,
    } as Transaction);

  const saveRule = (overrides: Partial<CategorizationRule>) =>
    ctx.dataSource.getRepository(CategorizationRule).save({
      userId: ctx.owner.userId,
      workspaceId: ctx.owner.workspaceId,
      name: 'Store rule',
      conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'ACME STORE' }],
      result: { categoryId: other.id },
      ...overrides,
    } as CategorizationRule);

  const cards = async () => {
    await ctx.call('post', '/insights/refresh?locale=en').expect(200);
    return ctx.answer(InsightList, ctx.call('get', '/insights?limit=50&locale=en'));
  };

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member Owner');
    const categories = ctx.dataSource.getRepository(Category);
    spending = await categories.save({
      workspaceId: ctx.owner.workspaceId,
      userId: ctx.owner.userId,
      name: 'Spending',
      type: CategoryType.EXPENSE,
    } as Category);
    other = await categories.save({
      workspaceId: ctx.owner.workspaceId,
      userId: ctx.owner.userId,
      name: 'Other spending',
      type: CategoryType.EXPENSE,
    } as Category);
    payee = await ctx.dataSource
      .getRepository(Payee)
      .save({ workspaceId: ctx.owner.workspaceId, name: PAYEE_NAME } as Payee);
  });

  afterAll(async () => {
    await deleteUserByEmail(ctx.dataSource, email);
    await ctx.app.close();
  });

  it('reads one shop under two bank spellings as one, and a split as one purchase', async () => {
    const splitGroupId = randomUUID();
    await expense({ payeeId: payee.id, amount: 5, debit: 5 });
    for (const splitIndex of [0, 1, 2]) {
      await expense({
        payeeId: payee.id,
        counterpartyName: OTHER_SPELLING,
        splitGroupId,
        splitIndex,
        categoryId: splitIndex === 0 ? spending.id : other.id,
      });
    }
    await expense({ payeeId: payee.id, isVerified: false });
    await ctx.dataSource.getRepository(Subscription).save({
      workspaceId: ctx.owner.workspaceId,
      userId: ctx.owner.userId,
      vendorName: 'Detected Service',
      amount: 99,
      currency: 'USD',
      frequency: SubscriptionFrequency.MONTHLY,
      status: SubscriptionStatus.DETECTED,
    } as unknown as Subscription);

    const behavior = await ctx.app
      .get(StoicBehaviorService)
      .load(ctx.owner.workspaceId, 'USD', monthStart);

    const merchant = behavior.merchants.find(item => item.name === PAYEE_NAME);
    expect(merchant).toMatchObject({ count: 2, total: 35, bankName: OTHER_SPELLING });
    expect(behavior.unconfirmedRows).toBe(1);
    expect(behavior.subscriptions.count).toBe(0);
  });

  it('counts savings and deposits in the reserve, not in what can be spent', async () => {
    const wallets = ctx.dataSource.getRepository(Wallet);
    for (const [type, initialBalance] of [
      ['checking', 100],
      ['savings', 5000],
      ['deposit', 1000],
      ['brokerage', 7000],
    ] as const) {
      await wallets.save({
        workspaceId: ctx.owner.workspaceId,
        userId: ctx.owner.userId,
        name: `Account ${type}`,
        type,
        currency: 'USD',
        initialBalance,
      } as unknown as Wallet);
    }

    const reserve = await ctx.app
      .get(StoicBehaviorService)
      .reserve(ctx.owner.workspaceId, 'USD', -1);

    expect(reserve).toBe(6100);
  });

  it('finds a broken rule and a disputed one in the database', async () => {
    const broken = await saveRule({ name: 'Broken rule', result: { categoryId: randomUUID() } });
    const disputed = await saveRule({ name: 'Disputed rule', priority: 5 });
    for (let index = 0; index < 3; index += 1) {
      await expense({ categoryId: spending.id });
    }

    const health = await ctx.app.get(RuleHealthService).load(
      ctx.owner.workspaceId,
      ctx.owner.userId,
      {
        start: monthStart,
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      },
    );

    expect(health.broken).toEqual([{ id: broken.id, name: 'Broken rule' }]);
    expect(health.contradicted[0]).toMatchObject({ id: disputed.id });
    expect(health.contradicted[0].count).toBeGreaterThanOrEqual(3);
    expect(health.filed.total).toBeGreaterThan(0);

    await ctx.dataSource.getRepository(CategorizationRule).delete({ id: disputed.id });
  });

  it('writes advice about the rule, reads every source, and retires it once fixed', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');

    const before = await cards();

    const failedSources = warn.mock.calls
      .map(([message]) => message as { type?: string; source?: string })
      .filter(message => message?.type === 'stoic_source_failed');
    expect(failedSources).toEqual([]);
    warn.mockRestore();

    const card = before.items.find(item => item.messageKey === 'stoic.rule_broken');
    expect(card).toMatchObject({ type: 'stoic.rule', category: 'stoic', severity: 'info' });
    expect(card?.data?.priority).toBe(55);

    await ctx.dataSource
      .getRepository(CategorizationRule)
      .delete({ workspaceId: ctx.owner.workspaceId });

    const after = await cards();
    expect(after.items.map(item => item.messageKey)).not.toContain('stoic.rule_broken');
  });

  it('keeps every card within Stoicism', async () => {
    const { items } = await cards();
    for (const item of items) {
      expect(item.type).not.toMatch(/^expert\./);
      expect(item.data?.expert).toBeUndefined();
    }
  });
});

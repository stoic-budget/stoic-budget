vi.mock('franc', () => ({
  franc: () => 'und',
}));

import {
  BudgetList,
  DashboardCashFlowEntriesResponse,
  MonthGoalList,
  PayPeriodsResponse,
  periodBounds,
  periodOf,
  SubscriptionMonthStatus,
  WorkspaceActivity,
  WorkspaceSummary,
} from '../../src/contracts';
import { AuditEvent, EntityType } from '../../src/entities/audit-event.entity';
import { ReferenceData } from '../../src/entities/reference-data.entity';
import { SubscriptionChargeMatchStatus } from '../../src/entities/subscription-charge.entity';
import { SubscriptionCharge } from '../../src/entities/subscription-charge.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../src/entities/transaction.entity';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail } from './helpers/e2e-app';

const PAYER = 'ACME Payroll';
const SHOP = 'ACME Store - Wireless Buds';

const pad = (value: number) => String(value).padStart(2, '0');
const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * The workspace's own month (`settings.monthStart`), end to end: the setting
 * is stored, `GET /pay-periods` answers with data, and the services that sum
 * "a month" move their bounds with it — proving each one really gets the rule.
 */
describe('API contracts: pay periods (e2e)', () => {
  const email = `contracts-pay-periods-${Date.now()}@example.com`;
  let ctx: ContractApp;
  let categoryId: string;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);
  const answer: ContractApp['answer'] = (schema, pending) => ctx.answer(schema, pending);

  const setMonthStart = (monthStart: object) =>
    answer(WorkspaceSummary, call('patch', `/workspaces/${ctx.owner.workspaceId}`, { monthStart }));

  const saveRow = (overrides: Partial<Transaction>) =>
    ctx.dataSource.getRepository(Transaction).save({
      workspaceId: ctx.owner.workspaceId,
      counterpartyName: SHOP,
      paymentPurpose: 'purchase',
      amount: 10,
      debit: 10,
      credit: null,
      currency: 'USD',
      transactionType: TransactionType.EXPENSE,
      isVerified: true,
      categoryId,
      categorySource: TransactionCategorySource.MANUAL,
      ...overrides,
    } as Transaction);

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member One');
    const categories = await call('get', '/categories?type=expense').expect(200);
    categoryId = categories.body[0].id;
  });

  afterAll(async () => {
    await deleteUserByEmail(ctx.dataSource, email);
    await ctx.app.close();
  });

  it('stores the setting and keeps the other settings', async () => {
    await call('patch', `/workspaces/${ctx.owner.workspaceId}`, { plugins: { webhooks: true } });
    const saved = await setMonthStart({ kind: 'day', day: 15 });
    expect(saved.settings).toMatchObject({ monthStart: { kind: 'day', day: 15 } });
    expect(saved.settings?.plugins).toMatchObject({ webhooks: true });
    await call('patch', `/workspaces/${ctx.owner.workspaceId}`, {
      monthStart: { kind: 'day', day: 32 },
    }).expect(400);
    await call('patch', `/workspaces/${ctx.owner.workspaceId}`, {
      monthStart: { kind: 'weekly' },
    }).expect(400);
  });

  it('answers the detected salary with its paydays', async () => {
    // Paid on the 25th for four months before the current one.
    const today = new Date();
    for (let back = 4; back >= 1; back -= 1) {
      await saveRow({
        counterpartyName: PAYER,
        transactionDate: new Date(today.getFullYear(), today.getMonth() - back, 25),
        amount: 3000,
        credit: 3000,
        debit: null,
        transactionType: TransactionType.INCOME,
        categoryId: null,
      } as Partial<Transaction>);
    }
    await setMonthStart({ kind: 'salary' });
    const periods = await answer(PayPeriodsResponse, call('get', '/pay-periods'));
    expect(periods.monthStart).toEqual({ kind: 'salary' });
    expect(periods.salary?.dayOfMonth).toBe(25);
    expect(periods.salary?.paydays).toHaveLength(4);
    expect(periods.current.from <= dayOf(today) && dayOf(today) <= periods.current.to).toBe(true);
  });

  it('answers the holidays the last business day skips', async () => {
    const jurisdiction = await ctx.dataSource.query(
      `SELECT id FROM tax_jurisdictions WHERE code = 'DE' LIMIT 1`,
    );
    expect(jurisdiction.length).toBe(1);
    await ctx.dataSource.query(`UPDATE workspaces SET tax_jurisdiction_id = $1 WHERE id = $2`, [
      jurisdiction[0].id,
      ctx.owner.workspaceId,
    ]);
    const year = new Date().getFullYear();
    for (const target of [year - 2, year - 1, year, year + 1]) {
      await ctx.dataSource.getRepository(ReferenceData).upsert(
        {
          source: 'openholidays',
          key: `DE:${target}`,
          payload: { holidays: [{ date: `${target}-12-25`, name: 'Christmas Day' }] },
          fetchedAt: new Date(),
        },
        ['source', 'key'],
      );
    }
    await setMonthStart({ kind: 'last_business_day' });
    const periods = await answer(PayPeriodsResponse, call('get', '/pay-periods'));
    expect(periods.holidayCountry).toBe('DE');
    expect(periods.holidays).toContain(`${year}-12-25`);
  });

  it('moves the dashboard month and its entries', async () => {
    // A month long past, so the bounds do not depend on today.
    await saveRow({ transactionDate: new Date(2025, 2, 10), counterpartyName: 'ACME Store - March' });
    await saveRow({ transactionDate: new Date(2025, 3, 10), counterpartyName: 'ACME Store - April' });
    const names = async () => {
      const entries = await answer(
        DashboardCashFlowEntriesResponse,
        call('get', '/dashboard/cash-flow/entries?month=2025-03'),
      );
      return entries.entries.map(entry => entry.name);
    };
    await setMonthStart({ kind: 'day', day: 1 });
    expect(await names()).toEqual(['ACME Store - March']);
    await setMonthStart({ kind: 'day', day: 15 });
    expect(await names()).toEqual(['ACME Store - April']);
  });

  it('moves the month status of subscriptions', async () => {
    const created = await call('post', '/subscriptions', {
      vendorName: 'ACME Cloud - Storage',
      amount: 9,
      frequency: 'monthly',
      currency: 'USD',
      categoryId,
      nextChargeDate: dayOf(new Date(Date.now() + 5 * 86_400_000)),
    }).expect(201);
    for (const chargeDate of ['2025-03-10', '2025-04-10']) {
      await ctx.dataSource.getRepository(SubscriptionCharge).save({
        workspaceId: ctx.owner.workspaceId,
        subscriptionId: created.body.id,
        amount: '9.00',
        currency: 'USD',
        chargeDate,
        expectedAmount: '9.00',
        matchStatus: SubscriptionChargeMatchStatus.MATCHED,
      } as unknown as SubscriptionCharge);
    }
    const paidOn = async () => {
      const status = await answer(
        SubscriptionMonthStatus,
        call('get', '/subscriptions/month-status?month=2025-03'),
      );
      return status.items.map(item => item.nextChargeDate);
    };
    await setMonthStart({ kind: 'day', day: 1 });
    expect(await paidOn()).toEqual(['2025-03-10']);
    await setMonthStart({ kind: 'day', day: 15 });
    expect(await paidOn()).toEqual(['2025-04-10']);
  });

  it('moves the period a monthly budget spends in', async () => {
    const today = new Date();
    // A start day after today puts the start of the running month in the
    // previous calendar month; from the 28th on, day 2 puts the 1st outside it.
    const late = today.getDate() >= 28;
    const monthStart = late ? { kind: 'day', day: 2 } : { kind: 'day', day: 28 };
    const rule = { monthStart } as Parameters<typeof periodBounds>[0];
    const running = periodBounds(rule, periodOf(rule, dayOf(today)));
    const spentOn = late ? `${dayOf(today).slice(0, 8)}01` : running.from;
    const inCalendar = spentOn.slice(0, 7) === dayOf(today).slice(0, 7);
    const inRule = running.from <= spentOn && spentOn <= running.to;
    expect(inCalendar).not.toBe(inRule);

    const category = await call('post', '/categories', { name: 'Gadgets', type: 'expense' }).expect(
      201,
    );
    await call('post', '/budgets', {
      name: 'Gadgets',
      categoryId: category.body.id,
      limitAmount: 100,
      periodType: 'monthly',
    }).expect(201);
    const [year, month, day] = spentOn.split('-').map(Number);
    await saveRow({ categoryId: category.body.id, transactionDate: new Date(year, month - 1, day), amount: 30, debit: 30 });
    const spent = async () => {
      const budgets = await answer(BudgetList, call('get', '/budgets'));
      return budgets.find(budget => budget.categoryId === category.body.id)?.spentAmount;
    };
    await setMonthStart({ kind: 'day', day: 1 });
    expect(await spent()).toBe(inCalendar ? 30 : 0);
    await setMonthStart(monthStart);
    expect(await spent()).toBe(inRule ? 30 : 0);
  });

  it('moves the month of the goals card and of the activity card', async () => {
    // Under day 25, "2025-11" runs 25 Oct to 24 Nov 2025: the 28th of October is in it.
    const goal = await call('post', '/goals', { name: 'Trip', targetAmount: 500 }).expect(201);
    await call('post', `/goals/${goal.body.id}/contributions`, {
      amount: 40,
      contributionDate: '2025-10-28',
    }).expect(201);
    await ctx.dataSource
      .getRepository(AuditEvent)
      .update(
        { workspaceId: ctx.owner.workspaceId, entityType: EntityType.GOAL },
        { createdAt: new Date(2025, 9, 28, 12) },
      );
    const goalsIn = async (month: string) =>
      (await answer(MonthGoalList, call('get', `/goals?month=${month}`))).map(row => [
        row.name,
        row.contributedInMonth,
      ]);
    const activityIn = async (month: string) =>
      (await answer(WorkspaceActivity, call('get', `/audit-events/activity?month=${month}`))).items
        .filter(item => item.entityType === EntityType.GOAL)
        .map(item => item.entityId);

    await setMonthStart({ kind: 'day', day: 1 });
    expect(await goalsIn('2025-10')).toEqual([['Trip', 40]]);
    expect(await goalsIn('2025-11')).toEqual([]);
    expect(await activityIn('2025-10')).toContain(goal.body.id);
    expect(await activityIn('2025-11')).toEqual([]);

    await setMonthStart({ kind: 'day', day: 25 });
    expect(await goalsIn('2025-10')).toEqual([]);
    expect(await goalsIn('2025-11')).toEqual([['Trip', 40]]);
    expect(await activityIn('2025-10')).toEqual([]);
    expect(await activityIn('2025-11')).toContain(goal.body.id);
  });
});

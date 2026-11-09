vi.mock('franc', () => ({
  franc: () => 'und',
}));

import request from 'supertest';
import { PaycheckPlanResponse, ViewPreferenceState } from '../../src/contracts';
import { Payable, PayableStatus } from '../../src/entities/payable.entity';
import {
  SubscriptionCharge,
  SubscriptionChargeMatchStatus,
} from '../../src/entities/subscription-charge.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { type ContractApp, startContractApp } from './helpers/contract-app';
import { deleteUserByEmail, type E2eAccount, registerAccount } from './helpers/e2e-app';

const PAYER = 'ACME Payroll';
const PARTNER_PAYER = 'Example Bonus Ltd';
const RENT = 'ACME Rent';
const PAID_EARLY = 'ACME Power';
const PARTLY_PAID = 'ACME Phone';
const ABROAD = 'Example Studio Abroad';
const STREAMING = 'ACME Streaming';
// A code no provider knows, so the rate is the hand-entered one and never the network's.
const EXOTIC = 'ZZX';
// Only a goal is saved in this one, so its rate is named because of the goal.
const GOAL_CURRENCY = 'ZZY';
const TRIP = 'Example Trip';
const PAID_AHEAD = 'ACME Music';
const PAID_LATE = 'ACME News';

const pad = (value: number) => String(value).padStart(2, '0');
const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const daysFromToday = (days: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * `GET /forecast/paychecks` end to end: paydays from a detected salary,
 * bills and subscriptions from the commitments, starting cash from the
 * chosen accounts, foreign amounts at the named rate — and nothing of
 * another workspace or of another member's private rows.
 */
describe('API contracts: paycheck plan (e2e)', () => {
  const stamp = Date.now();
  const email = `contracts-paycheck-${stamp}@example.com`;
  const emails = {
    partner: `contracts-paycheck-partner-${stamp}@example.com`,
    other: `contracts-paycheck-other-${stamp}@example.com`,
  };
  let ctx: ContractApp;
  let partner: E2eAccount;
  let other: E2eAccount;
  let checkingId: string;
  let cashBoxId: string;
  const call: ContractApp['call'] = (...args) => ctx.call(...args);
  const answer: ContractApp['answer'] = (schema, pending) => ctx.answer(schema, pending);
  const as = (account: E2eAccount, url: string) =>
    request(ctx.app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', account.workspaceId);

  const income = (workspaceId: string, counterpartyName: string, daysAgo: number, extra = {}) =>
    ctx.dataSource.getRepository(Transaction).save({
      workspaceId,
      counterpartyName,
      paymentPurpose: 'salary',
      amount: 3000,
      credit: 3000,
      debit: null,
      currency: 'USD',
      transactionType: TransactionType.INCOME,
      transactionDate: daysFromToday(-daysAgo),
      isVerified: true,
      ...extra,
    } as Partial<Transaction> as Transaction);

  const createPayable = async (vendor: string, amount: number, inDays: number, currency = 'USD') =>
    (
      await call('post', '/payables', {
        vendor,
        amount,
        currency,
        dueDate: dayOf(daysFromToday(inDays)),
      }).expect(201)
    ).body.id as string;

  beforeAll(async () => {
    ctx = await startContractApp(email, 'Member One');
    partner = await registerAccount(ctx.app, emails.partner, 'Member Two');
    other = await registerAccount(ctx.app, emails.other, 'Member Three');
    await call('patch', `/workspaces/${ctx.owner.workspaceId}`, { currency: 'USD' }).expect(200);
    const invite = await call('post', `/workspaces/${ctx.owner.workspaceId}/invitations`, {
      email: partner.email,
      role: 'member',
      permissions: { canEditStatements: true },
    }).expect(201);
    await request(ctx.app.getHttpServer())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    const [partnerMember] = await ctx.dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [ctx.owner.workspaceId, partner.userId],
    );
    partner = { ...partner, workspaceId: ctx.owner.workspaceId };

    // A salary every 30 days; the last one 20 days ago, so the next is ahead.
    for (const daysAgo of [110, 80, 50, 20]) {
      await income(ctx.owner.workspaceId, PAYER, daysAgo);
    }
    // The partner's own private income: theirs to plan on, nobody else's.
    for (const daysAgo of [95, 65, 35, 5]) {
      await income(ctx.owner.workspaceId, PARTNER_PAYER, daysAgo, {
        amount: 9000,
        credit: 9000,
        isPrivate: true,
        ownerMemberId: partnerMember.id,
      });
    }

    checkingId = (
      await call('post', '/wallets', {
        name: 'Checking',
        type: 'checking',
        currency: 'USD',
        initialBalance: 5000,
      }).expect(201)
    ).body.id;
    cashBoxId = (
      await call('post', '/wallets', {
        name: 'Cash box',
        type: 'cash',
        currency: 'USD',
        initialBalance: 1000,
      }).expect(201)
    ).body.id;

    await call('post', '/exchange-rates/manual', { from: EXOTIC, to: 'USD', rate: 0.5 }).expect(
      201,
    );
    await createPayable(RENT, 500, 1);
    await createPayable(ABROAD, 400, 2, EXOTIC);
    const paidEarly = await createPayable(PAID_EARLY, 80, 2);
    const partlyPaid = await createPayable(PARTLY_PAID, 300, 2);
    const payables = ctx.dataSource.getRepository(Payable);
    await payables.update(paidEarly, { status: PayableStatus.PAID, paidAmount: 80 });
    await payables.update(partlyPaid, { status: PayableStatus.PARTIALLY_PAID, paidAmount: 100 });

    const subscription = await call('post', '/subscriptions', {
      vendorName: STREAMING,
      amount: 20,
      frequency: 'monthly',
      currency: 'USD',
      nextChargeDate: dayOf(daysFromToday(3)),
    }).expect(201);
    await call('post', `/subscriptions/${subscription.body.id}/confirm`).expect(201);
  });

  afterAll(async () => {
    for (const address of [email, ...Object.values(emails)]) {
      await deleteUserByEmail(ctx.dataSource, address);
    }
    await ctx.app.close();
  });

  it('plans payday to payday from the detected salary, with the bills due before it', async () => {
    const plan = await answer(PaycheckPlanResponse, call('get', '/forecast/paychecks?buffer=100'));
    const today = dayOf(new Date());

    expect(plan).toMatchObject({ currency: 'USD', today, basis: 'paydays', incomeStatus: 'regular' });
    expect(plan.streams).toEqual([
      expect.objectContaining({ label: PAYER, kind: 'detected', cadence: 'monthly', selected: true }),
    ]);
    expect(plan.periods).toHaveLength(4);
    const [current, next] = plan.periods;
    expect(current.start <= today && today <= current.end).toBe(true);
    expect(next.start).toBe(current.nextPayday);
    expect(next.items[0]).toMatchObject({ kind: 'income', label: PAYER, amount: 3000 });

    // Paid early is gone; partly paid owes the rest; the foreign bill at the named rate.
    const due = Object.fromEntries(current.items.map(item => [item.label, item.amount]));
    expect(due).toEqual({ [RENT]: -500, [ABROAD]: -200, [PARTLY_PAID]: -200, [STREAMING]: -20 });
    expect(plan.rates).toEqual([{ currency: EXOTIC, rate: 0.5, rateDate: today }]);
    expect(current).toMatchObject({
      startingCash: 6000,
      startingCashProjected: false,
      income: 0,
      commitments: 920,
      safeToSpend: 6000 - 920 - 100,
    });
    expect(current.safeToSpendPerDay).toBeCloseTo((6000 - 920 - 100) / current.daysLeft, 2);
    // Spending what was safe leaves the buffer for the next period.
    expect(next).toMatchObject({ startingCash: 100, startingCashProjected: true });
  });

  it('reads the starting cash from the chosen accounts only', async () => {
    const plan = await answer(
      PaycheckPlanResponse,
      call('get', `/forecast/paychecks?walletIds=${checkingId}`),
    );
    expect(plan.periods[0].startingCash).toBe(5000);
    expect(plan.accounts).toEqual([
      expect.objectContaining({ id: cashBoxId, name: 'Cash box', balance: 1000, selected: false }),
      expect.objectContaining({ id: checkingId, name: 'Checking', balance: 5000, selected: true }),
    ]);
  });

  it('falls back to the workspace month when no stream is chosen', async () => {
    const plan = await answer(PaycheckPlanResponse, call('get', '/forecast/paychecks?streams=none'));
    expect(plan.basis).toBe('month');
    expect(plan.streams.every(stream => !stream.selected)).toBe(true);
    expect(plan.periods).toHaveLength(4);
    expect(plan.periods.every(period => period.nextPayday === null)).toBe(true);
  });

  it("never counts or names another member's private income", async () => {
    const plan = await answer(PaycheckPlanResponse, call('get', '/forecast/paychecks'));
    const labels = plan.periods.flatMap(period => period.items.map(item => item.label));
    expect(plan.streams.map(stream => stream.label)).toEqual([PAYER]);
    expect(labels).not.toContain(PARTNER_PAYER);
    expect(labels).not.toContain('—');
    expect(plan.periods.flatMap(period => period.items).filter(item => item.kind === 'income')).toEqual(
      plan.periods
        .flatMap(period => period.items)
        .filter(item => item.kind === 'income' && item.label === PAYER),
    );

    // The partner plans on it: the row is theirs.
    const own = await answer(PaycheckPlanResponse, as(partner, '/forecast/paychecks'));
    expect(own.streams.map(stream => stream.label).sort()).toEqual([PARTNER_PAYER, PAYER].sort());
  });

  it("shows another workspace nothing of this one, even when asked for its ids", async () => {
    const owners = await answer(PaycheckPlanResponse, call('get', '/forecast/paychecks'));
    const streamId = owners.streams[0].id;
    const plan = await answer(
      PaycheckPlanResponse,
      as(other, `/forecast/paychecks?walletIds=${checkingId}&streams=${streamId}`),
    );
    expect(plan).toMatchObject({ basis: 'month', incomeStatus: 'none', streams: [], accounts: [] });
    expect(plan.periods[0].startingCash).toBe(0);
    expect(plan.periods.flatMap(period => period.items)).toEqual([]);
  });

  it('says income is irregular when it comes in but no payer repeats', async () => {
    await income(other.workspaceId, 'Example One-off Client', 12);
    const plan = await answer(PaycheckPlanResponse, as(other, '/forecast/paychecks'));
    expect(plan).toMatchObject({ basis: 'month', incomeStatus: 'irregular', streams: [] });
  });

  it('names the rate of a goal it converted, and tells a charge paid early from one paid late', async () => {
    await call('post', '/exchange-rates/manual', { from: GOAL_CURRENCY, to: 'USD', rate: 2 }).expect(
      201,
    );
    await call('post', '/goals', {
      name: TRIP,
      targetAmount: 600,
      currency: GOAL_CURRENCY,
      targetDate: dayOf(daysFromToday(200)),
    }).expect(201);
    const subscribe = async (vendorName: string, paidDaysAgo: number[]) => {
      const created = await call('post', '/subscriptions', {
        vendorName,
        amount: 15,
        frequency: 'monthly',
        currency: 'USD',
        nextChargeDate: dayOf(daysFromToday(5)),
      }).expect(201);
      await call('post', `/subscriptions/${created.body.id}/confirm`).expect(201);
      for (const daysAgo of paidDaysAgo) {
        await ctx.dataSource.getRepository(SubscriptionCharge).save({
          workspaceId: ctx.owner.workspaceId,
          subscriptionId: created.body.id,
          transactionId: null,
          amount: 15,
          currency: 'USD',
          chargeDate: daysFromToday(-daysAgo),
          expectedAmount: 15,
          expectedDate: daysFromToday(5),
          matchStatus: SubscriptionChargeMatchStatus.MATCHED,
        } as Partial<SubscriptionCharge> as SubscriptionCharge);
      }
    };
    // Last month's charge paid on time, this one three days ahead of its date.
    await subscribe(PAID_AHEAD, [3, 25]);
    // The charge before was paid only three days ago, late: the coming one is still owed.
    await subscribe(PAID_LATE, [3, 55]);

    const plan = await answer(PaycheckPlanResponse, call('get', '/forecast/paychecks'));
    const items = plan.periods.flatMap(period => period.items);
    expect(plan.rates.map(rate => rate.currency)).toEqual([EXOTIC, GOAL_CURRENCY]);
    // 600 at 2 over the months left, never at 1:1.
    const trip = items.filter(item => item.label === TRIP);
    expect(trip.length).toBeGreaterThan(0);
    expect(trip[0].amount).toBeLessThanOrEqual(-1200 / 7);
    const first = (label: string) => items.find(item => item.label === label)?.date ?? null;
    expect(first(PAID_LATE)).toBe(dayOf(daysFromToday(5)));
    expect(first(PAID_AHEAD)).not.toBe(dayOf(daysFromToday(5)));
  });

  it('remembers the planner choices per person', async () => {
    const state = { streams: ['detected:x'], walletIds: null, buffer: 50 };
    await call('put', '/view-preferences/forecast', { state }).expect(200);
    const saved = await answer(ViewPreferenceState, call('get', '/view-preferences/forecast'));
    expect(saved.state).toEqual(state);
  });
});

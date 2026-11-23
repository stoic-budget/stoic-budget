/**
 * Integration test — money spent in another currency converts at each day's rate, against a real Postgres.
 *
 * Reports convert every row at the rate of its own day. The dashboard, the
 * spend flow and the Stoic advice must come to the same figure for the same
 * spending, so each of them groups its rows by day before converting. The
 * queries are real here: a GROUP BY that Postgres refuses fails this test,
 * where a mocked query builder would not.
 */
import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  Category,
  CategoryType,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { BudgetWithinLimitService } from '../../src/modules/budgets/budget-within-limit.service';
import { BudgetsService } from '../../src/modules/budgets/budgets.service';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { GoalsService } from '../../src/modules/goals/goals.service';
import { StoicBehaviorService } from '../../src/modules/insights/stoic/stoic-behavior.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { SpendFlowService } from '../../src/modules/reports/spend-flow.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { TaxReserveService } from '../../src/modules/tax/tax-reserve.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_day_rate_flows_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded through Vite: TypeORM's glob loader would bypass the test transform. */
function loadMigrations(): Function[] {
  const modules = import.meta.glob<Record<string, unknown>>('../../src/migrations/*.ts', {
    eager: true,
  });
  return Object.keys(modules)
    .sort()
    .flatMap(file =>
      Object.values(modules[file]).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

// A whole past month, so nothing is cut at today.
const MONTH = `${new Date().getFullYear() - 1}-03`;
const DAY_ONE = `${MONTH}-04`;
const DAY_TWO = `${MONTH}-16`;
/** Shekels to dollars on each day, and today: a different rate each time. */
const RATE_ON: Record<string, number> = { [DAY_ONE]: 0.3, [DAY_TWO]: 0.25 };
const RATE_TODAY = 0.2;
const SPENT_EACH_DAY = 100;
/** What Reports make of the two days: each at its own rate. */
const SPENT_USD = SPENT_EACH_DAY * RATE_ON[DAY_ONE] + SPENT_EACH_DAY * RATE_ON[DAY_TWO];

/** The latest quote on or before `date`; today's without one. */
function rateOn(date: Date | string | undefined): number {
  if (date === undefined) return RATE_TODAY;
  const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const quoted = Object.keys(RATE_ON)
    .filter(quoteDay => quoteDay <= day)
    .sort();
  return quoted.length > 0 ? RATE_ON[quoted[quoted.length - 1]] : RATE_TODAY;
}

describe('flows at each day rate (real Postgres)', () => {
  vi.setConfig({ testTimeout: 180_000 });

  let dataSource: DataSource;
  let workspaceId: string;
  let groceriesId: string;
  let dashboard: DashboardService;
  let stoic: StoicBehaviorService;
  let spendFlow: SpendFlowService;

  beforeAll(async () => {
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const rate = (from: string, to: string, date?: Date | string) =>
      from === to ? 1 : from === 'ILS' && to === 'USD' ? rateOn(date) : null;
    const rates = {
      getRate: vi.fn(async (from: string, to: string, date?: Date | string) => rate(from, to, date) ?? 1),
      getRateOrNull: vi.fn(async (from: string, to: string, date?: Date | string) =>
        rate(from, to, date),
      ),
      coverageForWorkspace: vi.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        StoicBehaviorService,
        SpendFlowService,
        BudgetsService,
        BudgetWithinLimitService,
        WorkspaceCurrencyService,
        { provide: ExchangeRatesService, useValue: rates },
        { provide: GoalsService, useValue: { findAll: vi.fn(async () => []) } },
        {
          provide: SubscriptionsService,
          useValue: { getSummary: vi.fn(async () => ({ totalMonthlyCost: 0 })) },
        },
        { provide: TaxReserveService, useValue: { getReserve: vi.fn(async () => null) } },
        { provide: BalanceService, useValue: {} },
        { provide: AuditService, useValue: { createEvent: vi.fn() } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: vi.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: vi.fn(), set: vi.fn(), del: vi.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    dashboard = moduleRef.get(DashboardService);
    stoic = moduleRef.get(StoicBehaviorService);
    spendFlow = moduleRef.get(SpendFlowService);

    workspaceId = (
      await dataSource.getRepository(Workspace).save({ name: 'Dollars WS', currency: 'USD' })
    ).id;
    const userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `day-rate-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Member One',
          workspaceId,
        }),
      )
    ).id;
    groceriesId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Groceries', type: CategoryType.EXPENSE })
    ).id;

    const txRepo: Repository<Transaction> = dataSource.getRepository(Transaction);
    for (const day of [DAY_ONE, DAY_TWO]) {
      await txRepo.save(
        txRepo.create({
          workspaceId,
          transactionDate: new Date(day),
          counterpartyName: 'ACME Store',
          paymentPurpose: 'Groceries',
          currency: 'ILS',
          transactionType: TransactionType.EXPENSE,
          amount: SPENT_EACH_DAY,
          debit: SPENT_EACH_DAY,
          credit: null,
          categoryId: groceriesId,
          isVerified: true,
        }),
      );
    }
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const since = new Date(`${MONTH}-01`);
  const endDate = new Date(`${MONTH}-31`);

  it('dashboard top categories and merchants come to what Reports make of the days', async () => {
    const [category] = await (dashboard as any).getTopCategories(workspaceId, since, endDate);
    const [merchant] = await (dashboard as any).getTopMerchants(workspaceId, since, endDate, null);

    expect(category).toMatchObject({ id: groceriesId, count: 2 });
    expect(category.amount).toBeCloseTo(SPENT_USD, 2);
    expect(merchant).toMatchObject({ name: 'ACME Store', count: 2 });
    expect(merchant.amount).toBeCloseTo(SPENT_USD, 2);
  });

  it('the Stoic advice reads the same spending, its queries accepted by Postgres', async () => {
    const behavior = await stoic.load(workspaceId, 'USD', since);

    expect(behavior.merchants[0].total).toBeCloseTo(SPENT_USD, 2);
    expect(behavior.totalByCategory[groceriesId]).toBeCloseTo(SPENT_USD, 2);
    expect(behavior.cashFlow.find(month => month.month === MONTH)?.expense).toBeCloseTo(
      SPENT_USD,
      2,
    );
  });

  it('the spend flow comes to the same total', async () => {
    const flow = await spendFlow.getSpendFlow(workspaceId, {
      dateFrom: `${MONTH}-01`,
      dateTo: `${MONTH}-31`,
    });

    expect(flow.total).toBeCloseTo(SPENT_USD, 2);
  });
});

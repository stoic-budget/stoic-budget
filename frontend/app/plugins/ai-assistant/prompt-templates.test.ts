import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '@/app/lib/api';
import { budgetItem, subscriptionRow } from '@/app/test/fixtures/contracts';
import { isoDay } from './prompt-format';
import { type PromptContext, promptTemplates } from './prompt-templates';

/**
 * Only the HTTP call is replaced: every answer still goes through the real
 * contract check, so a fixture cannot say something the API never would.
 */
type Requested = { url: string; params?: Record<string, unknown> };

const responses = new Map<string, unknown>();
const failures = new Map<string, number>();
const requested: Requested[] = [];

const CURRENCY = 'EUR';
const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDay(date);
};

const failWith = (status: number): AxiosError =>
  new AxiosError(`HTTP ${status}`, undefined, undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);

const build = (key: string, context: Partial<PromptContext> = {}) => {
  const template = promptTemplates.find(candidate => candidate.key === key);
  if (!template) throw new Error(`no template ${key}`);
  return template.buildPrompt({ month: null, locale: 'en', ...context });
};

const dashboard = (overrides: Record<string, unknown> = {}) => ({
  snapshot: {
    totalBalance: -9999,
    income30d: 3000,
    expense30d: 1200,
    netFlow30d: 1800,
    totalPayable: 0,
    totalOverdue: 0,
    unapprovedCash: 0,
    currency: CURRENCY,
    missingRates: [] as string[],
  },
  actions: [],
  cashFlow: [
    { date: daysAgo(20), income: 3000, expense: 0, budgeted: 0 },
    { date: daysAgo(19), income: 0, expense: 0, budgeted: 0 },
    { date: daysAgo(1), income: 0, expense: 1200, budgeted: 0 },
  ],
  topMerchants: Array.from({ length: 5 }, (_, i) => ({
    name: `Shop ${i + 1}`,
    amount: 100 - i,
    count: 2,
  })),
  topCategories: [
    {
      id: 'c1',
      name: 'Groceries',
      color: '#000',
      icon: null,
      amount: 400,
      percent: 33.33,
      count: 12,
    },
    {
      id: null,
      name: null,
      color: '#000',
      icon: null,
      amount: 100,
      percent: 8.33,
      count: 3,
    },
    {
      id: null,
      name: null,
      isOther: true,
      color: '#000',
      icon: null,
      amount: 700,
      percent: 58.34,
      count: 9,
    },
  ],
  recentTransactions: [],
  role: 'owner',
  range: '30d',
  dataHealth: {
    uncategorizedTransactions: 0,
    statementsWithErrors: 0,
    statementsPendingReview: 0,
    statementsPendingSubmit: 0,
    receiptsPendingReview: 0,
    unapprovedCash: 0,
    lastUploadDate: null,
    parsingWarnings: 0,
  },
  ...overrides,
});

const trends = {
  dailyTrend: [
    { date: daysAgo(20), income: 3000, expense: 0 },
    { date: daysAgo(1), income: 0, expense: 1200 },
  ],
  forecast: [],
  categories: [{ name: 'Groceries', color: null, icon: null, amount: 400, count: 12 }],
  counterparties: [{ name: 'ACME Payroll', amount: 3000, count: 1 }],
  sources: { statements: { income: 3000, expense: 1200, rows: 20 } },
};

const forecast = (overrides: Record<string, unknown> = {}) => ({
  currency: CURRENCY,
  profile: 'home',
  horizonDays: 90,
  openingBalance: 20000,
  closingBalance: 18000,
  totalInflow: 0,
  totalOutflow: 0,
  totalEveryday: 0,
  totalIrregularIncome: 0,
  days: [],
  events: [
    {
      date: daysAgo(0),
      label: 'ACME Landlord',
      amount: -400,
      kind: 'payable',
      sourceId: 'p1',
      isOverdue: true,
    },
  ],
  lowestBalance: 17500,
  lowestBalanceDate: '2027-01-15',
  shortfallDate: null,
  safeToSpend: { amount: 750, untilDate: '2026-12-31', nextIncomeDate: null },
  runwayMonths: null,
  runwayChange: 1200,
  runwayDays: 365,
  everydayMonthly: 0,
  irregularIncomeMonthly: 0,
  monthlyIncome: 3000,
  monthlyExpense: 2400,
  monthsObserved: 6,
  caveats: [] as string[],
  recurringIncome: [],
  unscheduledCommitted: 0,
  ...overrides,
});

const receivables = (toPay: number, overdue: number) => ({
  toPay,
  overdue,
  dueThisWeek: 0,
  paidThisMonth: 0,
  paidTotal: 0,
  toPayCount: 0,
  overdueCount: 0,
  paidTotalCount: 0,
  dueThisWeekCount: 0,
  unbookedTotal: 0,
  unbookedCount: 0,
  convertedCurrencies: [],
});

const goal = (id: string, name: string) => ({
  id,
  name,
  targetAmount: 6000,
  currency: CURRENCY,
  targetDate: '2027-06-30',
  currentAmount: 2000,
  remaining: 4000,
  percent: 33.3,
  isReached: false,
  createdAt: TIMESTAMP,
  cover: null,
});

const netWorth = (assetsTotal: number) => ({
  range: '90d',
  from: daysAgo(90),
  to: daysAgo(0),
  currency: CURRENCY,
  current: assetsTotal,
  previous: assetsTotal,
  change: 0,
  changePercent: null,
  assetsTotal,
  liabilitiesTotal: 0,
  series: [],
  breakdown: [],
  byRisk: [],
  byRole: [],
  riskyPercent: 0,
  assetLines: [],
  missingRates: [],
  excluded: [],
  attribution: { byAccount: [], byKind: [] },
  savings: { income: 0, kept: 0, rate: null },
  allTimeHigh: null,
  byAssetClass: [],
  groups: [],
  properties: [],
});

const key = ({ url, params }: Requested): string =>
  params?.year ? `${url}?year=${params.year}` : url;

describe('AI assistant prompts', () => {
  beforeEach(() => {
    responses.clear();
    failures.clear();
    requested.length = 0;
    responses.set('/dashboard', dashboard());
    responses.set('/dashboard/trends', trends);
    responses.set('/dashboard/cash-flow/entries', { entries: [] });
    vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
      const request: Requested = { url, params: config?.params };
      requested.push(request);
      const status = failures.get(key(request));
      if (status) throw failWith(status);
      if (!responses.has(key(request))) throw failWith(403);
      if (url === '/dashboard/cash-flow/entries') {
        // The API answers one calendar month at a time.
        const { entries } = responses.get(url) as {
          entries: Array<{ date: string }>;
        };
        const inMonth = entries.filter(entry => entry.date.startsWith(`${config?.params?.month}`));
        return { data: { entries: inMonth } } as never;
      }
      return { data: responses.get(key(request)) } as never;
    });
  });

  it('names the rollup of the small categories apart from what has no category', async () => {
    const prompt = await build('expense-summary');

    expect(prompt).toContain('2. Uncategorized: 100 EUR (3 transactions)');
    expect(prompt).toContain('3. All other categories: 700 EUR (9 transactions)');
  });

  it('says what a budget has left, not what it may spend in total', async () => {
    responses.set('/budgets', [
      budgetItem({
        id: 'b1',
        name: 'Food',
        limitAmount: '500.00',
        availableAmount: 500,
        spentAmount: 420,
        percentUsed: 84,
        currency: CURRENCY,
      }),
      budgetItem({
        id: 'b2',
        name: 'Fun',
        limitAmount: '100.00',
        availableAmount: 150,
        carriedAmount: 50,
        spentAmount: 190,
        percentUsed: 126,
        currency: CURRENCY,
        subscriptionReserve: { amount: 15, items: [] },
        unconvertedSpending: [{ currency: 'GBP', amount: 7 }],
      }),
    ]);

    const prompt = await build('budget-recommendations');

    expect(prompt).toMatch(/Food .*limit 500 EUR, spent 420 EUR \(84%\), left 80 EUR/);
    expect(prompt).toMatch(
      /Fun .*carried in 50 EUR, spent 190 EUR \(126%\), over by 40 EUR, subscriptions still to charge this period 15 EUR, also 7 GBP with no exchange rate/,
    );
    expect(prompt).toContain('period from 2026-01-01');
  });

  it('proposes 50/30/20 only to a workspace with no budgets', async () => {
    responses.set('/budgets', []);
    expect(await build('budget-recommendations')).toContain('50/30/20');
  });

  it('reads the balance from the accounts, never the sum of the rows', async () => {
    responses.set('/forecast', forecast());
    const prompt = await build('budget-recommendations');

    expect(prompt).toContain('Spendable balance on my accounts: 20,000 EUR');
    expect(prompt).not.toContain('9,999');

    responses.set('/forecast', forecast({ openingBalance: -500, caveats: ['derivedBalance'] }));
    expect(await build('budget-recommendations')).toContain(
      'Balance (summed from transactions, no account holds a real balance): -500 EUR',
    );

    responses.delete('/forecast');
    expect(await build('budget-recommendations')).not.toMatch(/balance/i);
  });

  it('adds overdue invoices to what clients owe, and keeps them when nothing else is open', async () => {
    responses.set('/payables/summary', receivables(200, 700));
    expect(await build('tax-preparation')).toContain(
      'Invoices still owed to me: 900 EUR, of which overdue 700 EUR.',
    );

    responses.set('/payables/summary', receivables(0, 700));
    expect(await build('tax-preparation')).toContain(
      'Invoices still owed to me: 700 EUR, of which overdue 700 EUR.',
    );
  });

  it('says which dates the figures cover when the backend shifted the window', async () => {
    responses.set(
      '/dashboard',
      dashboard({
        effectiveSince: '2026-07-19',
        effectiveEndDate: '2026-08-18',
      }),
    );

    for (const card of ['expense-summary', 'cash-flow', 'budget-recommendations']) {
      const prompt = await build(card);
      expect(prompt).toContain('from 2026-07-19 to 2026-08-18, the latest period with data');
      expect(prompt).not.toMatch(/for the last 30 days/);
    }
  });

  it('dates the rolling period, and today, so nothing rests on the reader guessing', async () => {
    const prompt = await build('expense-summary');

    expect(prompt).toContain(`Today is ${daysAgo(0)}.`);
    expect(prompt).toContain(`the last 30 days (${daysAgo(30)} to ${daysAgo(0)})`);
  });

  it('stops on a server error instead of telling ChatGPT there is nothing', async () => {
    failures.set('/goals', 500);
    await expect(build('goals-runway')).rejects.toThrow();

    failures.clear();
    failures.set('/subscriptions', 503);
    await expect(build('subscriptions-review')).rejects.toThrow();

    failures.clear();
    failures.set('/budgets', 500);
    await expect(build('budget-recommendations')).rejects.toThrow();
  });

  it('leaves out what this user may not read, without claiming it is empty', async () => {
    expect(await build('goals-runway')).not.toContain('no goals yet');
    expect(await build('subscriptions-review')).not.toContain('no active subscriptions');

    const tax = await build('tax-preparation');
    expect(tax).not.toContain('Tax year');
    expect(tax).not.toContain('Tax residence');
    expect(tax).not.toContain('Invoices still owed');
  });

  it('builds every prompt with the optional sources closed, and every one asks for a reply', async () => {
    for (const template of promptTemplates) {
      const prompt = await template.buildPrompt({ month: null, locale: 'ru' });
      expect(prompt).toMatch(/Please:/);
      expect(prompt).toMatch(/Please reply in Russian\.$/);
    }
  });

  it('shows anomaly detection the transactions themselves, across both months of the window', async () => {
    const big = {
      date: daysAgo(16),
      name: 'ACME Odd Vendor',
      kind: 'expense',
      amount: 4999,
    };
    const twice = {
      date: daysAgo(5),
      name: 'ACME Shop',
      kind: 'expense',
      amount: 777,
    };
    const row = (entry: object) => ({ budgeted: 0, href: null, ...entry });
    responses.set('/dashboard/cash-flow/entries', {
      entries: [row(big), row(twice), row(twice)],
    });

    const prompt = await build('anomaly-detection');

    expect(prompt).toContain(`- ${big.date} ACME Odd Vendor: expense 4,999 EUR`);
    expect(prompt).toMatch(/Same payee, amount and day:\n.*ACME Shop: expense 777 EUR, 2 times/);
    const months = requested
      .filter(request => request.url === '/dashboard/cash-flow/entries')
      .map(request => request.params?.month);
    expect(months).toContain(daysAgo(0).slice(0, 7));
    expect(months).toContain(daysAgo(30).slice(0, 7));
  });

  it('accounts for the categories past the top list in anomaly detection', async () => {
    expect(await build('anomaly-detection')).toContain('All other categories: 800 EUR');
  });

  it('keeps every active day of the period, not just the last two weeks', async () => {
    const prompt = await build('cash-flow');

    expect(prompt).toContain(`${daysAgo(20)}: income 3,000 EUR, expense 0 EUR`);
    expect(prompt).not.toContain(`${daysAgo(19)}:`);
    expect(prompt).toContain('Days not listed had no income or spending');
  });

  it('checks the app forecast and its overdue bills instead of inventing one', async () => {
    responses.set('/forecast', forecast({ caveats: ['shortHistory'], monthsObserved: 2 }));
    const prompt = await build('cash-flow');

    expect(prompt).toContain('ACME Landlord, -400 EUR (bill, overdue)');
    expect(prompt).toContain('Caveat: full months of history: 2');
    expect(prompt).toContain("Check the app's forecast against this history");
    expect(prompt).not.toContain('Provide a forecast for the next 30 days');

    responses.delete('/forecast');
    expect(await build('cash-flow')).toContain('Provide a forecast for the next 30 days');
  });

  it('follows the month picked on the dashboard', async () => {
    const prompt = await build('anomaly-detection', { month: '2026-02' });

    expect(prompt).toContain('the month 2026-02-01 to 2026-02-28');
    expect(requested).toContainEqual({
      url: '/dashboard',
      params: { range: 'month', date: '2026-02-01' },
    });
    expect(requested).toContainEqual({
      url: '/dashboard/trends',
      params: { month: '2026-02' },
    });
    expect(requested).toContainEqual({
      url: '/dashboard/cash-flow/entries',
      params: { month: '2026-02' },
    });
  });

  it('with no month picked also gives the calendar month the dashboard is showing', async () => {
    expect(await build('expense-summary')).toContain('The calendar month my dashboard shows');
    expect(await build('expense-summary', { month: '2026-02' })).not.toContain(
      'The calendar month my dashboard shows',
    );
  });

  it('says what the figures do not count yet', async () => {
    responses.set(
      '/dashboard',
      dashboard({
        dataHealth: {
          ...dashboard().dataHealth,
          statementsPendingReview: 3,
          unapprovedCash: -300,
          uncategorizedTransactions: 2,
        },
      }),
    );

    const prompt = await build('expense-summary');

    expect(prompt).toContain('rows waiting for my confirmation, not counted: 3');
    expect(prompt).toContain('net -300 EUR');
    expect(prompt).toContain('transactions with no category yet: 2');
  });

  it('prepares taxes for a country, with the rows that lack documents', async () => {
    const year = new Date().getFullYear();
    const report = {
      year,
      currency: CURRENCY,
      categories: [
        {
          categoryId: 'c1',
          name: 'Office rent',
          type: 'expense',
          count: 12,
          total: 9600,
          documentCount: 10,
        },
      ],
      rows: [
        {
          id: 'r1',
          date: `${year}-03-01`,
          counterparty: 'ACME Landlord',
          categoryId: 'c1',
          categoryName: 'Office rent',
          type: 'expense',
          amount: 800,
          currency: CURRENCY,
          converted: 800,
          documentCount: 0,
          markedOnRow: false,
        },
      ],
      total: { income: 50000, expense: 9600 },
      missingRateCurrencies: [],
    };
    responses.set(`/tax/year-report?year=${year}`, report);
    responses.set(`/tax/year-report?year=${year - 1}`, {
      ...report,
      year: year - 1,
    });
    responses.set('/tax/settings', {
      vatStatus: 'registered',
      jurisdiction: {
        id: 'j1',
        code: 'DE',
        name: 'Germany',
        taxName: 'VAT',
        currency: CURRENCY,
        scheme: 'vat',
        isEu: true,
        filingPeriod: 'quarterly',
        registrationThreshold: null,
        thresholdPeriod: null,
      },
    });
    responses.set('/tax/deadlines', [
      {
        kind: 'vat_return',
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        dueDate: '2026-11-10',
        daysLeft: 23,
        done: false,
        filedElsewhere: false,
        returnName: 'ACME Return Q3',
        basis: 'statute',
        checkedAt: '2026-01-01',
      },
    ]);

    const prompt = await build('tax-preparation');

    expect(prompt).toContain('Tax residence: Germany (DE). Status: VAT registered.');
    expect(prompt).toContain(`Tax year ${year}`);
    expect(prompt).toContain('Office rent (expense): 9,600 EUR, 12 rows, 10 with documents');
    expect(prompt).toContain(
      `- ${year}-03-01 ACME Landlord: expense 800 EUR (Office rent), no document`,
    );
    expect(prompt).toMatch(/ACME Return Q3 for 2026-07-01 to 2026-09-30: due 2026-11-10 \(23 days/);
    expect(prompt).toContain('Tell me what to prepare for the upcoming returns');
  });

  it('asks to prepare returns only when there are some, and flags an unset country', async () => {
    responses.set('/tax/settings', {
      vatStatus: 'not_registered',
      jurisdiction: null,
    });
    responses.set('/tax/deadlines', []);

    const prompt = await build('tax-preparation');

    expect(prompt).not.toContain('upcoming returns');
    expect(prompt).toContain('Tax residence: not set in the app');
    expect(prompt).toContain('Status: not VAT registered.');
  });

  it('weighs goals by their real pace against the forecast and what it may be missing', async () => {
    responses.set('/goals', [goal('g1', 'Emergency fund')]);
    responses.set('/goals/g1', {
      ...goal('g1', 'Emergency fund'),
      contributions: [
        {
          id: 'old',
          amount: 1000,
          contributionDate: daysAgo(200),
          note: null,
          createdAt: TIMESTAMP,
          transaction: null,
        },
        {
          id: 'new',
          amount: 300,
          contributionDate: daysAgo(10),
          note: null,
          createdAt: TIMESTAMP,
          transaction: null,
        },
      ],
    });
    responses.set(
      '/forecast',
      forecast({
        caveats: ['derivedBalance', 'noEverydaySpending'],
        taxReserve: 150,
        events: [
          {
            date: daysAgo(-20),
            label: 'Emergency fund',
            amount: -500,
            kind: 'goal',
            sourceId: 'g1',
          },
        ],
      }),
    );

    const prompt = await build('goals-runway');

    expect(prompt).toContain('Emergency fund: 2,000 EUR of 6,000 EUR (33%)');
    expect(prompt).toContain('put aside 300 EUR in the last 90 days');
    expect(prompt).toContain('needs 500 EUR a month to make the date');
    expect(prompt).toContain(
      'Safe to spend until 2026-12-31: 750 EUR (after holding 150 EUR for tax)',
    );
    expect(prompt).toContain('Runway: n/a (not burning savings)');
    expect(prompt).toContain('Caveat: the opening balance is summed from transactions');
    expect(prompt).toContain('Caveat: no everyday spending is left');
    expect(prompt).toContain('already sets aside the monthly amounts');
  });

  it('shows net worth only when there is something to measure', async () => {
    responses.set('/goals', []);
    responses.set('/reports/net-worth', netWorth(0));
    expect(await build('goals-runway')).not.toContain('Net worth');

    responses.set('/reports/net-worth', netWorth(20000));
    expect(await build('goals-runway')).toContain('Net worth 20,000 EUR');
  });

  it('reviews subscriptions with usage, price changes, unconfirmed ones and the currency', async () => {
    responses.set('/subscriptions', [
      subscriptionRow({
        id: 's1',
        vendorName: 'ACME Video',
        amount: '13.99',
        currency: CURRENCY,
        nextChargeDate: '2026-11-02',
        usageSince: '2026-01-10T00:00:00.000Z',
        usageCount: 2,
        lastUsedAt: '2026-04-20T00:00:00.000Z',
        costPerUse: 7,
        riskStatus: 'price_changed',
        detectionMeta: { priceChange: { previous: 9.99, current: 13.99 } },
      }),
      subscriptionRow({
        id: 's2',
        vendorName: 'ACME Cloud',
        currency: CURRENCY,
        riskStatus: 'missing_charge',
      }),
      subscriptionRow({
        id: 's3',
        vendorName: 'ACME Maybe',
        status: 'detected',
      }),
    ]);
    responses.set('/subscriptions/summary', {
      totalMonthlyCost: 13.99,
      activeCount: 2,
      upcomingCount: 0,
      upcoming30DaysCount: 1,
      upcoming30DaysAmount: 13.99,
      priceChangeCount: 1,
      priceChangeYearlyEffect: 48,
      duplicateCount: 1,
      overdueReviewCount: 0,
      realizedAnnualSavings: 0,
    });
    responses.set('/subscriptions/month-status', {
      currency: CURRENCY,
      month: '2026-11',
      paidAmount: 0,
      paidCount: 0,
      unpaidAmount: 0,
      unpaidCount: 0,
      paidByCurrency: [],
      unpaidByCurrency: [],
      items: [],
    });
    responses.set('/subscriptions/duplicates', [
      {
        key: 'k',
        items: ['ACME Video', 'ACME Vid'].map(vendorName => ({
          id: vendorName,
          vendorName,
          amount: 1,
          currency: CURRENCY,
          frequency: 'monthly',
          status: 'active',
          ownerId: null,
        })),
      },
    ]);

    const prompt = await build('subscriptions-review');

    expect(prompt).toContain(
      '- ACME Video: 13.99 EUR monthly, next charge 2026-11-02, uses since 2026-01-10: 2, last on 2026-04-20, 7 EUR per use, price changed from 9.99 EUR to 13.99 EUR',
    );
    expect(prompt).toContain('ACME Cloud: 10 EUR monthly, expected charge is missing');
    expect(prompt).toMatch(/not confirmed by me yet:\n- ACME Maybe/);
    expect(prompt).toMatch(/same service paid twice:\n- ACME Video, ACME Vid/);
    expect(prompt).toContain('about 13.99 EUR a month');
    expect(prompt).not.toContain('workspace currency');
  });

  it('notes currencies counted at face value only when there are some', async () => {
    expect(await build('expense-summary')).not.toMatch(/no exchange rate/);

    const base = dashboard();
    responses.set(
      '/dashboard',
      dashboard({
        snapshot: { ...base.snapshot, missingRates: ['USD', 'GBP'] },
      }),
    );
    expect(await build('expense-summary')).toMatch(
      /amounts in USD, GBP have no exchange rate and are counted at face value/,
    );
  });

  it('tells income sources from the merchants I pay, at most five of those', async () => {
    const prompt = await build('top-counterparties');

    expect(prompt).toMatch(/Who paid me \(top income sources\):\n1\. ACME Payroll/);
    expect(prompt).toMatch(/Who I paid most \(top 5 spending merchants\):\n1\. Shop 1/);
    expect(prompt).toContain('5. Shop 5');
  });
});

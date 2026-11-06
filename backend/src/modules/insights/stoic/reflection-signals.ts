import { StoicClass } from '../../../entities/category.entity';
import { InsightType } from '../../../entities/insight.entity';
import type { CashFlowMonth } from './stoic-behavior.service';
import type { StoicContext, StoicSignal } from './stoic-signals';
import { JUDGE_CURRENT_FROM_DAY } from './stoic-signals';

/** Below a tenth of income kept: too late to spare at the dregs of the cask. */
const KEEP_FIRST_RATE = 0.1;
/** Three months of spending is the reserve a hard season asks for. */
const RESERVE_MONTHS = 3;
/** Spending growing this much faster than income over two quarters. */
const CREEP_EXPENSE_GROWTH = 0.1;
const CREEP_GAP = 0.05;
/** Roughly the working hours in a month, for pricing things in hours of life. */
const WORK_HOURS_PER_MONTH = 160;
const PRICE_IN_LIFE_MIN_HOURS = 8;

type Source = { author: string; work: string; target: string };

/** Where each reflection comes from; the texts say it in our words. */
const SOURCES = {
  keepFirst: {
    author: 'Seneca',
    work: 'Moral Letters to Lucilius, Letter 1',
    target: 'goals',
  },
  prepareBeforehand: {
    author: 'Seneca',
    work: 'Moral Letters to Lucilius, Letter 18',
    target: 'net-worth',
  },
  wantsOutrunIncome: {
    author: 'Seneca',
    work: 'Moral Letters to Lucilius, Letter 2',
    target: 'dashboard',
  },
  priceInLife: {
    author: 'Seneca',
    work: 'Of the Shortness of Life',
    target: 'merchants',
  },
} satisfies Record<string, Source>;

const pct = (value: number) => Math.round(value * 100);
const money = (value: number) => Math.round(value);

function reflection(
  key: StoicSignal['key'],
  priority: number,
  source: Source,
  params: Record<string, string | number>,
): StoicSignal {
  return {
    key,
    type: InsightType.STOIC_REFLECTION,
    priority,
    params,
    data: { author: source.author, work: source.work, target: source.target },
  };
}

/** Finished months only, newest first, skipping months with no income recorded. */
function finishedMonths(context: StoicContext): CashFlowMonth[] {
  const firstClosed = context.now.getDate() < JUDGE_CURRENT_FROM_DAY ? 0 : 1;
  return (context.behavior?.cashFlow ?? []).slice(firstClosed).filter(month => month.income > 0);
}

/** The last finished quarter (or two months of it) in one place. */
interface Quarter {
  months: CashFlowMonth[];
  income: number;
  expense: number;
  avgIncome: number;
  avgExpense: number;
  savingsRate: number;
}

function summarize(months: CashFlowMonth[]): Quarter {
  const income = months.reduce((sum, month) => sum + month.income, 0);
  const expense = months.reduce((sum, month) => sum + month.expense, 0);
  return {
    months,
    income,
    expense,
    avgIncome: income / months.length,
    avgExpense: expense / months.length,
    savingsRate: (income - expense) / income,
  };
}

/**
 * Stoic teaching applied to the user's own numbers over a whole quarter, with
 * the passage it comes from. The numbers are what make it about this user
 * rather than a poster on the wall.
 */
export function collectReflectionSignals(context: StoicContext): StoicSignal[] {
  const months = finishedMonths(context);
  if (months.slice(0, 3).length < 2) {
    return [];
  }
  const quarter = summarize(months.slice(0, 3));
  return [
    ...keepFirst(quarter),
    ...prepareBeforehand(context, quarter),
    ...wantsOutrunIncome(months, quarter),
    ...priceInLife(context, quarter),
  ];
}

function keepFirst(quarter: Quarter): StoicSignal[] {
  return quarter.savingsRate < KEEP_FIRST_RATE
    ? [
        reflection('stoic.keep_first', 60, SOURCES.keepFirst, {
          savingsPercent: pct(Math.max(quarter.savingsRate, 0)),
          tenthAmount: money(quarter.avgIncome / 10),
          months: quarter.months.length,
        }),
      ]
    : [];
}

function prepareBeforehand(context: StoicContext, quarter: Quarter): StoicSignal[] {
  const reserve = context.outlook?.reserve;
  if (reserve === undefined || quarter.avgExpense <= 0) {
    return [];
  }
  const cushionDays = Math.max(0, Math.floor(reserve / (quarter.avgExpense / 30)));
  return cushionDays < RESERVE_MONTHS * 30
    ? [
        reflection('stoic.prepare_beforehand', 70, SOURCES.prepareBeforehand, {
          cushionDays,
          targetAmount: money(quarter.avgExpense * RESERVE_MONTHS),
        }),
      ]
    : [];
}

/** The last finished quarter against the one before it. */
function wantsOutrunIncome(months: CashFlowMonth[], quarter: Quarter): StoicSignal[] {
  const earlierMonths = months.slice(3, 6);
  if (earlierMonths.length < 2) {
    return [];
  }
  const earlier = summarize(earlierMonths);
  const expenseGrowth = quarter.avgExpense / earlier.avgExpense - 1;
  const incomeGrowth = quarter.avgIncome / earlier.avgIncome - 1;
  const creeping =
    Number.isFinite(expenseGrowth) &&
    expenseGrowth >= CREEP_EXPENSE_GROWTH &&
    expenseGrowth - incomeGrowth >= CREEP_GAP;
  return creeping
    ? [
        reflection('stoic.wants_outrun_income', 50, SOURCES.wantsOutrunIncome, {
          expenseGrowth: pct(expenseGrowth),
          incomeGrowth: pct(incomeGrowth),
        }),
      ]
    : [];
}

/** The priciest leisure merchant of the month, priced in hours of work. */
function priceInLife(context: StoicContext, quarter: Quarter): StoicSignal[] {
  const classOf = new Map(
    context.balance.categories.map(category => [category.id, category.stoicClass]),
  );
  const hourly = quarter.avgIncome / WORK_HOURS_PER_MONTH;
  const priciest = (context.behavior?.merchants ?? [])
    .filter(
      merchant =>
        merchant.categoryId !== null && classOf.get(merchant.categoryId) === StoicClass.LEISURE,
    )
    .sort((a, b) => b.total - a.total)[0];
  return priciest && hourly > 0 && priciest.total / hourly >= PRICE_IN_LIFE_MIN_HOURS
    ? [
        reflection('stoic.price_in_life', 30, SOURCES.priceInLife, {
          merchant: priciest.name,
          totalAmount: money(priciest.total),
          hours: Math.round(priciest.total / hourly),
        }),
      ]
    : [];
}

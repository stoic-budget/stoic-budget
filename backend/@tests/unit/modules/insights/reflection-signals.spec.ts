import { StoicClass } from '@/entities/category.entity';
import { collectReflectionSignals } from '@/modules/insights/stoic/reflection-signals';
import type { StoicContext } from '@/modules/insights/stoic/stoic-signals';
import { balance, behavior, category, month, onPlan, SEPT_20 } from './stoic-fixtures';

const GAME_SHOP = 'ACME Games';

/** Judged month is September; finished months start at August. */
const flow = (months: Array<[number, number]>) => [
  { month: '2026-09', income: 0, expense: 0 },
  ...months.map(([income, expense], index) => ({
    month: `2026-${String(8 - index).padStart(2, '0')}`,
    income,
    expense,
  })),
];

function context(overrides: Partial<StoicContext> = {}): StoicContext {
  return {
    now: SEPT_20,
    balance: balance([month(0, onPlan)]),
    behavior: behavior({
      cashFlow: flow([
        [4000, 3000],
        [4000, 3000],
        [4000, 3000],
      ]),
    }),
    goals: [],
    outlook: null,
    rules: null,
    ...overrides,
  };
}

const find = (overrides: Partial<StoicContext>, key: string) =>
  collectReflectionSignals(context(overrides)).find(signal => signal.key === key);

describe('Stoic reflections', () => {
  it('says nothing without at least two finished months of income', () => {
    expect(
      collectReflectionSignals(context({ behavior: behavior({ cashFlow: flow([[4000, 3000]]) }) })),
    ).toEqual([]);
  });

  it('asks to keep your part first when less than a tenth is kept, citing Seneca', () => {
    const signal = find(
      {
        behavior: behavior({
          cashFlow: flow([
            [4000, 3800],
            [4000, 3700],
            [4000, 3900],
          ]),
        }),
      },
      'stoic.keep_first',
    );
    expect(signal?.params).toEqual({ savingsPercent: 5, tenthAmount: 400, months: 3 });
    expect(signal?.data).toMatchObject({ author: 'Seneca', target: 'goals' });
  });

  it('holds no outside percentage against the user: only their own plan', () => {
    const heavyNeeds = balance([
      month(0, onPlan),
      month(1, { necessity: 2600, leisure: 400 }),
      month(2, { necessity: 2600, leisure: 400 }),
      month(3, { necessity: 2600, leisure: 400 }),
    ]);
    expect(collectReflectionSignals(context({ balance: heavyNeeds }))).toEqual([]);
  });

  it('measures the reserve in days of spending', () => {
    const outlook = (reserve: number) => ({ shortfallDate: null, lowestBalance: 0, reserve });
    expect(
      find({ outlook: outlook(4500) }, 'stoic.prepare_beforehand')?.params,
    ).toEqual({ cushionDays: 45, targetAmount: 9000 });
    expect(find({ outlook: outlook(12000) }, 'stoic.prepare_beforehand')).toBeUndefined();
  });

  it('notices spending growing faster than income across two quarters', () => {
    const creeping = behavior({
      cashFlow: flow([
        [4000, 3300],
        [4000, 3300],
        [4000, 3300],
        [4000, 2800],
        [4000, 2800],
        [4000, 2800],
      ]),
    });
    expect(find({ behavior: creeping }, 'stoic.wants_outrun_income')?.params).toEqual({
      expenseGrowth: 18,
      incomeGrowth: 0,
    });
  });

  it('prices a leisure merchant in hours of work', () => {
    const signal = find(
      {
        balance: balance(
          [month(0, onPlan)],
          [category({ id: 'fun', stoicClass: StoicClass.LEISURE })],
        ),
        behavior: behavior({
          cashFlow: flow([
            [4000, 3000],
            [4000, 3000],
            [4000, 3000],
          ]),
          merchants: [{ name: GAME_SHOP, bankName: GAME_SHOP, categoryId: 'fun', count: 2, total: 250 }],
        }),
      },
      'stoic.price_in_life',
    );
    // 4000 a month over 160 hours is 25 an hour; 250 is ten hours.
    expect(signal?.params).toEqual({ merchant: GAME_SHOP, totalAmount: 250, hours: 10 });
  });
});

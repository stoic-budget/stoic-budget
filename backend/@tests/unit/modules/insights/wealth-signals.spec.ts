import {
  ANOMALY_HOUSEHOLD_SHARE,
  type CategoryHistory,
  crossedMilestone,
  findCategoryAnomalies,
  IDLE_CASH_MONTHS,
  idleCashMonths,
  median,
  milestoneAtOrBelow,
  stepBelow,
} from '@/modules/insights/analyzers/wealth-signals';

/** How many yen a euro is worth here: only the magnitude matters. */
const JPY_PER_EUR = 160;

describe('median', () => {
  it('takes the middle, or the mean of the two middles', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('idleCashMonths', () => {
  const spending = 2_000;

  it('counts the months once the cash is past the threshold', () => {
    expect(
      idleCashMonths({ cash: spending * 9.7, monthlySpending: spending, monthsObserved: 6 }),
    ).toBe(9);
    expect(
      idleCashMonths({
        cash: spending * IDLE_CASH_MONTHS,
        monthlySpending: spending,
        monthsObserved: 6,
      }),
    ).toBe(IDLE_CASH_MONTHS);
  });

  it('stays quiet below the threshold, and with a negative balance', () => {
    expect(
      idleCashMonths({ cash: spending * 5.9, monthlySpending: spending, monthsObserved: 6 }),
    ).toBeNull();
    expect(
      idleCashMonths({ cash: -spending * 10, monthlySpending: spending, monthsObserved: 6 }),
    ).toBeNull();
  });

  it('says nothing without enough spending history to measure by', () => {
    expect(
      idleCashMonths({ cash: spending * 50, monthlySpending: spending, monthsObserved: 2 }),
    ).toBeNull();
    // Nothing spent: any balance would be "infinite months", which is no advice.
    expect(idleCashMonths({ cash: 10_000, monthlySpending: 0, monthsObserved: 6 })).toBeNull();
  });

  it('reads a yen household and a euro one alike', () => {
    const eur = idleCashMonths({ cash: 20_000, monthlySpending: 2_500, monthsObserved: 6 });
    const jpy = idleCashMonths({
      cash: 20_000 * JPY_PER_EUR,
      monthlySpending: 2_500 * JPY_PER_EUR,
      monthsObserved: 6,
    });
    expect(eur).toBe(8);
    expect(jpy).toBe(eur);
  });
});

describe('milestone ladder', () => {
  it('picks the 1-2-5 round number at or below a value, at any magnitude', () => {
    expect(milestoneAtOrBelow(1)).toBe(1);
    expect(milestoneAtOrBelow(99_999)).toBe(50_000);
    expect(milestoneAtOrBelow(100_000)).toBe(100_000);
    expect(milestoneAtOrBelow(199_999.99)).toBe(100_000);
    expect(milestoneAtOrBelow(230_000)).toBe(200_000);
    expect(milestoneAtOrBelow(16_000_000)).toBe(10_000_000);
    expect(milestoneAtOrBelow(0.5)).toBeNull();
    expect(milestoneAtOrBelow(-20_000)).toBeNull();
    expect(milestoneAtOrBelow(Number.NaN)).toBeNull();
  });

  it('steps back down the ladder', () => {
    expect(stepBelow(100_000)).toBe(50_000);
    expect(stepBelow(50_000)).toBe(20_000);
    expect(stepBelow(20_000)).toBe(10_000);
    expect(stepBelow(10_000_000)).toBe(5_000_000);
  });
});

describe('crossedMilestone', () => {
  const days = (...values: number[]) =>
    values.map((value, index) => ({ date: `2026-11-0${index + 1}`, value }));
  const floor = 2_000;

  it('announces the round number and the day it was first passed', () => {
    expect(crossedMilestone({ recent: days(98_000, 101_000, 102_500), peakBefore: 97_500, floor }))
      .toEqual({ milestone: 100_000, date: '2026-11-02' });
  });

  it('keeps announcing it through a dip inside the window', () => {
    expect(
      crossedMilestone({ recent: days(101_000, 99_000, 99_500), peakBefore: 97_500, floor }),
    ).toEqual({ milestone: 100_000, date: '2026-11-01' });
  });

  it('never announces a line the old peak had already passed (wobble)', () => {
    expect(
      crossedMilestone({ recent: days(99_000, 100_500, 99_800), peakBefore: 100_200, floor }),
    ).toBeNull();
  });

  it('reads a jump from nothing as a balance typed in, not progress', () => {
    expect(crossedMilestone({ recent: days(0, 150_000), peakBefore: 0, floor })).toBeNull();
    expect(crossedMilestone({ recent: days(3_000, 150_000), peakBefore: 3_000, floor })).toBeNull();
  });

  it('says nothing for negative net worth, or a line under a month of spending', () => {
    expect(crossedMilestone({ recent: days(-40_000, -1_000), peakBefore: -500, floor }))
      .toBeNull();
    expect(crossedMilestone({ recent: days(1_100), peakBefore: 900, floor })).toBeNull();
    expect(crossedMilestone({ recent: days(5_100), peakBefore: 4_800, floor: 0 })).toBeNull();
    expect(crossedMilestone({ recent: [], peakBefore: 4_800, floor })).toBeNull();
  });

  it('scales the line to the currency: yen and euro households each get their round number', () => {
    const eur = crossedMilestone({ recent: days(49_000, 50_200), peakBefore: 48_000, floor });
    const jpy = crossedMilestone({
      recent: days(7_900_000, 10_040_000),
      peakBefore: 7_800_000,
      floor: floor * JPY_PER_EUR,
    });
    expect(eur).toEqual({ milestone: 50_000, date: '2026-11-02' });
    expect(jpy).toEqual({ milestone: 10_000_000, date: '2026-11-02' });
    // A yen household spending ¥320 000 a month is not told about ¥200 000.
    expect(
      crossedMilestone({ recent: days(201_000), peakBefore: 190_000, floor: floor * JPY_PER_EUR }),
    ).toBeNull();
  });
});

describe('findCategoryAnomalies', () => {
  const household = [3_000, 3_200, 2_900, 3_100, 3_000, 3_050];
  const category = (overrides: Partial<CategoryHistory>): CategoryHistory => ({
    categoryId: 'category-1',
    categoryName: 'Home Repairs',
    current: 0,
    baseline: [300, 280, 320, 310, 290, 300],
    ...overrides,
  });

  it('finds a category far above its median month', () => {
    const [anomaly] = findCategoryAnomalies({ categories: [category({ current: 900 })], household });
    expect(anomaly).toMatchObject({ categoryId: 'category-1', current: 900, usual: 300 });
    expect(anomaly?.ratio).toBe(3);
    expect(anomaly?.months).toBe(6);
  });

  it('is not fooled by one huge month in the history', () => {
    // An average would be 1 250 and hide the spike; the median stays at 305.
    const baseline = [300, 6_000, 320, 310, 290, 280];
    expect(findCategoryAnomalies({ categories: [category({ baseline, current: 400 })], household }))
      .toEqual([]);
    expect(
      findCategoryAnomalies({ categories: [category({ baseline, current: 1_000 })], household }),
    ).toMatchObject([{ usual: 305 }]);
  });

  it('lets a fixed bill rise a little without calling it unusual', () => {
    const baseline = [100, 100, 100, 100, 100, 100];
    expect(
      findCategoryAnomalies({ categories: [category({ baseline, current: 140 })], household }),
    ).toEqual([]);
  });

  it('ignores a rise that is small next to what the household spends', () => {
    const baseline = [10, 12, 9, 11, 10, 10];
    const floor = 3_025 * ANOMALY_HOUSEHOLD_SHARE;
    expect(floor).toBeGreaterThan(50);
    expect(
      findCategoryAnomalies({ categories: [category({ baseline, current: 50 })], household }),
    ).toEqual([]);
  });

  it('skips a short history, an occasional category and a new one', () => {
    expect(
      findCategoryAnomalies({
        categories: [category({ baseline: [300, 280, 310], current: 2_000 })],
        household: household.slice(0, 3),
      }),
    ).toEqual([]);
    // Spent in two of four months: a median of 450, but no usual month.
    expect(
      findCategoryAnomalies({
        categories: [category({ baseline: [0, 900, 0, 900], current: 5_000 })],
        household: household.slice(0, 4),
      }),
    ).toEqual([]);
    expect(
      findCategoryAnomalies({
        categories: [category({ baseline: [0, 0, 0, 0, 0, 0], current: 2_000 })],
        household,
      }),
    ).toEqual([]);
  });

  it('says nothing for a household that spent nothing', () => {
    expect(
      findCategoryAnomalies({
        categories: [category({ current: 900 })],
        household: [0, 0, 0, 0, 0, 0],
      }),
    ).toEqual([]);
  });

  it('names every unusual category, the largest excess in money first', () => {
    // Both stay named whichever is larger, so neither card is retired and
    // announced again when the two swap places.
    const books = { categoryId: 'small', categoryName: 'Books', baseline: [50, 60, 55, 50, 52, 58] };
    const travel = { categoryId: 'large', categoryName: 'Travel' };
    const ids = (booksNow: number, travelNow: number) =>
      findCategoryAnomalies({
        categories: [
          category({ ...books, current: booksNow }),
          category({ ...travel, current: travelNow }),
        ],
        household,
      }).map(anomaly => anomaly.categoryId);
    expect(ids(400, 1_500)).toEqual(['large', 'small']);
    expect(ids(2_000, 1_500)).toEqual(['small', 'large']);
  });

  it('judges a yen household exactly as a euro one', () => {
    const scale = (values: number[]) => values.map(value => value * JPY_PER_EUR);
    const [eur] = findCategoryAnomalies({ categories: [category({ current: 700 })], household });
    const [jpy] = findCategoryAnomalies({
      categories: [
        category({ baseline: scale([300, 280, 320, 310, 290, 300]), current: 700 * JPY_PER_EUR }),
      ],
      household: scale(household),
    });
    expect(eur).toBeDefined();
    expect(jpy?.ratio).toBeCloseTo(eur?.ratio ?? 0);
  });
});

import { BudgetPeriodType } from '@/entities/budget.entity';
import { periodPosition } from '@/modules/budgets/budget-period-position.util';

const open = { startsOn: null, endsOn: null };
// A Thursday, in local time like every range the budget code builds.
const day = new Date(2026, 4, 14, 15, 30);

describe('periodPosition', () => {
  it('gives the calendar month of a monthly budget', () => {
    expect(periodPosition({ periodType: BudgetPeriodType.MONTHLY, ...open }, day)).toEqual({
      isActive: true,
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
    });
  });

  it("gives a weekly budget its own Monday to Sunday, not the month's end", () => {
    expect(periodPosition({ periodType: BudgetPeriodType.WEEKLY, ...open }, day)).toMatchObject({
      periodStart: '2026-05-11',
      periodEnd: '2026-05-17',
    });
  });

  it('ends the period where the budget ends, so the days left stop there', () => {
    const position = periodPosition(
      { periodType: BudgetPeriodType.MONTHLY, startsOn: '2026-05-04', endsOn: '2026-05-20' },
      day,
    );

    expect(position).toEqual({
      isActive: true,
      periodStart: '2026-05-04',
      periodEnd: '2026-05-20',
    });
  });

  it('gives no period when the window misses the month', () => {
    const position = periodPosition(
      { periodType: BudgetPeriodType.MONTHLY, startsOn: '2026-01-01', endsOn: '2026-03-31' },
      day,
    );

    expect(position).toEqual({ isActive: false, periodStart: null, periodEnd: null });
  });

  it('measures the period of the day asked for, like the figures do', () => {
    const position = periodPosition(
      { periodType: BudgetPeriodType.QUARTERLY, ...open },
      new Date(2024, 1, 10),
    );

    expect(position).toMatchObject({ periodStart: '2024-01-01', periodEnd: '2024-03-31' });
  });
});

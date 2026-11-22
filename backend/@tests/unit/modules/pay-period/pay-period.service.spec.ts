import { PayPeriodService } from '@/modules/pay-period/pay-period.service';

const WORKSPACE_ID = 'workspace-1';
/** 9 Nov 2026. */
const TODAY = new Date(2026, 10, 9);

type IncomeRow = { counterpartyName: string | null; amount: string; transactionDate: string };

function createService(options: {
  settings?: Record<string, unknown> | null;
  country?: string | null;
  income?: IncomeRow[];
  holidays?: string[];
}) {
  const clauses: string[] = [];
  const workspaceRepository = {
    findOne: vi.fn(async () => ({
      id: WORKSPACE_ID,
      settings: options.settings ?? null,
      taxJurisdiction: options.country ? { code: options.country } : null,
    })),
  };
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'addSelect', 'where']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.andWhere = vi.fn((clause: string) => {
    clauses.push(clause);
    return builder;
  });
  builder.getRawMany = vi.fn(async () => options.income ?? []);
  const transactionRepository = { createQueryBuilder: vi.fn(() => builder) };
  const holidaysFor = vi.fn(async () => new Set(options.holidays ?? []));
  const service = new PayPeriodService(
    workspaceRepository as never,
    transactionRepository as never,
    { holidaysFor } as never,
  );
  return { service, workspaceRepository, holidaysFor, clauses };
}

/** An employer paying the 25th, early on 23 Oct (the 25th was a Sunday). */
const SALARY_ROWS: IncomeRow[] = [
  { counterpartyName: 'ACME Payroll', amount: '3000.00', transactionDate: '2026-07-24' },
  { counterpartyName: 'ACME Payroll', amount: '3000.00', transactionDate: '2026-08-25' },
  { counterpartyName: 'ACME Payroll', amount: '3000.00', transactionDate: '2026-09-25' },
  { counterpartyName: 'ACME Payroll', amount: '3050.00', transactionDate: '2026-10-23' },
  { counterpartyName: 'Member One', amount: '40.00', transactionDate: '2026-10-02' },
];

describe('PayPeriodService', () => {
  it('is the calendar month for a workspace that set nothing and has no tax country', async () => {
    const { service, holidaysFor } = createService({});
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(answer.monthStart).toEqual({ kind: 'day', day: 1 });
    expect(answer.current).toEqual({ month: '2026-11', from: '2026-11-01', to: '2026-11-30' });
    expect(answer.next).toEqual({ month: '2026-12', from: '2026-12-01', to: '2026-12-31' });
    expect(holidaysFor).not.toHaveBeenCalled();
  });

  it('answers the salary and holidays for the preview whatever the rule, but bounds by the rule', async () => {
    const { service, holidaysFor } = createService({
      settings: { monthStart: { kind: 'day', day: 1 } },
      country: 'DE',
      income: SALARY_ROWS,
      holidays: ['2026-12-25'],
    });
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(answer.salary?.dayOfMonth).toBe(25);
    expect(answer.holidays).toEqual(['2026-12-25']);
    expect(holidaysFor).toHaveBeenCalledTimes(1);
    expect(answer.current).toEqual({ month: '2026-11', from: '2026-11-01', to: '2026-11-30' });
    // The sums themselves do not pay for the preview.
    expect((await service.contextFor(WORKSPACE_ID)).salary).toBeNull();
  });

  it('starts on a set day', async () => {
    const { service } = createService({ settings: { monthStart: { kind: 'day', day: 15 } } });
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(answer.current).toEqual({ month: '2026-10', from: '2026-10-15', to: '2026-11-14' });
  });

  it('finds the salary, its usual day and the day it was really booked', async () => {
    const { service, clauses } = createService({
      settings: { monthStart: { kind: 'salary' } },
      income: SALARY_ROWS,
    });
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(answer.salary).toEqual({
      dayOfMonth: 25,
      paydays: ['2026-07-24', '2026-08-25', '2026-09-25', '2026-10-23'],
    });
    expect(answer.current).toEqual({ month: '2026-11', from: '2026-10-23', to: '2026-11-24' });
    // Private rows never move the bounds others see.
    expect(clauses).toContain('t.is_private = false');
  });

  it('falls back to the 1st when no salary is found', async () => {
    const { service } = createService({
      settings: { monthStart: { kind: 'salary' } },
      income: SALARY_ROWS.slice(-2),
    });
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(answer.salary).toBeNull();
    expect(answer.current).toEqual({ month: '2026-11', from: '2026-11-01', to: '2026-11-30' });
  });

  it('skips the holidays of the tax country on the last business day', async () => {
    const { service, holidaysFor } = createService({
      settings: { monthStart: { kind: 'last_business_day' } },
      country: 'DE',
      // 30 Nov 2026 is a Monday.
      holidays: ['2026-11-30'],
    });
    const answer = await service.describe(WORKSPACE_ID, TODAY);
    expect(holidaysFor).toHaveBeenCalledWith('DE', [2024, 2025, 2026, 2027]);
    expect(answer.holidayCountry).toBe('DE');
    // 31 Oct 2026 is a Saturday: the month named November starts on Friday the 30th
    // and runs to the day before Friday 27 Nov.
    expect(answer.current).toEqual({ month: '2026-11', from: '2026-10-30', to: '2026-11-26' });
  });

  it('reuses a resolved rule until the workspace changes', async () => {
    const { service, workspaceRepository } = createService({});
    await service.contextFor(WORKSPACE_ID);
    await service.contextFor(WORKSPACE_ID);
    expect(workspaceRepository.findOne).toHaveBeenCalledTimes(1);
    service.forget({ workspaceId: WORKSPACE_ID });
    await service.contextFor(WORKSPACE_ID);
    expect(workspaceRepository.findOne).toHaveBeenCalledTimes(2);
  });
});

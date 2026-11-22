import { UNCATEGORIZED_CATEGORY_NAME } from '@/modules/categories/uncategorized-category';
import { formatMonthLabel } from '@/modules/reports/helpers/report-values.util';
import { TransactionType } from '@/entities/transaction.entity';
import { buildReportsService } from './helpers/build-reports-service';

// Characterization tests: they pin what the analytics reports answer today,
// so moving them out of ReportsService cannot change it unnoticed.

const WS_ID = 'ws-analytics';

function topCategoriesService(rows: any[]) {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
  const service = buildReportsService({
    transactionRepository: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
  });
  return { service, qb };
}

function spendService(rows: Array<{ period: string; income: string; expense: string; count: string }>) {
  const qb: any = {};
  for (const method of ['where', 'andWhere', 'leftJoin', 'select', 'addSelect', 'groupBy', 'orderBy']) {
    qb[method] = vi.fn().mockReturnValue(qb);
  }
  qb.getRawMany = vi.fn().mockResolvedValue(rows);
  return buildReportsService({
    transactionRepository: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
  });
}

describe('ReportsService — top categories', () => {
  const housing = { id: 'cat-housing', name: 'Housing', color: '#000000', icon: 'home' };
  const groceries = { id: 'cat-groceries', name: 'Groceries' };
  const bank = 'Example Bank';

  const rows = [
    {
      amount: '-300',
      transactionType: TransactionType.EXPENSE,
      counterpartyName: 'ACME Rentals',
      category: housing,
      statement: { bankName: bank },
    },
    {
      amount: '100',
      transactionType: TransactionType.EXPENSE,
      counterpartyName: 'ACME Store',
      category: groceries,
      statement: { bankName: bank },
    },
    {
      amount: '100',
      transactionType: TransactionType.INCOME,
      counterpartyName: '',
      category: null,
      statement: null,
    },
    {
      amount: '0',
      transactionType: TransactionType.EXPENSE,
      counterpartyName: 'ACME Store',
      category: groceries,
      statement: { bankName: bank },
    },
  ];

  it('shares each line of the whole flow, with fallbacks for missing names', async () => {
    const { service } = topCategoriesService(rows);

    const result = await service.getTopCategoriesReport(WS_ID, {
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    } as any);

    // The zero-amount row is counted but adds nothing.
    expect(result.totals).toEqual({ income: 100, expense: 400, net: -300, transactions: 4 });
    expect(result.categories).toEqual([
      {
        id: housing.id,
        name: housing.name,
        amount: 300,
        transactions: 1,
        type: TransactionType.EXPENSE,
        color: housing.color,
        icon: housing.icon,
        percentage: 60,
      },
      {
        id: groceries.id,
        name: groceries.name,
        amount: 100,
        transactions: 1,
        type: TransactionType.EXPENSE,
        color: undefined,
        icon: undefined,
        percentage: 20,
      },
      {
        id: null,
        name: UNCATEGORIZED_CATEGORY_NAME,
        amount: 100,
        transactions: 1,
        type: TransactionType.INCOME,
        color: undefined,
        icon: undefined,
        percentage: 20,
      },
    ]);
    expect(result.banks).toEqual([
      { bankName: bank, amount: 400, statements: 2, percentage: 80 },
      { bankName: 'Unknown', amount: 100, statements: 1, percentage: 20 },
    ]);
    expect(result.counterparties.map(c => [c.name, c.percentage])).toEqual([
      ['ACME Rentals', 60],
      ['ACME Store', 20],
      ['Без названия', 20],
    ]);
    expect(result.period).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('cuts every list to the limit and reads at most 5000 rows', async () => {
    const { service, qb } = topCategoriesService(rows);

    const result = await service.getTopCategoriesReport(WS_ID, { limit: 1 } as any);

    expect(result.categories).toHaveLength(1);
    expect(result.banks).toHaveLength(1);
    expect(result.counterparties).toHaveLength(1);
    expect(qb.take).toHaveBeenCalledWith(5000);
  });

  it('keeps 20 lines when the limit is 0', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      amount: '10',
      transactionType: TransactionType.EXPENSE,
      counterpartyName: `Vendor ${i}`,
      category: { id: `cat-${i}`, name: `Category ${i}` },
      statement: null,
    }));
    const { service } = topCategoriesService(many);

    const result = await service.getTopCategoriesReport(WS_ID, { limit: 0 } as any);

    expect(result.categories).toHaveLength(20);
    expect(result.counterparties).toHaveLength(20);
  });

  it('looks back 30 days from the end date when no start is given', async () => {
    const { service } = topCategoriesService([]);

    const result = await service.getTopCategoriesReport(WS_ID, { dateTo: '2026-09-30' } as any);

    expect(result.period).toEqual({ from: '2026-08-31', to: '2026-09-30' });
  });
});

describe('ReportsService — spend over time labels', () => {
  it('labels months with the month name and fills empty ones', async () => {
    const service = spendService([
      { period: '2025-01', income: '0', expense: '30', count: '2' },
    ]);

    const result = await service.getSpendOverTimeReport(WS_ID, {
      groupBy: 'month',
      dateFrom: '2025-01-15',
      dateTo: '2025-03-10',
    } as any);

    expect(result.points.map(p => [p.period, p.label, p.expense])).toEqual([
      ['2025-01', formatMonthLabel(new Date(Date.UTC(2025, 0, 1))), 30],
      ['2025-02', formatMonthLabel(new Date(Date.UTC(2025, 1, 1))), 0],
      ['2025-03', formatMonthLabel(new Date(Date.UTC(2025, 2, 1))), 0],
    ]);
  });

  it('labels ISO weeks with a two-digit number', async () => {
    const service = spendService([
      { period: '2025-W03', income: '50', expense: '0', count: '1' },
    ]);

    const result = await service.getSpendOverTimeReport(WS_ID, {
      groupBy: 'week',
      dateFrom: '2025-01-06',
      dateTo: '2025-01-19',
    } as any);

    expect(result.points.map(p => [p.period, p.label, p.income])).toEqual([
      ['2025-W02', 'Week 02', 0],
      ['2025-W03', 'Week 03', 50],
    ]);
    expect(result.dateFrom).toBe('2025-01-06');
    expect(result.dateTo).toBe('2025-01-19');
  });
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { UNCATEGORIZED_CATEGORY_NAME } from '@/modules/categories/uncategorized-category';
import { ReportGroupBy } from '@/modules/reports/dto/custom-report.dto';
import { TransactionType } from '@/entities/transaction.entity';
import { buildReportsService } from './helpers/build-reports-service';

// Characterization tests: they pin what these reports answer today, so moving
// them out of ReportsService cannot change it unnoticed.

const WS_ID = 'ws-summary';
const OTHER_WS_ID = 'ws-other';

function createQbMock(rows: any[]) {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
  return qb;
}

function serviceWithRows(rows: any[]) {
  const qb = createQbMock(rows);
  const transactionRepository = { createQueryBuilder: vi.fn().mockReturnValue(qb) };
  return { service: buildReportsService({ transactionRepository }), qb };
}

function makeTx(overrides: Record<string, unknown>) {
  return {
    id: `tx-${Math.random()}`,
    amount: 0,
    transactionType: TransactionType.EXPENSE,
    transactionDate: new Date('2025-03-01T12:00:00.000Z'),
    updatedAt: new Date('2025-03-05T09:00:00.000Z'),
    createdAt: new Date('2025-03-05T09:00:00.000Z'),
    counterpartyName: 'ACME Store',
    category: null,
    categoryId: null,
    branch: null,
    branchId: null,
    wallet: null,
    walletId: null,
    ...overrides,
  };
}

describe('ReportsService — getStatementsSummary', () => {
  const payroll = 'ACME Payroll';
  const groceries = 'Groceries';

  it('totals income and expense by day, category and counterparty', async () => {
    const { service } = serviceWithRows([
      makeTx({ amount: 1000, transactionType: TransactionType.INCOME, counterpartyName: payroll }),
      makeTx({ amount: 200, transactionType: TransactionType.INCOME, counterpartyName: '' }),
      makeTx({
        amount: 300,
        category: { name: groceries },
        transactionDate: new Date('2025-03-02T12:00:00.000Z'),
      }),
      makeTx({ amount: 50, transactionDate: new Date('2025-03-02T12:00:00.000Z') }),
    ]);

    const result = await service.getStatementsSummary(WS_ID, 30);

    expect(result.totals).toEqual({ income: 1200, expense: 350, net: 850, rows: 4 });
    expect(result.timeseries).toEqual([
      { date: '2025-03-01', income: 1200, expense: 0 },
      { date: '2025-03-02', income: 0, expense: 350 },
    ]);
    expect(result.categories).toEqual([
      { name: groceries, amount: 300, rows: 1 },
      { name: UNCATEGORIZED_CATEGORY_NAME, amount: 50, rows: 1 },
    ]);
    expect(result.counterparties).toEqual([
      { name: payroll, amount: 1000, rows: 1 },
      { name: 'Без названия', amount: 200, rows: 1 },
    ]);
    expect(result.recent.map(r => r.amount)).toEqual([1000, 200, -300, -50]);
    expect(result.recent[2]).toMatchObject({ category: groceries, counterparty: 'ACME Store' });
    expect(result.recent[0].updatedAt).toBe('2025-03-05T09:00:00.000Z');
  });

  it('lists at most 20 recent rows but counts them all', async () => {
    const rows = Array.from({ length: 25 }, () => makeTx({ amount: 10 }));
    const { service } = serviceWithRows(rows);

    const result = await service.getStatementsSummary(WS_ID, 30);

    expect(result.recent).toHaveLength(20);
    expect(result.totals.rows).toBe(25);
    expect(result.totals.expense).toBe(250);
  });

  it('reads every row of the period, newest edit first (#598)', async () => {
    const { service, qb } = serviceWithRows([]);

    await service.getStatementsSummary(WS_ID, 30);

    expect(qb.orderBy).toHaveBeenCalledWith('transaction.updatedAt', 'DESC');
    // No cap: the 2,000 most recently changed rows understated a long period.
    expect(qb.take).not.toHaveBeenCalled();
  });
});

describe('ReportsService — generateCustomReport labels', () => {
  const dto = { dateFrom: '2025-01-01', dateTo: '2025-02-28' };

  it('labels a month group MM.YYYY', async () => {
    const { service } = serviceWithRows([
      makeTx({ amount: 10, transactionDate: new Date('2025-01-10T12:00:00.000Z') }),
      makeTx({ amount: 20, transactionDate: new Date('2025-01-20T12:00:00.000Z') }),
      makeTx({ amount: 5, transactionDate: new Date('2025-02-03T12:00:00.000Z') }),
    ]);

    const result = await service.generateCustomReport(WS_ID, {
      ...dto,
      groupBy: ReportGroupBy.MONTH,
    } as any);

    expect(result.groups.map(g => [g.key, g.label, g.totalAmount])).toEqual([
      ['2025-01', '01.2025', 30],
      ['2025-02', '02.2025', 5],
    ]);
  });

  it('labels a day group DD.MM.YYYY and reads a date column handed back as a string', async () => {
    const { service } = serviceWithRows([makeTx({ amount: 10, transactionDate: '2025-01-10' })]);

    const result = await service.generateCustomReport(WS_ID, {
      ...dto,
      groupBy: ReportGroupBy.DAY,
    } as any);

    expect(result.groups[0]).toMatchObject({ key: '2025-01-10', label: '10.01.2025' });
    expect(result.groups[0].transactions[0].date).toBe('2025-01-10');
  });

  it('puts rows without a branch under one unassigned group', async () => {
    const { service } = serviceWithRows([makeTx({ amount: 10 }), makeTx({ amount: 15 })]);

    const result = await service.generateCustomReport(WS_ID, {
      ...dto,
      groupBy: ReportGroupBy.BRANCH,
    } as any);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      key: 'unassigned',
      label: 'Не назначен',
      totalAmount: 25,
      transactionCount: 2,
    });
  });
});

describe('ReportsService — generateMonthlyReport counts', () => {
  it('counts the month’s transactions in the summary', async () => {
    const { service } = serviceWithRows([makeTx({ amount: 10 }), makeTx({ amount: 20 })]);

    const result = await service.generateMonthlyReport(WS_ID, 2025, 3);

    expect(result.summary.transactionCount).toBe(2);
  });
});

describe('ReportsService — report history', () => {
  let uploadsDir: string;
  const previousUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-history-'));
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  function writeReport(workspaceId: string, name: string): string {
    const dir = path.join(uploadsDir, 'reports', workspaceId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, 'report');
    return filePath;
  }

  function serviceWithHistory(row: Record<string, unknown> | null) {
    const reportHistoryRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(row),
    };
    return { service: buildReportsService({ reportHistoryRepo }), reportHistoryRepo };
  }

  it('lists the workspace’s 50 latest reports with who made them', async () => {
    const { service, reportHistoryRepo } = serviceWithHistory(null);

    await service.getReportHistory(WS_ID);

    expect(reportHistoryRepo.find).toHaveBeenCalledWith({
      where: { workspaceId: WS_ID },
      order: { generatedAt: 'DESC' },
      take: 50,
      relations: { user: true },
    });
  });

  it.each([
    ['csv', 'text/csv'],
    ['excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['pdf', 'application/pdf'],
  ])('serves a %s report from the workspace directory as %s', async (format, contentType) => {
    const filePath = writeReport(WS_ID, 'r1-report.bin');
    const { service, reportHistoryRepo } = serviceWithHistory({
      id: 'r1',
      workspaceId: WS_ID,
      filePath,
      fileName: 'report.bin',
      format,
    });

    const result = await service.downloadHistoryReport(WS_ID, 'r1');

    expect(reportHistoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'r1', workspaceId: WS_ID },
    });
    expect(result).toEqual({ filePath, fileName: 'report.bin', contentType });
  });

  it('answers not found for a missing row', async () => {
    const { service } = serviceWithHistory(null);

    await expect(service.downloadHistoryReport(WS_ID, 'r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers not found for a file outside the workspace directory', async () => {
    const filePath = writeReport(OTHER_WS_ID, 'r1-report.csv');
    const { service } = serviceWithHistory({
      id: 'r1',
      workspaceId: WS_ID,
      filePath,
      fileName: 'report.csv',
      format: 'csv',
    });

    await expect(service.downloadHistoryReport(WS_ID, 'r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers not found when the file is gone', async () => {
    const { service } = serviceWithHistory({
      id: 'r1',
      workspaceId: WS_ID,
      filePath: path.join(uploadsDir, 'reports', WS_ID, 'missing.csv'),
      fileName: 'report.csv',
      format: 'csv',
    });

    await expect(service.downloadHistoryReport(WS_ID, 'r1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PRIVATE_PLACEHOLDER } from '@/common/utils/transaction-privacy.util';
import { TransactionType } from '@/entities/transaction.entity';
import { buildReportsService } from './helpers/build-reports-service';

// Characterization tests: they pin what the report templates answer today, so
// moving them out of ReportsService cannot change it unnoticed.

const WS_ID = 'ws-templates';

function templateService(rows: any[]) {
  const qb: any = {
    where: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    leftJoinAndSelect: vi.fn(() => qb),
    getMany: vi.fn(async () => rows),
  };
  const reportHistoryRepo = { save: vi.fn().mockResolvedValue({}) };
  const service = buildReportsService({
    transactionRepository: { createQueryBuilder: vi.fn(() => qb) },
    reportHistoryRepo,
    exchangeRatesService: { getRateOrNull: vi.fn(async () => 1) },
  });
  return { service, reportHistoryRepo };
}

function row(overrides: Record<string, unknown>) {
  return {
    id: `tx-${Math.random()}`,
    amount: 100,
    currency: 'EUR',
    transactionType: TransactionType.EXPENSE,
    transactionDate: '2025-01-10',
    counterpartyName: 'ACME Store',
    comments: null,
    categoryId: 'c-misc',
    category: { name: 'Misc' },
    wallet: null,
    tags: [],
    isPrivate: false,
    ownerMemberId: null,
    ...overrides,
  };
}

describe('Report templates — privacy', () => {
  it('blanks a private row in a template, its owner’s included', async () => {
    const { service } = templateService([
      row({
        counterpartyName: 'ACME Clinic',
        comments: 'Checkup',
        isPrivate: true,
        ownerMemberId: 'member-1',
      }),
    ]);

    const preview = await service.previewTemplate(WS_ID, {
      templateId: 'transaction-register',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      format: 'pdf',
    } as any);

    const [line] = preview.sections[0].rows;
    expect(line[1]).toBe(PRIVATE_PLACEHOLDER);
    expect(line[8]).toBe(PRIVATE_PLACEHOLDER);
  });
});

describe('Report templates — documents', () => {
  it('orders P&L groups of equal size by name', async () => {
    const { service } = templateService([
      row({ categoryId: 'c-fuel', category: { name: 'Fuel', parent: { name: 'Transport' } } }),
      row({ categoryId: 'c-rent', category: { name: 'Rent', parent: { name: 'Housing' } } }),
    ]);

    const preview = await service.previewTemplate(WS_ID, {
      templateId: 'pnl',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      format: 'pdf',
    } as any);

    expect(preview.sections[1].rows).toEqual([
      ['Housing', 'Rent', 100],
      ['Transport', 'Fuel', 100],
    ]);
  });

  it('buckets cash flow by month', async () => {
    const { service } = templateService([
      row({ transactionType: TransactionType.INCOME, transactionDate: '2025-01-05' }),
      row({ amount: 40, transactionDate: '2025-01-20' }),
      row({ amount: 10, transactionDate: '2025-02-01' }),
    ]);

    const preview = await service.previewTemplate(WS_ID, {
      templateId: 'cash-flow',
      dateFrom: '2025-01-01',
      dateTo: '2025-02-28',
      format: 'pdf',
      groupBy: 'month',
    } as any);

    expect(preview.sections[0].rows).toEqual([
      ['2025-01', 100, 40, 60],
      ['2025-02', 0, 10, -10],
    ]);
  });

  it('buckets cash flow by the Monday of each week', async () => {
    const { service } = templateService([row({ transactionDate: '2025-01-08' })]);

    const preview = await service.previewTemplate(WS_ID, {
      templateId: 'cash-flow',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      format: 'pdf',
      groupBy: 'week',
    } as any);

    expect(preview.sections[0].rows).toEqual([['2025-01-06', 0, 100, -100]]);
  });

  it('gives category by month a column for every month across a year end', async () => {
    const { service } = templateService([]);

    const preview = await service.previewTemplate(WS_ID, {
      templateId: 'category-by-month',
      dateFrom: '2024-11-15',
      dateTo: '2025-02-10',
      format: 'excel',
    } as any);

    expect(preview.sections[0].columns.slice(2, 6)).toEqual([
      '2024-11',
      '2024-12',
      '2025-01',
      '2025-02',
    ]);
  });
});

describe('Report templates — history', () => {
  let uploadsDir: string;
  const previousUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-templates-'));
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(() => {
    process.env.UPLOADS_DIR = previousUploadsDir;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('records the generated file and its size', async () => {
    const { service, reportHistoryRepo } = templateService([row({})]);

    const file = await service.generateFromTemplate(WS_ID, 'user-1', {
      templateId: 'pnl',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
      format: 'csv',
    } as any);

    const size = fs.statSync(file.filePath).size;
    expect(size).toBeGreaterThan(0);
    expect(reportHistoryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS_ID,
        userId: 'user-1',
        templateId: 'pnl',
        templateName: 'Profit & Loss (P&L)',
        format: 'csv',
        fileName: file.fileName,
        filePath: file.filePath,
        fileSize: size,
      }),
    );
  });
});

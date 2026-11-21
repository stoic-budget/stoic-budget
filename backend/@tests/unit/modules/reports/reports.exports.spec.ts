import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { currencyCodeOrDefault } from '@/common/utils/currency.util';
import { UNCATEGORIZED_CATEGORY_NAME } from '@/modules/categories/uncategorized-category';
import { ExportFormat } from '@/modules/reports/dto/export-report.dto';
import { WorkspaceExportFormat } from '@/modules/reports/dto/workspace-export.dto';
import { renderReportLabels } from '@/modules/reports/report-export.translations';
import { TransactionType } from '@/entities/transaction.entity';
import { buildReportsService } from './helpers/build-reports-service';

// Characterization tests: they pin the files the exports write today, so
// moving the writers out of ReportsService cannot change them unnoticed.

const WS_ID = 'ws-export';
const L = renderReportLabels(undefined);

const daily = {
  date: '2025-03-01',
  income: { totalAmount: 1200, transactionCount: 2, topCounterparties: [] },
  expense: { totalAmount: 350, transactionCount: 3, topCategories: [] },
  summary: { incomeTotal: 1200, expenseTotal: 350, difference: 850 },
};

const monthly = {
  month: '3',
  year: 2025,
  dailyTrends: [
    { date: '2025-03-01', income: 1200, expense: 0 },
    { date: '2025-03-02', income: 0, expense: 350 },
  ],
  categoryDistribution: [],
  counterpartyDistribution: [],
  comparison: {} as any,
  summary: { totalIncome: 1200, totalExpense: 350, difference: 850, transactionCount: 2 },
};

const custom = {
  dateFrom: '2025-03-01',
  dateTo: '2025-03-31',
  groupBy: 'category',
  groups: [
    {
      key: 'groceries',
      label: 'Groceries',
      totalAmount: 300,
      transactionCount: 1,
      transactions: [
        {
          id: 'tx-1',
          date: '2025-03-02',
          counterparty: 'ACME Store',
          amount: 300,
          category: 'Groceries',
          branch: undefined,
          wallet: 'Main card',
        },
      ],
    },
  ],
  summary: { totalIncome: 0, totalExpense: 300, difference: -300, transactionCount: 1 },
};

let uploadsDir: string;
const previousUploadsDir = process.env.UPLOADS_DIR;

beforeEach(() => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-exports-'));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterEach(() => {
  process.env.UPLOADS_DIR = previousUploadsDir;
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

function sheetRows(filePath: string, sheet: string): unknown[][] {
  const workbook = xlsx.readFile(filePath);
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });
}

function expectInWorkspaceDir(filePath: string) {
  expect(path.dirname(filePath)).toBe(path.join(uploadsDir, 'reports', WS_ID));
  expect(fs.existsSync(filePath)).toBe(true);
}

describe('ReportsService — exportReport', () => {
  it('writes a daily report as CSV', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(WS_ID, { format: ExportFormat.CSV } as any, daily);

    expect(result.fileName).toMatch(/^report-.*\.csv$/);
    expectInWorkspaceDir(result.filePath);
    expect(fs.readFileSync(result.filePath, 'utf-8')).toBe(
      `${L.type},${L.amount},${L.count}\n` +
        `${L.income},1200,2\n` +
        `${L.expense},350,3\n` +
        `${L.difference},850,\n`,
    );
  });

  it('writes a monthly report as CSV', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(
      WS_ID,
      { format: ExportFormat.CSV } as any,
      monthly as any,
    );

    expect(fs.readFileSync(result.filePath, 'utf-8')).toBe(
      `${L.date},${L.income},${L.expense}\n2025-03-01,1200,0\n2025-03-02,0,350\n`,
    );
  });

  it('writes a custom report as CSV, one line per transaction', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(
      WS_ID,
      { format: ExportFormat.CSV } as any,
      custom as any,
    );

    expect(fs.readFileSync(result.filePath, 'utf-8')).toBe(
      `${L.group},${L.date},${L.counterparty},${L.amount},${L.category},${L.branch},${L.wallet}\n` +
        'Groceries,2025-03-02,ACME Store,300,Groceries,,Main card\n',
    );
  });

  it('writes a daily report as Excel', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(WS_ID, { format: ExportFormat.EXCEL } as any, daily);

    expect(result.fileName).toMatch(/^report-.*\.xlsx$/);
    expectInWorkspaceDir(result.filePath);
    expect(sheetRows(result.filePath, L.sheetReport)).toEqual([
      [L.type, L.amount, L.count],
      [L.income, 1200, 2],
      [L.expense, 350, 3],
      [L.difference, 850],
    ]);
  });

  it('writes a monthly report as Excel on the trends sheet', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(
      WS_ID,
      { format: ExportFormat.EXCEL } as any,
      monthly as any,
    );

    expect(sheetRows(result.filePath, L.sheetTrends)).toEqual([
      [L.date, L.income, L.expense],
      ['2025-03-01', 1200, 0],
      ['2025-03-02', 0, 350],
    ]);
  });

  it('writes a custom report as Excel', async () => {
    const service = buildReportsService();

    const result = await service.exportReport(
      WS_ID,
      { format: ExportFormat.EXCEL } as any,
      custom as any,
    );

    expect(sheetRows(result.filePath, L.sheetReport)).toEqual([
      [L.group, L.date, L.counterparty, L.amount, L.category, L.branch, L.wallet],
      ['Groceries', '2025-03-02', 'ACME Store', 300, 'Groceries', '', 'Main card'],
    ]);
  });
});

describe('ReportsService — exportWorkspaceTransactions files', () => {
  const income = {
    id: 'tx-in',
    transactionType: TransactionType.INCOME,
    transactionDate: '2025-03-01',
    counterpartyName: 'ACME Payroll, Ltd',
    counterpartyBin: '123456789012',
    paymentPurpose: 'Salary "March"',
    debit: null,
    credit: '1000.50',
    amount: '1000.50',
    currency: 'EUR',
    category: { name: 'Salary' },
    branch: { name: 'North' },
    wallet: { name: 'Main card' },
    documentNumber: 'DOC-1',
    comments: '',
  };
  const expense = {
    id: 'tx-out',
    transactionType: TransactionType.EXPENSE,
    transactionDate: new Date('2025-03-02T12:00:00.000Z'),
    counterpartyName: '=HYPERLINK("example.com")',
    counterpartyBin: null,
    paymentPurpose: 'Line one\nline two',
    debit: '40',
    credit: null,
    amount: '40',
    currency: null,
    category: null,
    branch: null,
    wallet: null,
    documentNumber: null,
    comments: '+note',
  };

  function serviceWithRows(rows: any[]) {
    const qb: any = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(rows),
    };
    const auditService = { createEvent: vi.fn() };
    const service = buildReportsService({
      transactionRepository: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
      auditService,
    });
    return { service, auditService };
  }

  it('writes CSV with a BOM, Russian headers, quoted and neutralized cells', async () => {
    const { service, auditService } = serviceWithRows([income, expense]);

    const result = await service.exportWorkspaceTransactions(WS_ID, WorkspaceExportFormat.CSV);

    expect(result.fileName).toMatch(/^workspace-transactions-.*\.csv$/);
    expect(result.mimeType).toBe('text/csv');
    expectInWorkspaceDir(result.filePath);
    const lines = fs.readFileSync(result.filePath, 'utf-8').split('\n');
    expect(lines[0]).toBe(
      '﻿№,Дата,Тип,Контрагент,БИН/ИИН,Назначение платежа,Дебет,Кредит,Сумма,Валюта,Категория,Филиал,Кошелек,№ документа,Комментарий',
    );
    expect(lines[1]).toBe(
      '1,2025-03-01,Приход,"ACME Payroll, Ltd",123456789012,"Salary ""March""",,1000.5,1000.5,EUR,Salary,North,Main card,DOC-1,',
    );
    // The purpose spans two physical lines inside its quotes.
    expect(lines[2]).toBe(`2,2025-03-02,Расход,"'=HYPERLINK(""example.com"")",,"Line one`);
    // A row without a currency falls back to the app default.
    expect(lines[3]).toBe(
      `line two",40,,40,${currencyCodeOrDefault(null)},${UNCATEGORIZED_CATEGORY_NAME},,,,'+note`,
    );
    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS_ID,
        meta: { reportType: 'workspace-transactions', reportDate: 'all-time' },
      }),
    );
  });

  it('writes Excel with a transactions sheet and a summary sheet', async () => {
    const { service } = serviceWithRows([income, expense]);

    const result = await service.exportWorkspaceTransactions(WS_ID, WorkspaceExportFormat.EXCEL);

    expect(result.fileName).toMatch(/^workspace-transactions-.*\.xlsx$/);
    const transactions = sheetRows(result.filePath, 'Транзакции');
    expect(transactions[0]).toEqual([
      '№',
      'Дата',
      'Тип',
      'Контрагент',
      'БИН/ИИН',
      'Назначение платежа',
      'Дебет',
      'Кредит',
      'Сумма',
      'Валюта',
      'Категория',
      'Филиал',
      'Кошелек',
      '№ документа',
      'Комментарий',
    ]);
    expect(transactions).toHaveLength(3);
    expect(transactions[1].slice(0, 4)).toEqual([1, '2025-03-01', 'Приход', 'ACME Payroll, Ltd']);
    expect(sheetRows(result.filePath, 'Сводка')).toEqual([
      ['Показатель', 'Значение'],
      ['Всего транзакций', 2],
      ['Приходы', 1],
      ['Расходы', 1],
      ['Сумма приходов', 1000.5],
      ['Сумма расходов', 40],
      ['Баланс', 960.5],
    ]);
  });

  it('writes Excel when no format is given', async () => {
    const { service } = serviceWithRows([income]);

    const result = await service.exportWorkspaceTransactions(WS_ID, undefined as any);

    expect(result.fileName).toMatch(/\.xlsx$/);
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('writes a PDF', async () => {
    const { service } = serviceWithRows([income, expense]);

    const result = await service.exportWorkspaceTransactions(WS_ID, WorkspaceExportFormat.PDF);

    expect(result.fileName).toMatch(/^workspace-transactions-.*\.pdf$/);
    expect(result.mimeType).toBe('application/pdf');
    expect(fs.readFileSync(result.filePath).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('writes a Word document', async () => {
    const { service } = serviceWithRows([income, expense]);

    const result = await service.exportWorkspaceTransactions(WS_ID, WorkspaceExportFormat.DOCX);

    expect(result.fileName).toMatch(/^workspace-transactions-.*\.docx$/);
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(fs.readFileSync(result.filePath).subarray(0, 2).toString()).toBe('PK');
  });
});

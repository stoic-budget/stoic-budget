vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, IsNull, Not } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Category } from '../../src/entities/category.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import { StatementSiblingsService } from '../../src/modules/parsing/services/statement-siblings.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const EVERYDAY = 'Everyday Account';
const SAVINGS = 'Rainy Day Savings';
const RULE_PAYEE = 'ACME Store';

/** Two accounts, a transfer between them, a category, a split that falls short and a rule's payee. */
const QIF = [
  '!Option:AutoSwitch',
  '!Account',
  `N${EVERYDAY}`,
  'TBank',
  '^',
  `N${SAVINGS}`,
  'TBank',
  '^',
  '!Clear:AutoSwitch',
  '!Type:Cat',
  'NFood',
  'E',
  '^',
  '!Account',
  `N${EVERYDAY}`,
  'TBank',
  '^',
  '!Type:Bank',
  'D09/01/2026',
  'T1000.00',
  'POpening Balance',
  `L[${EVERYDAY}]`,
  '^',
  'D09/03/2026',
  'T-42.50',
  'PExample Grocer',
  'LFood:Groceries',
  '^',
  'D09/04/2026',
  'T-100.00',
  'PExample Market',
  'L--Split--',
  'SFood:Groceries',
  'EWeekly shop',
  '$-60.00',
  'SHousehold',
  '$-25.00',
  '^',
  'D09/05/2026',
  'T-9.99',
  `P${RULE_PAYEE}`,
  'LGadgets',
  '^',
  'D09/06/2026',
  'T-200.00',
  'PTransfer',
  `L[${SAVINGS}]`,
  '^',
  '!Account',
  `N${SAVINGS}`,
  'TBank',
  '^',
  '!Type:Bank',
  'D09/06/2026',
  'T200.00',
  'PTransfer',
  `L[${EVERYDAY}]`,
  '^',
].join('\n');

/**
 * A QIF export with several accounts, categories, a split and transfers: each
 * account is a statement of its own, the file's categories land where no rule
 * decided, the split becomes split rows and the transfer legs pair.
 */
describe('QIF import (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let processing: StatementProcessingService;
  let siblings: StatementSiblingsService;
  const stamp = Date.now();
  const email = `qif-owner-${stamp}@example.com`;
  const filePath = path.join(os.tmpdir(), `qif-e2e-${stamp}.qif`);
  let owner: E2eAccount;
  let ruleCategoryId: string;
  let upload: Statement;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const rowsOf = (statementId: string) =>
    dataSource.getRepository(Transaction).find({
      where: { statementId },
      relations: { category: true },
      order: { transactionDate: 'ASC', splitIndex: 'ASC' },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    processing = moduleFixture.get(StatementProcessingService);
    siblings = moduleFixture.get(StatementSiblingsService);
    owner = await registerAccount(app, email, 'Qif Owner');

    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    ruleCategoryId = categories.body[1].id;
    await as(request(server()).post('/categorization-rules'))
      .send({
        name: 'ACME is a shop',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'acme store' }],
        result: { categoryId: ruleCategoryId },
      })
      .expect(201);

    await fs.promises.writeFile(filePath, QIF, 'utf-8');
    const saved = await dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      fileName: 'export.qif',
      filePath,
      fileType: FileType.QIF,
      fileSize: QIF.length,
      fileHash: `qif-${stamp}`,
      bankName: BankName.OTHER,
      status: StatementStatus.UPLOADED,
      currency: 'USD',
    });
    upload = await processing.processStatement(saved.id);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await fs.promises.rm(filePath, { force: true });
    await app.close();
  });

  it("keeps the first account's rows, its opening balance and the other account to import", () => {
    expect(upload.accountNumber).toBe(EVERYDAY);
    expect(Number(upload.balanceStart)).toBe(1000);
    expect(upload.parsingDetails?.otherAccounts).toEqual([
      expect.objectContaining({ index: 1, accountNumber: SAVINGS, transactions: 1 }),
    ]);
    expect(upload.parsingDetails?.warnings).toContainEqual(
      expect.stringContaining('the remaining 15.00 is kept as a part without a category'),
    );
  });

  it("files rows under the file's categories, nested, unless a rule decided", async () => {
    const rows = await rowsOf(upload.id);
    const grocer = rows.find(row => row.counterpartyName === 'Example Grocer');
    const food = await dataSource
      .getRepository(Category)
      .findOneByOrFail({ workspaceId: owner.workspaceId, name: 'Food', parentId: IsNull() });
    expect(grocer?.category).toMatchObject({ name: 'Groceries', parentId: food.id });
    expect(grocer?.categorySource).toBe('manual');

    const ruled = rows.find(row => row.counterpartyName === RULE_PAYEE);
    expect(ruled?.categoryId).toBe(ruleCategoryId);
    expect(ruled?.categorySource).toBe('rule');
    const gadgets = await dataSource
      .getRepository(Category)
      .findOneBy({ workspaceId: owner.workspaceId, name: 'Gadgets' });
    expect(gadgets).toBeNull();
  });

  it('splits the split row into parts with their own categories and the rest uncategorised', async () => {
    const parts = (await rowsOf(upload.id)).filter(row => row.counterpartyName === 'Example Market');
    expect(parts).toHaveLength(3);
    expect(new Set(parts.map(part => part.splitGroupId)).size).toBe(1);
    expect(parts[0].splitGroupId).not.toBeNull();
    expect(parts.map(part => [Number(part.amount), part.category?.name])).toEqual([
      [60, 'Groceries'],
      [25, 'Household'],
      [15, 'Uncategorized'],
    ]);
    expect(parts[0].paymentPurpose).toBe('Weekly shop');
  });

  it('marks the split row a duplicate when a later, overlapping export brings it again', async () => {
    const later = [
      '!Account',
      `N${EVERYDAY}`,
      'TBank',
      '^',
      '!Type:Bank',
      ...QIF.split('\n').slice(QIF.split('\n').indexOf('D09/04/2026'), QIF.split('\n').indexOf('D09/05/2026')),
      'D09/10/2026',
      'T-5.00',
      'PExample Kiosk',
      '^',
    ].join('\n');
    const laterPath = `${filePath}.later.qif`;
    await fs.promises.writeFile(laterPath, later, 'utf-8');
    try {
      const saved = await dataSource.getRepository(Statement).save({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        fileName: 'export-later.qif',
        filePath: laterPath,
        fileType: FileType.QIF,
        fileSize: later.length,
        fileHash: `qif-later-${stamp}`,
        bankName: BankName.OTHER,
        status: StatementStatus.UPLOADED,
        currency: 'USD',
      });
      const second = await processing.processStatement(saved.id);
      const again = (await rowsOf(second.id)).filter(row => row.counterpartyName === 'Example Market');
      expect(again).toHaveLength(1);
      expect(again[0]).toMatchObject({ isDuplicate: true, splitGroupId: null });

      const counted = await dataSource.getRepository(Transaction).find({
        where: { workspaceId: owner.workspaceId, counterpartyName: 'Example Market', isDuplicate: false },
      });
      expect(counted.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(100);
    } finally {
      await fs.promises.rm(laterPath, { force: true });
    }
  });

  it("imports the other account, keeps the file's [Account] on both legs and pairs them", async () => {
    const outgoing = (await rowsOf(upload.id)).find(row => row.counterpartyName === 'Transfer');
    expect(outgoing?.categoryHint).toBe(`[${SAVINGS}]`);

    const [sibling] = await siblings.importOtherAccounts(upload.id);
    expect(sibling).toMatchObject({ sourceAccountIndex: 1, accountNumber: SAVINGS });
    // The queue may already be parsing it; this waits for that run or parses it here.
    const parsed = await processing.processStatement(sibling.id);
    expect(parsed.accountNumber).toBe(SAVINGS);
    const incoming = (await rowsOf(sibling.id)).filter(row => !row.isDuplicate);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].categoryHint).toBe(`[${EVERYDAY}]`);

    await as(request(server()).post('/transactions/transfers/detect')).send({}).expect(200);
    const paired = await dataSource.getRepository(Transaction).find({
      where: { workspaceId: owner.workspaceId, transferPairId: Not(IsNull()) },
    });
    expect(paired.map(row => row.id).sort()).toEqual([outgoing?.id, incoming[0].id].sort());
  });
});

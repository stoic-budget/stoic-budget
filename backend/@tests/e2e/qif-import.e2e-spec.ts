vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, IsNull, Like, Not } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { onlyFlows } from '../../src/common/utils/counted-transactions.util';
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
const PROBE_CHECKING = 'Probe Checking';
const PROBE_SAVINGS = 'Probe Savings';

const PAY_CHECKING = 'Pay Checking';
const PAY_SAVINGS = 'Pay Savings';

/**
 * Transfer rows that share a day, an amount and an account: two paychecks each
 * sending 100 to savings, a purchase split with two equal 100 parts, and on
 * the savings side the two equal legs of that purchase, as Quicken writes
 * them. One rent payment's 30 put aside is the only transfer with one
 * counterpart.
 */
const EQUAL_PARTS_QIF = [
  '!Account',
  `N${PAY_CHECKING}`,
  'TBank',
  '^',
  '!Type:Bank',
  ...[
    ['Employer One', '1000.00', '900.00'],
    ['Employer Two', '500.00', '400.00'],
  ].flatMap(([payee, total, salary]) => [
    'D10/10/2026',
    `T${total}`,
    `P${payee}`,
    'SSalary',
    `$${salary}`,
    `S[${PAY_SAVINGS}]`,
    '$100.00',
    '^',
  ]),
  'D10/12/2026',
  'T-250.00',
  'PZeta Market',
  'SProbe Food',
  '$-50.00',
  `S[${PAY_SAVINGS}]`,
  '$-100.00',
  `S[${PAY_SAVINGS}]`,
  '$-100.00',
  '^',
  'D10/20/2026',
  'T-300.00',
  'PExample Landlord',
  'SRent',
  '$-270.00',
  `S[${PAY_SAVINGS}]`,
  '$-30.00',
  '^',
  '!Account',
  `N${PAY_SAVINGS}`,
  'TBank',
  '^',
  '!Type:Bank',
  ...[
    ['10/10/2026', '-100.00', 'Employer One'],
    ['10/10/2026', '-100.00', 'Employer Two'],
    ['10/12/2026', '100.00', 'Zeta Market'],
    ['10/12/2026', '100.00', 'Zeta Market'],
    ['10/20/2026', '30.00', 'Example Landlord'],
  ].flatMap(([date, amount, payee]) => [
    `D${date}`,
    `T${amount}`,
    `P${payee}`,
    `L[${PAY_CHECKING}]`,
    '^',
  ]),
].join('\n');

/** A split whose second part went to the other account, and that account's leg of it. */
const SPLIT_TRANSFER_QIF = [
  '!Account',
  `N${PROBE_CHECKING}`,
  'TBank',
  '^',
  '!Type:Bank',
  'D10/01/2026',
  'T-100.00',
  'PZeta Market',
  'L--Split--',
  'SProbe Food',
  '$-60.00',
  `S[${PROBE_SAVINGS}]`,
  '$-40.00',
  '^',
  '!Account',
  `N${PROBE_SAVINGS}`,
  'TBank',
  '^',
  '!Type:Bank',
  'D10/01/2026',
  'T40.00',
  'PZeta Market',
  `L[${PROBE_CHECKING}]`,
  '^',
].join('\n');

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

  /** Saves `text` as a QIF statement of the owner's, not yet parsed. */
  const qifStatement = async (name: string, text: string) => {
    const file = `${filePath}.${name}.qif`;
    await fs.promises.writeFile(file, text, 'utf-8');
    return dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      fileName: `${name}.qif`,
      filePath: file,
      fileType: FileType.QIF,
      fileSize: text.length,
      fileHash: `qif-${name}-${stamp}`,
      bankName: BankName.OTHER,
      status: StatementStatus.UPLOADED,
      currency: 'USD',
    });
  };

  /** Income and spending of these statements as every figure counts them: pairs are neither. */
  const flowsOf = async (statementIds: string[]) => {
    const query = dataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .select('t.transactionType', 'type')
      .addSelect('SUM(t.amount)', 'total')
      .where('t.workspaceId = :workspaceId', { workspaceId: owner.workspaceId })
      .andWhere('t.statementId IN (:...statementIds)', { statementIds })
      .andWhere('t.transferPairId IS NULL');
    const rows = await onlyFlows(query, 't', { includeUnconfirmed: true })
      .groupBy('t.transactionType')
      .getRawMany<{ type: string; total: string }>();
    return Object.fromEntries(rows.map(row => [row.type, Number(row.total)]));
  };

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
    const dir = path.dirname(filePath);
    for (const name of await fs.promises.readdir(dir)) {
      if (name.startsWith(path.basename(filePath))) {
        await fs.promises.rm(path.join(dir, name), { force: true });
      }
    }
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

    // Parsing the second account pairs the legs by itself; a later detect keeps that pair.
    const pairedIds = async () =>
      (
        await dataSource.getRepository(Transaction).find({
          where: { workspaceId: owner.workspaceId, transferPairId: Not(IsNull()) },
        })
      )
        .map(row => row.id)
        .sort();
    const legs = [outgoing?.id, incoming[0].id].sort();
    expect(await pairedIds()).toEqual(legs);
    await as(request(server()).post('/transactions/transfers/detect')).send({}).expect(200);
    expect(await pairedIds()).toEqual(legs);
  });

  it('makes each new category once when sibling statements of one file are parsed at once', async () => {
    const rows = (account: number) =>
      Array.from({ length: 40 }, (_, row) => [
        `D11/${String((row % 28) + 1).padStart(2, '0')}/2026`,
        `T-${account}${row}.25`,
        `PProbe Shop ${row}`,
        `LProbe Area ${row % 5}:Probe Topic ${row}`,
        '^',
      ]).flat();
    const statements = await Promise.all(
      [1, 2, 3].map(account =>
        qifStatement(
          `race-${account}`,
          ['!Account', `NRace Account ${account}`, 'TBank', '^', '!Type:Bank', ...rows(account)].join('\n'),
        ),
      ),
    );

    await Promise.all(statements.map(statement => processing.processStatement(statement.id)));

    const repeated = await dataSource.query(
      `SELECT parent_id, type, lower(name) AS name, count(*)::int AS copies
         FROM categories
        WHERE workspace_id = $1
        GROUP BY parent_id, type, lower(name)
       HAVING count(*) > 1`,
      [owner.workspaceId],
    );
    expect(repeated).toEqual([]);
    const topics = await dataSource
      .getRepository(Category)
      .countBy({ workspaceId: owner.workspaceId, parentId: Not(IsNull()), name: Like('Probe Topic %') });
    expect(topics).toBe(40);
  });

  it('cuts a transfer out of a split, so it pairs with its other leg and nothing counts twice', async () => {
    const checking = await processing.processStatement(
      (await qifStatement('split-transfer', SPLIT_TRANSFER_QIF)).id,
    );
    const [sibling] = await siblings.importOtherAccounts(checking.id);
    const savings = await processing.processStatement(sibling.id);
    expect(savings.accountNumber).toBe(PROBE_SAVINGS);

    const rows = await dataSource.getRepository(Transaction).find({
      where: [{ statementId: checking.id }, { statementId: savings.id }],
    });
    const legs = rows.filter(row => Number(row.amount) === 40);
    expect(legs).toHaveLength(2);
    expect(legs.every(row => row.splitGroupId === null && row.transferPairId !== null)).toBe(true);
    expect(new Set(legs.map(row => row.transferPairId)).size).toBe(1);
    expect(legs.find(row => row.statementId === checking.id)?.categoryHint).toBe(`[${PROBE_SAVINGS}]`);
    expect(await flowsOf([checking.id, savings.id])).toEqual({ expense: 60 });

    // The same file again: the reduced row and the cut-out transfer are both repeats.
    const again = await processing.processStatement(
      (await qifStatement('split-transfer-again', SPLIT_TRANSFER_QIF)).id,
    );
    const repeats = await rowsOf(again.id);
    expect(repeats.map(row => [Number(row.amount), row.isDuplicate])).toEqual(
      expect.arrayContaining([
        [40, true],
        [60, true],
      ]),
    );
    expect(repeats).toHaveLength(2);
    expect(await flowsOf([checking.id, savings.id, again.id])).toEqual({ expense: 60 });
  });

  it('keeps every equal transfer row of a file, pairs the unique one and catches them all again', async () => {
    const importBoth = async (name: string) => {
      const first = await processing.processStatement((await qifStatement(name, EQUAL_PARTS_QIF)).id);
      const [sibling] = await siblings.importOtherAccounts(first.id);
      const second = await processing.processStatement(sibling.id);
      return [await rowsOf(first.id), await rowsOf(second.id)];
    };

    const [checking, savings] = await importBoth('equal-parts');
    expect(checking).toHaveLength(9);
    expect(savings).toHaveLength(5);
    const rows = [...checking, ...savings];
    expect(rows.filter(row => row.isDuplicate)).toEqual([]);
    // The matcher pairs a transfer only when one counterpart qualifies: the
    // 30 does; equal 100s on one day stay unpaired, to be linked by hand.
    const legs = (amount: number) => rows.filter(row => Number(row.amount) === amount);
    expect(legs(30)).toHaveLength(2);
    expect(new Set(legs(30).map(row => row.transferPairId)).size).toBe(1);
    expect(legs(30)[0].transferPairId).not.toBeNull();
    expect(legs(100)).toHaveLength(8);
    expect(legs(100).every(row => row.transferPairId === null)).toBe(true);

    const again = (await importBoth('equal-parts-again')).flat();
    expect(again).toHaveLength(14);
    expect(again.every(row => row.isDuplicate)).toBe(true);
  });

  it('finds the rows of a header-less export again whether or not it opens with a balance', async () => {
    const rows = ['D12/05/2026', 'T-10.00', 'PExample Kiosk', '^', 'D12/06/2026', 'T-11.00', 'PExample Bakery', '^'];
    const opening = ['D12/01/2026', 'T500.00', 'POpening Balance', 'L[Headerless Account]', '^'];
    const later = ['D12/08/2026', 'T-12.00', 'PExample Florist', '^'];
    const first = await processing.processStatement(
      (await qifStatement('headerless-opening', ['!Type:Bank', ...opening, ...rows].join('\n'))).id,
    );
    const second = await processing.processStatement(
      (await qifStatement('headerless-later', ['!Type:Bank', ...rows, ...later].join('\n'))).id,
    );

    expect(Number(first.balanceStart)).toBe(500);
    expect(second.accountNumber).toBe(first.accountNumber);
    const repeats = await rowsOf(second.id);
    expect(repeats.map(row => [row.counterpartyName, row.isDuplicate])).toEqual([
      ['Example Kiosk', true],
      ['Example Bakery', true],
      ['Example Florist', false],
    ]);
  });
});

vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import type { StatementCoverage } from '../../src/contracts';
import {
  BankName,
  FileType,
  Statement,
  StatementStatus,
} from '../../src/entities/statement.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Statement coverage end to end: which days an account's statements cover,
 * read from the database the way imports and bank feeds leave it. Statements
 * in the trash, still processing or failed, receipts and anything of another
 * workspace never fill a gap or move a figure; filling a gap through the
 * import held to its dates closes it.
 */
describe('Account statement coverage (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `coverage-owner-${stamp}@example.com`,
    other: `coverage-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;
  let walletId: string;
  let otherWalletId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  type Row = {
    date: string;
    amount: number;
    verified?: boolean;
    documentNumber?: string;
    duplicateOfId?: string;
  };

  /** A statement saved as parsing leaves it, with its rows. */
  async function seedStatement(
    account: E2eAccount,
    overrides: Partial<Statement>,
    rows: Row[] = [],
  ): Promise<string> {
    const repository = dataSource.getRepository(Statement);
    const statement = await repository.save(
      repository.create({
        userId: account.userId,
        workspaceId: account.workspaceId,
        fileName: `statement-${stamp}.pdf`,
        filePath: '/dev/null',
        fileType: FileType.PDF,
        fileSize: 1,
        fileHash: `hash-${stamp}-${Math.random()}`,
        bankName: BankName.OTHER,
        currency,
        status: StatementStatus.COMPLETED,
        ...overrides,
      }),
    );
    await seedRows(account.workspaceId, statement.id, rows);
    return statement.id;
  }

  async function seedRows(workspaceId: string, statementId: string, rows: Row[]) {
    const repository = dataSource.getRepository(Transaction);
    return repository.save(
      rows.map(row =>
        repository.create({
          workspaceId,
          statementId,
          transactionDate: new Date(row.date),
          counterpartyName: 'ACME Store - Wireless Buds',
          paymentPurpose: 'Purchase',
          currency,
          transactionType: row.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
          amount: Math.abs(row.amount),
          credit: row.amount > 0 ? row.amount : null,
          debit: row.amount < 0 ? -row.amount : null,
          isVerified: row.verified ?? true,
          documentNumber: row.documentNumber ?? null,
          // Flagged by dedupe as a copy of that row.
          isDuplicate: Boolean(row.duplicateOfId),
          duplicateOfId: row.duplicateOfId ?? null,
        }),
      ),
    );
  }

  const newWallet = async (name: string) =>
    (
      await as(
        owner,
        request(server()).post('/wallets').send({ name, type: 'checking', currency }),
      ).expect(201)
    ).body.id as string;

  const coverageOf = async (account: E2eAccount, id: string) =>
    (await as(account, request(server()).get(`/wallets/${id}/statement-coverage`)).expect(200))
      .body as StatementCoverage;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    currency = (await as(owner, request(server()).get('/wallets/summary')).expect(200)).body
      .currency;
    walletId = (
      await as(
        owner,
        request(server()).post('/wallets').send({ name: 'Everyday', type: 'checking', currency }),
      ).expect(201)
    ).body.id;
    otherWalletId = (
      await as(
        other,
        request(server()).post('/wallets').send({ name: 'Elsewhere', type: 'checking', currency }),
      ).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('answers only for an account of the caller’s workspace', async () => {
    await as(other, request(server()).get(`/wallets/${walletId}/statement-coverage`)).expect(404);
    await as(owner, request(server()).get(`/wallets/${otherWalletId}/statement-coverage`)).expect(
      404,
    );
  });

  it('finds gaps, copies, chain breaks and movement mismatches, and nothing else fills a gap', async () => {
    const january = await seedStatement(
      owner,
      {
        walletId,
        statementDateFrom: new Date('2026-01-01'),
        statementDateTo: new Date('2026-01-31'),
        balanceStart: 100,
        balanceEnd: 150,
        fileHash: `january-${stamp}`,
      },
      [
        { date: '2026-01-10', amount: 80 },
        { date: '2026-01-20', amount: -30 },
      ],
    );
    // The same file uploaded again past the duplicate warning.
    const again = await seedStatement(owner, {
      walletId,
      statementDateFrom: new Date('2026-01-01'),
      statementDateTo: new Date('2026-01-31'),
      balanceStart: 100,
      balanceEnd: 150,
      fileHash: `january-${stamp}`,
    });
    // Opens 10 above January's close; one row still waits in Review; 5 nobody explains.
    const march = await seedStatement(
      owner,
      {
        walletId,
        statementDateFrom: new Date('2026-03-01'),
        statementDateTo: new Date('2026-03-31'),
        balanceStart: 160,
        balanceEnd: 200,
      },
      [
        { date: '2026-03-05', amount: 40 },
        { date: '2026-03-06', amount: -5, verified: false },
      ],
    );
    // A bank feed pull: its rows carry the provider's ids under the account id.
    const pull = await seedStatement(
      owner,
      {
        walletId,
        fileType: FileType.OFX,
        accountNumber: 'acct-1',
        statementDateFrom: new Date('2026-04-01'),
        statementDateTo: new Date('2026-04-03'),
        balanceEnd: 230,
      },
      [{ date: '2026-04-02', amount: 30, documentNumber: 'acct-1:tx-1' }],
    );
    // No printed period: its rows stand in.
    const undated = await seedStatement(owner, { walletId, fileType: FileType.CSV }, [
      { date: '2026-04-04', amount: -1 },
      { date: '2026-04-30', amount: -2 },
    ]);
    // None of these may cover February.
    const february = { statementDateFrom: new Date('2026-02-01'), statementDateTo: new Date('2026-02-28') };
    await seedStatement(owner, { walletId, ...february, deletedAt: new Date() });
    await seedStatement(owner, { walletId, ...february, status: StatementStatus.PROCESSING });
    await seedStatement(owner, { walletId, ...february, status: StatementStatus.ERROR });
    await seedStatement(owner, { walletId, ...february, fileType: FileType.IMAGE });
    await seedStatement(owner, {
      walletId,
      ...february,
      parsingDetails: { detectedBy: 'receipt-scan' },
    });
    // Another workspace's statement pointing at this account, and its row on January.
    await seedStatement(other, { walletId, ...february });
    await seedRows(other.workspaceId, january, [{ date: '2026-01-15', amount: 999 }]);

    const coverage = await coverageOf(owner, walletId);

    expect(coverage.periods.map(period => period.statementId)).toEqual([
      january,
      again,
      march,
      pull,
      undated,
    ]);
    const byId = new Map(coverage.periods.map(period => [period.statementId, period]));
    expect(byId.get(again)?.duplicateOf).toEqual({ statementId: january, kind: 'same_file' });
    expect(byId.get(pull)?.source).toBe('bank_sync');
    expect(byId.get(march)?.source).toBe('manual');
    expect(byId.get(undated)).toMatchObject({ from: '2026-04-04', to: '2026-04-30', inferred: true });
    expect(byId.get(january)).toMatchObject({ counted: 50, pending: 0, rowCount: 2 });
    expect(byId.get(march)).toMatchObject({ counted: 40, pending: -5, rowCount: 2 });

    expect(coverage.gaps).toEqual([{ from: '2026-02-01', to: '2026-02-28', days: 28 }]);
    expect(coverage.overlaps).toEqual([]);
    expect(coverage.chainBreaks).toEqual([
      expect.objectContaining({
        fromStatementId: january,
        toStatementId: march,
        closing: 150,
        opening: 160,
        difference: 10,
        afterGap: true,
      }),
    ]);
    expect(coverage.movementMismatches).toEqual([
      expect.objectContaining({ statementId: march, difference: 5, counted: 40, pending: -5 }),
    ]);
    expect(coverage.unexplained).toBe(15);
    expect(coverage.months.slice(0, 4).map(month => month.state)).toEqual([
      'covered',
      'gap',
      'covered',
      'covered',
    ]);

    // The other workspace sees none of it in its own account.
    const elsewhere = await coverageOf(other, otherWalletId);
    expect(elsewhere.periods).toEqual([]);
  });

  it('closes a gap with a sheet imported into the account, held to the gap’s dates', async () => {
    const imported = await as(
      owner,
      request(server())
        .post('/entity-imports')
        .send({
          target: 'transactions',
          mapping: { date: 0, merchant: 1, amount: 2 },
          rows: [
            ['2026-01-28', 'Corner Cafe', '-4.50'],
            ['2026-02-10', 'Corner Cafe', '-5.00'],
            ['2026-02-20', 'Employer One', '1500'],
            ['2026-03-02', 'Corner Cafe', '-6.00'],
          ],
          headers: ['Date', 'Merchant', 'Amount'],
          fileName: 'export.csv',
          options: {
            currency,
            categorize: false,
            walletId,
            dateFrom: '2026-02-01',
            dateTo: '2026-02-28',
          },
        }),
    ).expect(201);
    expect(imported.body.rows.map((row: { status: string }) => row.status)).toEqual([
      'skipped',
      'created',
      'created',
      'skipped',
    ]);

    const coverage = await coverageOf(owner, walletId);
    const sheet = coverage.periods.find(period => period.fileName.startsWith('export'));
    expect(sheet).toMatchObject({ from: '2026-02-01', to: '2026-02-28', inferred: false });
    expect(coverage.gaps).toEqual([]);
  });

  it('closes a gap no money moved in with a sheet reaching past both ends of it', async () => {
    const savings = await newWallet('Savings');
    await seedStatement(owner, {
      walletId: savings,
      statementDateFrom: new Date('2026-01-01'),
      statementDateTo: new Date('2026-01-30'),
    });
    await seedStatement(owner, {
      walletId: savings,
      statementDateFrom: new Date('2026-02-01'),
      statementDateTo: new Date('2026-02-28'),
    });
    expect((await coverageOf(owner, savings)).gaps).toEqual([
      { from: '2026-01-31', to: '2026-01-31', days: 1 },
    ]);

    const imported = await as(
      owner,
      request(server())
        .post('/entity-imports')
        .send({
          target: 'transactions',
          mapping: { date: 0, merchant: 1, amount: 2 },
          rows: [
            ['2026-01-29', 'Interest One', '0.10'],
            ['2026-02-02', 'Interest One', '0.10'],
          ],
          headers: ['Date', 'Merchant', 'Amount'],
          fileName: 'savings-export.csv',
          options: { currency, categorize: false, walletId: savings, dateFrom: '2026-01-31', dateTo: '2026-01-31' },
        }),
    ).expect(201);
    expect(imported.body.counts).toMatchObject({ created: 0, skipped: 2 });

    const coverage = await coverageOf(owner, savings);
    expect(coverage.gaps).toEqual([]);
    expect(coverage.periods.find(period => period.fileName.startsWith('savings-export'))).toMatchObject({
      from: '2026-01-31',
      to: '2026-01-31',
      rowCount: 0,
    });
  });

  it('takes a statement whose rows dedupe flagged as copies for a copy, only within this workspace', async () => {
    const wallet = await newWallet('Copies');
    const original = await seedStatement(owner, {
      walletId: wallet,
      statementDateFrom: new Date('2026-01-01'),
      statementDateTo: new Date('2026-01-31'),
    });
    const [first, second] = await seedRows(owner.workspaceId, original, [
      { date: '2026-01-10', amount: -10 },
      { date: '2026-01-12', amount: -20 },
    ]);
    // Every row of it flagged as a copy of the original's rows, period within the original's.
    const copy = await seedStatement(
      owner,
      { walletId: wallet, statementDateFrom: new Date('2026-01-05'), statementDateTo: new Date('2026-01-20') },
      [
        { date: '2026-01-10', amount: -10, duplicateOfId: first.id },
        { date: '2026-01-12', amount: -20, duplicateOfId: second.id },
      ],
    );
    // Another workspace's row filed under the original, and a row here flagged against it.
    const [foreign] = await seedRows(other.workspaceId, original, [{ date: '2026-01-15', amount: -5 }]);
    const lookalike = await seedStatement(
      owner,
      { walletId: wallet, statementDateFrom: new Date('2026-01-14'), statementDateTo: new Date('2026-01-16') },
      [{ date: '2026-01-15', amount: -5, duplicateOfId: foreign.id }],
    );

    const coverage = await coverageOf(owner, wallet);
    const byId = new Map(coverage.periods.map(period => [period.statementId, period.duplicateOf]));
    expect(byId.get(copy)).toEqual({ statementId: original, kind: 'same_rows' });
    expect(byId.get(lookalike)).toBeNull();
    expect(coverage.overlaps).toEqual([
      expect.objectContaining({ from: '2026-01-14', to: '2026-01-16', statementIds: [original, lookalike] }),
    ]);
  });
});

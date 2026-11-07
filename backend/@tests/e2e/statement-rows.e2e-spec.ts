vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The last resort for a statement no reading gets right: a missing row added
 * by hand, a wrong one corrected through the transactions, and the checks
 * held against the rows as they now are until the statement is completed.
 */
describe('Statement rows corrected by hand (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `rows-owner-${stamp}@example.com`,
    other: `rows-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;

  const opening = 1000;
  const read = [12.5, 30];
  const missed = 7.5;
  const closing = opening - [...read, missed].reduce((sum, value) => sum + value, 0);
  const printedOut = read[0] + read[1] + missed;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  /** A statement read one row short: its balances and printed money out do not add up. */
  async function seedShortStatement(account: E2eAccount): Promise<string> {
    const statement = await dataSource.getRepository(Statement).save({
      userId: account.userId,
      workspaceId: account.workspaceId,
      fileName: `short-${stamp}.pdf`,
      filePath: '/dev/null',
      fileType: FileType.PDF,
      fileSize: 1,
      fileHash: `rows-${stamp}-${Math.random()}`,
      bankName: BankName.OTHER,
      currency: 'USD',
      balanceStart: opening,
      balanceEnd: closing,
      status: StatementStatus.NEEDS_REVIEW,
      parsingDetails: {
        checks: [
          { code: 'balance_chain', passed: false, detail: { row: 2, date: '02 Sep', expected: 957.5, actual: 950 } },
          { code: 'printed_totals', passed: false, detail: { side: 'debits', expected: printedOut, actual: 42.5 } },
        ],
      },
    });
    const rows = dataSource.getRepository(Transaction);
    await rows.save(
      read.map(amount =>
        rows.create({
          workspaceId: account.workspaceId,
          statementId: statement.id,
          transactionDate: new Date('2026-09-02'),
          counterpartyName: 'ACME Store',
          paymentPurpose: 'Purchase',
          currency: 'USD',
          transactionType: TransactionType.EXPENSE,
          amount,
          debit: amount,
          credit: null,
        }),
      ),
    );
    return statement.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('completes a statement once the row it missed is added', async () => {
    const id = await seedShortStatement(owner);

    const before = await as(owner, request(server()).post(`/statements/${id}/recheck`)).expect(200);
    expect(before.body).toMatchObject({ status: 'needs_review', passed: false });
    expect(before.body.reasonCodes).toEqual(expect.arrayContaining(['balance_mismatch', 'printed_totals']));

    const added = await as(owner, request(server()).post(`/statements/${id}/rows`))
      .send({ transactionDate: '2026-09-02', counterpartyName: 'ACME Cafe', amount: -missed })
      .expect(200);
    expect(added.body).toEqual({ status: 'completed', passed: true, reasonCodes: [] });

    const row = await dataSource
      .getRepository(Transaction)
      .findOneByOrFail({ statementId: id, counterpartyName: 'ACME Cafe' });
    expect(row).toMatchObject({ transactionType: TransactionType.EXPENSE, currency: 'USD' });
    expect(Number(row.debit)).toBe(missed);
    const statement = await dataSource.getRepository(Statement).findOneByOrFail({ id });
    expect(Number(statement.totalDebit)).toBe(printedOut);
    expect(statement.totalTransactions).toBe(3);
  });

  it('holds a corrected amount against the balances again', async () => {
    const id = await seedShortStatement(owner);
    const [first] = await dataSource
      .getRepository(Transaction)
      .find({ where: { statementId: id }, order: { debit: 'ASC' } });
    // The reading merged two payments into one row: the user puts the sum on it.
    await as(owner, request(server()).put(`/transactions/${first.id}`))
      .send({ debit: read[0] + missed, amount: read[0] + missed })
      .expect(200);
    const after = await as(owner, request(server()).post(`/statements/${id}/recheck`)).expect(200);
    expect(after.body).toMatchObject({ status: 'completed', passed: true });
  });

  it('refuses a row of no money and keeps statements inside their workspace', async () => {
    const id = await seedShortStatement(owner);
    await as(owner, request(server()).post(`/statements/${id}/rows`))
      .send({ transactionDate: '2026-09-02', counterpartyName: 'ACME Cafe', amount: 0 })
      .expect(400);
    await as(other, request(server()).post(`/statements/${id}/rows`))
      .send({ transactionDate: '2026-09-02', counterpartyName: 'ACME Cafe', amount: -missed })
      .expect(404);
    await as(other, request(server()).post(`/statements/${id}/recheck`)).expect(404);
    expect(await dataSource.getRepository(Transaction).countBy({ statementId: id })).toBe(read.length);
  });
});

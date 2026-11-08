vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  Transaction,
  TransactionType,
  TransferPairSource,
} from '../../src/entities/transaction.entity';
import { TransferPairRejection } from '../../src/entities/transfer-pair-rejection.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

interface ListedTransaction {
  id: string;
  transferPairId: string | null;
  transferPairSource: string | null;
}

/**
 * Transfer pairing end to end: two manual entries on two statements, one
 * flipped to an incoming leg, are paired by the detector, unlinked, left
 * alone by the next run (while each may still pair with a third row),
 * offered to the manual picker and linked by hand. Another workspace sees
 * none of it.
 */
describe('Transfer pairing (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `transfer-owner-${stamp}@example.com`,
    other: `transfer-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let outgoingId: string;
  let incomingId: string;
  let categoryId: string;

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();

  async function bookExpense(categoryId: string, amount: string, merchant: string, date: string) {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'KZT')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    expect(listed.body.data).toHaveLength(1);
    return listed.body.data[0].id as string;
  }

  async function listTransfers(): Promise<ListedTransaction[]> {
    const res = await as(owner, request(server()).get('/transactions?type=transfer')).expect(200);
    return res.body.data;
  }

  async function reload(id: string): Promise<Transaction> {
    return dataSource.getRepository(Transaction).findOneByOrFail({ id });
  }

  /** Manual entries only book expenses; this turns one into an incoming leg. */
  async function makeIncoming(id: string, amount: number) {
    await dataSource.getRepository(Transaction).update(id, {
      transactionType: TransactionType.INCOME,
      credit: amount,
      debit: null,
    });
  }

  /** The refusals stored in the owner's workspace, as sorted id pairs. */
  async function rejections(): Promise<string[][]> {
    const rows = await dataSource
      .getRepository(TransferPairRejection)
      .findBy({ workspaceId: owner.workspaceId });
    return rows.map(row => [row.txLowId, row.txHighId]);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Transfer Owner');
    other = await registerAccount(app, emails.other, 'Transfer Other');

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryId = categories.body[0].id;

    outgoingId = await bookExpense(categoryId, '500', 'To savings', '2026-04-01');
    incomingId = await bookExpense(categoryId, '500', 'From checking', '2026-04-02');
    await makeIncoming(incomingId, 500);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('pairs the two legs and lists them as a transfer', async () => {
    const res = await as(owner, request(server()).post('/transactions/transfers/detect'))
      .send({})
      .expect(200);
    expect(res.body).toEqual({ found: 1, paired: 1 });

    const transfers = await listTransfers();
    expect(transfers.map(tx => tx.id).sort()).toEqual([outgoingId, incomingId].sort());
    expect(new Set(transfers.map(tx => tx.transferPairId)).size).toBe(1);
    expect(transfers.every(tx => tx.transferPairSource === TransferPairSource.AUTO)).toBe(true);
  });

  it('hides the pair from another workspace', async () => {
    await as(other, request(server()).get(`/transactions/${outgoingId}/transfer-candidates`)).expect(
      404,
    );
    await as(other, request(server()).post(`/transactions/${outgoingId}/unlink-transfer`)).expect(
      404,
    );
    await as(other, request(server()).post(`/transactions/${outgoingId}/link-transfer`))
      .send({ otherId: incomingId })
      .expect(404);
  });

  it('unlinks both legs and the next run leaves them alone', async () => {
    await as(owner, request(server()).post(`/transactions/${outgoingId}/unlink-transfer`)).expect(
      200,
    );
    for (const id of [outgoingId, incomingId]) {
      const row = await reload(id);
      expect(row.transferPairId).toBeNull();
      // The refusal belongs to the pair; the rows themselves stay pairable.
      expect(row.transferPairSource).toBeNull();
    }
    expect(await rejections()).toEqual([[outgoingId, incomingId].sort()]);

    const res = await as(owner, request(server()).post('/transactions/transfers/detect'))
      .send({})
      .expect(200);
    expect(res.body).toEqual({ found: 0, paired: 0 });
    expect(await listTransfers()).toHaveLength(0);
  });

  it('pairs an unlinked leg with another qualifying row', async () => {
    const thirdId = await bookExpense(categoryId, '500', 'From brokerage', '2026-04-03');
    await makeIncoming(thirdId, 500);

    const res = await as(owner, request(server()).post('/transactions/transfers/detect'))
      .send({})
      .expect(200);
    expect(res.body).toEqual({ found: 1, paired: 1 });
    const transfers = await listTransfers();
    expect(transfers.map(tx => tx.id).sort()).toEqual([outgoingId, thirdId].sort());
    expect(transfers.every(tx => tx.transferPairSource === TransferPairSource.AUTO)).toBe(true);

    // Put things back for the next steps: unlink, then drop the third row,
    // which takes its refusal with it.
    await as(owner, request(server()).post(`/transactions/${outgoingId}/unlink-transfer`)).expect(
      200,
    );
    expect(await rejections()).toHaveLength(2);
    await dataSource.getRepository(Transaction).delete(thirdId);
    expect(await rejections()).toEqual([[outgoingId, incomingId].sort()]);
  });

  it('still offers the counterpart to the manual picker and links it by hand', async () => {
    const candidates = await as(
      owner,
      request(server()).get(`/transactions/${outgoingId}/transfer-candidates`),
    ).expect(200);
    expect(candidates.body.data.map((tx: ListedTransaction) => tx.id)).toEqual([incomingId]);

    const linked = await as(owner, request(server()).post(`/transactions/${outgoingId}/link-transfer`))
      .send({ otherId: incomingId })
      .expect(200);
    expect(linked.body.transferPairId).toEqual(expect.any(String));

    const transfers = await listTransfers();
    expect(transfers).toHaveLength(2);
    expect(transfers.every(tx => tx.transferPairId === linked.body.transferPairId)).toBe(true);
    expect(transfers.every(tx => tx.transferPairSource === TransferPairSource.MANUAL)).toBe(true);
    // Linking by hand lifts the refusal.
    expect(await rejections()).toEqual([]);
  });

  it('refuses to link a leg that is already paired', async () => {
    await as(owner, request(server()).post(`/transactions/${outgoingId}/link-transfer`))
      .send({ otherId: incomingId })
      .expect(409);
  });

  it('links a full repayment as a reimbursement pair and unlinks it again', async () => {
    // Free both rows first: the previous test left them as a manual transfer.
    await as(owner, request(server()).post(`/transactions/${outgoingId}/unlink-transfer`)).expect(
      200,
    );

    const candidates = await as(
      owner,
      request(server()).get(`/transactions/${incomingId}/reimbursement-candidates`),
    ).expect(200);
    expect(candidates.body.data.map((tx: ListedTransaction) => tx.id)).toEqual([outgoingId]);

    const linked = await as(
      owner,
      request(server()).post(`/transactions/${incomingId}/link-reimbursement`),
    )
      .send({ expenseId: outgoingId })
      .expect(200);
    expect(linked.body.full).toBe(true);

    const transfers = await listTransfers();
    expect(transfers).toHaveLength(2);
    for (const id of [outgoingId, incomingId]) {
      const row = await reload(id);
      expect(row.transferPairId).toBe(linked.body.transferPairId);
      expect(row.transferPairKind).toBe('reimbursement');
    }
    expect((await reload(incomingId)).reimbursementOfId).toBe(outgoingId);

    const listed = await as(owner, request(server()).get('/transactions?type=income')).expect(200);
    const incomeRow = listed.body.data.find((tx: ListedTransaction) => tx.id === incomingId);
    expect(incomeRow.reimbursementOf.id).toBe(outgoingId);

    await as(owner, request(server()).post(`/transactions/${incomingId}/unlink-reimbursement`)).expect(
      200,
    );
    expect(await listTransfers()).toHaveLength(0);
    expect((await reload(incomingId)).reimbursementOfId).toBeNull();

    // Direction matters: the expense cannot be "the reimbursement".
    await as(owner, request(server()).post(`/transactions/${outgoingId}/link-reimbursement`))
      .send({ expenseId: incomingId })
      .expect(400);
  });

  it('does not pick a refused partner when the row is moved to its account', async () => {
    const wallet = await as(
      owner,
      request(server()).post('/wallets').send({ name: 'ACME Savings', currency: 'KZT' }),
    ).expect(201);
    const moved = await bookExpense(categoryId, '700', 'To ACME Savings', '2026-05-01');
    const refused = await bookExpense(categoryId, '700', 'Into ACME Savings', '2026-05-02');
    await makeIncoming(refused, 700);
    await dataSource.getRepository(Transaction).update(refused, { walletId: wallet.body.id });
    await as(owner, request(server()).post(`/transactions/${moved}/link-transfer`))
      .send({ otherId: refused })
      .expect(200);
    await as(owner, request(server()).post(`/transactions/${moved}/unlink-transfer`)).expect(200);

    const res = await as(
      owner,
      request(server())
        .post(`/transactions/${moved}/transfer-to-account`)
        .send({ walletId: wallet.body.id }),
    ).expect(200);
    // A mirror row is booked instead of the refused one, and the refusal stays.
    expect(res.body.createdId).toEqual(expect.any(String));
    expect(res.body.createdId).not.toBe(refused);
    expect((await reload(refused)).transferPairId).toBeNull();
    expect(await rejections()).toContainEqual([moved, refused].sort());
  });

  it('keeps a lone unlinked leg out of automatic runs', async () => {
    const lone = await bookExpense(categoryId, '333', 'ACME Exchange', '2026-06-01');
    await dataSource.getRepository(Transaction).update(lone, {
      transferPairId: randomUUID(),
      transferPairSource: TransferPairSource.AUTO,
    });
    const before = await rejections();
    await as(owner, request(server()).post(`/transactions/${lone}/unlink-transfer`)).expect(200);
    expect((await reload(lone)).transferPairSource).toBe(TransferPairSource.REJECTED);
    expect(await rejections()).toEqual(before);

    const counterpart = await bookExpense(categoryId, '333', 'From ACME Exchange', '2026-06-02');
    await makeIncoming(counterpart, 333);
    const res = await as(owner, request(server()).post('/transactions/transfers/detect'))
      .send({})
      .expect(200);
    expect(res.body).toEqual({ found: 0, paired: 0 });
    expect((await reload(lone)).transferPairId).toBeNull();
  });

  it('validates the body', async () => {
    await as(owner, request(server()).post(`/transactions/${outgoingId}/link-transfer`))
      .send({ otherId: 'not-a-uuid' })
      .expect(400);
    await as(owner, request(server()).post('/transactions/transfers/detect'))
      .send({ statementId: 'nope' })
      .expect(400);
  });
});

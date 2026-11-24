vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import { LedgerSyncService } from '../../src/modules/ledger/ledger-sync.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A bank row booked as income, then linked to the invoice it pays: the
 * posting is rebuilt against receivables, and back when unlinked (#630).
 */
describe('Ledger: invoice payment linked to a booked row (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `ledger-invoice-payment-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let rowId: string;
  let payableId: string;
  const RECEIVABLES = 'ASSET_RECEIVABLES';

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  /** The account the row's postings credit, net. */
  const creditedAccount = async (id = rowId): Promise<string> => {
    await app.get(LedgerSyncService).syncWorkspace(owner.workspaceId);
    // Net over every entry of the row: a rebuild posts a reversal and a new entry.
    const [line] = await dataSource.query(
      `SELECT a."code" FROM "journal_entries" e
         JOIN "journal_lines" l ON l."entry_id" = e."id"
         JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE e."source_transaction_id" = $1 AND e."status" = 'posted'
        GROUP BY a."code" HAVING sum(l."credit" - l."debit") > 0`,
      [id],
    );
    return line?.code ?? 'none';
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(server()).put('/ledger/settings')).send({ baseCurrency: 'EUR' }).expect(200);

    const categories = await as(request(server()).get('/categories?type=income')).expect(200);
    const expenses = await as(request(server()).get('/categories?type=expense')).expect(200);
    const statement = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', '1000')
      .field('currency', 'EUR')
      .field('merchant', 'ACME Client')
      .field('categoryId', expenses.body[0].id)
      .field('date', '2026-10-05')
      .expect(201);
    const repository = dataSource.getRepository(Transaction);
    const [row] = await repository.findBy({ statementId: statement.body.id });
    await repository.update(row.id, {
      transactionType: TransactionType.INCOME,
      debit: null,
      credit: 1000,
      categoryId: categories.body[0].id,
      isVerified: true,
    });
    rowId = row.id;
    const invoice = await as(request(server()).post('/payables'))
      .send({ direction: 'receivable', vendor: 'ACME Client', amount: 1000, currency: 'EUR', source: 'invoice' })
      .expect(201);
    payableId = invoice.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('books the row against its category while no invoice claims it', async () => {
    const account = await creditedAccount();
    expect(account).not.toBe('none');
    expect(account).not.toBe(RECEIVABLES);
  });

  it('rebuilds it against receivables once the invoice is marked paid by it', async () => {
    await as(request(server()).put(`/payables/${payableId}/mark-paid`))
      .send({ linkedTransactionId: rowId })
      .expect(200);

    expect(await creditedAccount()).toBe(RECEIVABLES);
  });

  it('rebuilds it against the category again when the invoice is deleted', async () => {
    await as(request(server()).delete(`/payables/${payableId}`)).expect(200);

    const account = await creditedAccount();
    expect(account).not.toBe('none');
    expect(account).not.toBe(RECEIVABLES);
  });

  it('rebuilds a second bank row that pays part of an invoice, and back when that payment goes', async () => {
    const repository = dataSource.getRepository(Transaction);
    const { id: _id, createdAt: _c, updatedAt: _u, fingerprint: _f, ...first } =
      await repository.findOneByOrFail({ id: rowId });
    const firstPart = (await repository.save({ ...first, credit: 600, amount: 600 })).id;
    const secondPart = (await repository.save({ ...first, credit: 400, amount: 400 })).id;
    const invoice = await as(request(server()).post('/payables'))
      .send({ direction: 'receivable', vendor: 'ACME Client', amount: 1000, currency: 'EUR', source: 'invoice' })
      .expect(201);
    await as(request(server()).post(`/payables/${invoice.body.id}/payments`))
      .send({ amount: 600, linkedTransactionId: firstPart })
      .expect(201);
    expect(await creditedAccount(secondPart)).not.toBe(RECEIVABLES);

    // Only a payment row links this one: the invoice keeps the first.
    await as(request(server()).post(`/payables/${invoice.body.id}/payments`))
      .send({ amount: 400, linkedTransactionId: secondPart })
      .expect(201);
    expect(await creditedAccount(secondPart)).toBe(RECEIVABLES);

    const [payment] = await dataSource.query(
      'SELECT id FROM payable_payments WHERE transaction_id = $1',
      [secondPart],
    );
    await as(request(server()).delete(`/payables/${invoice.body.id}/payments/${payment.id}`)).expect(200);
    expect(await creditedAccount(secondPart)).not.toBe(RECEIVABLES);
  });

  it('rebuilds a row for an invoice created already linked to it', async () => {
    const repository = dataSource.getRepository(Transaction);
    const { id: _id, createdAt: _c, updatedAt: _u, fingerprint: _f, ...first } =
      await repository.findOneByOrFail({ id: rowId });
    const paidBefore = (await repository.save({ ...first, credit: 250, amount: 250 })).id;
    expect(await creditedAccount(paidBefore)).not.toBe(RECEIVABLES);

    await as(request(server()).post('/payables'))
      .send({
        direction: 'receivable',
        vendor: 'ACME Client',
        amount: 250,
        currency: 'EUR',
        source: 'invoice',
        linkedTransactionId: paidBefore,
      })
      .expect(201);

    expect(await creditedAccount(paidBefore)).toBe(RECEIVABLES);
  });

  it('rebuilds a row paid only by a payment when its invoice is deleted', async () => {
    const repository = dataSource.getRepository(Transaction);
    const { id: _id, createdAt: _c, updatedAt: _u, fingerprint: _f, ...first } =
      await repository.findOneByOrFail({ id: rowId });
    const linked = (await repository.save({ ...first, credit: 300, amount: 300 })).id;
    const paymentOnly = (await repository.save({ ...first, credit: 200, amount: 200 })).id;
    const invoice = await as(request(server()).post('/payables'))
      .send({ direction: 'receivable', vendor: 'ACME Client', amount: 500, currency: 'EUR', source: 'invoice' })
      .expect(201);
    for (const [amount, transaction] of [
      [300, linked],
      [200, paymentOnly],
    ] as const) {
      await as(request(server()).post(`/payables/${invoice.body.id}/payments`))
        .send({ amount, linkedTransactionId: transaction })
        .expect(201);
    }
    expect(await creditedAccount(paymentOnly)).toBe(RECEIVABLES);

    await as(request(server()).delete(`/payables/${invoice.body.id}`)).expect(200);

    expect(await creditedAccount(paymentOnly)).not.toBe(RECEIVABLES);
  });
});

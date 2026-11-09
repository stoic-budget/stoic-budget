vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BANK_SYNC_FETCH } from '../../src/modules/bank-sync/bank-sync-provider.interface';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const DAY = 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);
const daysAgo = (days: number) => now - days * DAY;

interface FeedRow {
  id: string;
  posted: number;
  transacted_at?: number;
  amount: string;
  description: string;
  payee: string;
  pending?: boolean;
}

const payroll: FeedRow = {
  id: 'PAY-1',
  posted: daysAgo(3),
  amount: '3000.00',
  description: 'ACME PAYROLL',
  payee: 'ACME Payroll',
};
const buds = { amount: '-15.00', description: 'ACME STORE', payee: 'ACME Store - Wireless Buds' };
const hotel = { amount: '-30.00', description: 'EXAMPLE HOTEL', payee: 'Example Hotel - Deposit' };
const kiosk = { amount: '-4.00', description: 'EXAMPLE KIOSK', payee: 'Example Kiosk - Snack' };
const lapsed = { amount: '-8.00', description: 'EXAMPLE CAFE', payee: 'Example Cafe - Latte' };
/** SimpleFIN sends a hold with `posted: 0` and its day in `transacted_at`. */
const hold = (base: Omit<FeedRow, 'id' | 'posted'>, id: string, days: number): FeedRow => ({
  ...base,
  id,
  posted: 0,
  transacted_at: daysAgo(days),
  pending: true,
});

/** The first pull: one booked row and four holds, one of them long lapsed. */
const firstFeed: FeedRow[] = [
  payroll,
  hold(buds, 'AUTH-1', 2),
  hold(hotel, 'HOLD-3', 2),
  hold(kiosk, 'AUTH-5', 1),
  hold(lapsed, 'AUTH-9', 20),
];
/**
 * The second: the buds booked under the same id, the hotel booked under a new
 * id a day later (a bank that renumbers), the kiosk hold gone from the feed.
 */
const secondFeed: FeedRow[] = [
  payroll,
  { ...buds, id: 'AUTH-1', posted: daysAgo(1) },
  { ...hotel, id: 'BOOKED-3', posted: daysAgo(1) },
];
/** The third: a second hold just like the booked buds, which the fourth no longer lists. */
const thirdFeed: FeedRow[] = [...secondFeed, hold(buds, 'AUTH-6', 1)];

const bridge = {
  claimUrl: 'https://bridge-p.example.org/simplefin/claim/demo',
  accessUrl: 'https://demo:secret-p@bridge-p.example.org/simplefin',
};
let feed: FeedRow[] = firstFeed;

/** A stand-in for SimpleFIN Bridge that serves whatever `feed` holds. Nothing leaves the process. */
async function standIn(url: string, init: RequestInit = {}): Promise<Response> {
  if (url === bridge.claimUrl && init.method === 'POST') {
    return new Response(bridge.accessUrl, { status: 200 });
  }
  if (url.startsWith(new URL(bridge.accessUrl).origin)) {
    const balancesOnly = new URL(url).searchParams.get('balances-only') === '1';
    return new Response(
      JSON.stringify({
        errors: [],
        accounts: [
          {
            org: { name: 'Demo Bank', domain: 'demo.example' },
            id: 'ACT-P',
            name: 'Checking',
            currency: 'USD',
            balance: '3000.00',
            'balance-date': now,
            transactions: balancesOnly ? [] : feed,
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  return new Response('', { status: 401 });
}

/**
 * A bank-sync pull keeps the rows the bank still holds as pending, shown but
 * counted nowhere, and turns each into its booked version when that arrives,
 * keeping what the user did to it.
 */
describe('Bank sync pending rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `bank-pending-${stamp}@example.com`;
  let owner: E2eAccount;
  let connectionId: string;
  let walletId: string;
  let categoryId: string;
  let tagId: string;
  const opening = 100;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  const awaitParsed = async (statementId: string) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const res = await as(request(server()).get(`/statements/${statementId}`)).expect(200);
      if (res.body.status === 'completed') return;
      if (res.body.status === 'failed') throw new Error(`statement ${statementId} failed to parse`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`statement ${statementId} never finished parsing`);
  };
  const pull = async () => {
    const res = await as(
      request(server()).post(`/integrations/bank-sync/connections/${connectionId}/sync`),
    ).expect(201);
    const statementId = res.body.accounts[0].statementId as string | null;
    if (statementId) await awaitParsed(statementId);
    return res.body;
  };
  /** The workspace's rows as stored, by payee. */
  const rows = async () =>
    (await dataSource.query(
      `SELECT id, counterparty_name AS payee, document_number AS "documentNumber",
              is_pending AS "isPending", is_verified AS "isVerified", category_id AS "categoryId",
              is_duplicate AS "isDuplicate",
              comments, amount, fingerprint, transaction_date::text AS day
         FROM transactions WHERE workspace_id = $1 ORDER BY counterparty_name`,
      [owner.workspaceId],
    )) as Array<Record<string, string | boolean | null>>;
  const rowOf = async (payee: string) => {
    const matching = (await rows()).filter(row => row.payee === payee);
    expect(matching).toHaveLength(1);
    return matching[0];
  };
  const balance = async () =>
    (await as(request(server()).get(`/wallets/${walletId}`)).expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] })
      .overrideProvider(BANK_SYNC_FETCH)
      .useValue(standIn)
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const connection = await as(request(server()).post('/integrations/bank-sync/connections/token'))
      .send({
        provider: 'simplefin',
        setupToken: Buffer.from(bridge.claimUrl).toString('base64'),
        label: 'Bridge',
      })
      .expect(201);
    connectionId = connection.body.id;
    const wallet = await as(request(server()).post('/wallets'))
      .send({ name: 'Checking', currency: 'USD', initialBalance: opening })
      .expect(201);
    walletId = wallet.body.id;
    await as(
      request(server()).patch(
        `/integrations/bank-sync/connections/${connectionId}/accounts/ACT-P`,
      ),
    )
      .send({ walletId })
      .expect(200);
    const category = await as(request(server()).post('/categories'))
      .send({ name: `Gadgets ${stamp}`, type: 'expense' })
      .expect(201);
    categoryId = category.body.id;
    const tag = await as(request(server()).post('/tags'))
      .send({ name: `gift-${stamp}` })
      .expect(201);
    tagId = tag.body.id;
  }, 180_000);

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('keeps the holds as pending rows, all but the lapsed one, without a fingerprint', async () => {
    const result = await pull();

    expect(result.imported).toBe(4);
    const stored = await rows();
    expect(Object.fromEntries(stored.map(row => [row.documentNumber, row.isPending]))).toEqual({
      'ACT-P:PAY-1': false,
      'ACT-P:AUTH-1': true,
      'ACT-P:HOLD-3': true,
      'ACT-P:AUTH-5': true,
    });
    expect(stored.filter(row => row.isPending).every(row => row.fingerprint === null)).toBe(true);
    expect(stored.some(row => row.payee === lapsed.payee)).toBe(false);
    // A hold keeps the day it was transacted on, not 1 January 1970.
    expect((await rowOf(buds.payee)).day).toBe(new Date(daysAgo(2) * 1000).toISOString().slice(0, 10));
  }, 240_000);

  it('asks nothing about a pending row in Review, and counts none in the account', async () => {
    const counts = await as(request(server()).get('/review-inbox/counts')).expect(200);
    expect(counts.body.transaction).toBe(1);
    const wallet = await balance();
    expect(wallet.pendingReviewCount).toBe(1);
    expect(wallet.transactionCount).toBe(0);
    expect(wallet.balance).toBe(opening);
  });

  it('lets the user edit a pending row, and its approval still counts nothing while it is pending', async () => {
    const budsRow = await rowOf(buds.payee);
    const payrollRow = await rowOf(payroll.payee);
    await as(request(server()).put(`/transactions/${budsRow.id}`))
      .send({ categoryId, comments: 'A gift for member two', isVerified: true })
      .expect(200);
    await as(request(server()).put(`/transactions/${budsRow.id}/tags`))
      .send({ tagIds: [tagId] })
      .expect(200);
    await as(request(server()).post('/review-inbox/transactions/approve'))
      .send({ ids: [payrollRow.id] })
      .expect(200);

    const wallet = await balance();
    // Only the payroll moved money; the approved hold is still a hold.
    expect(wallet.balance).toBe(opening + 3000);
    expect(wallet.transactionCount).toBe(1);
  });

  it('turns each hold into its booked version, by id or by resemblance, keeping the edits', async () => {
    const before = { buds: await rowOf(buds.payee), hotel: await rowOf(hotel.payee) };
    const kioskRow = await rowOf(kiosk.payee);
    // The kiosk hold never books: two weeks on, the pull removes it.
    await dataSource.query(
      `UPDATE transactions SET transaction_date = CURRENT_DATE - 20 WHERE id = $1`,
      [kioskRow.id],
    );
    feed = secondFeed;

    const result = await pull();

    expect(result.imported).toBe(0);
    expect(result.statements).toBe(0);
    const budsRow = await rowOf(buds.payee);
    expect(budsRow).toMatchObject({
      id: before.buds.id,
      isPending: false,
      isVerified: true,
      categoryId,
      comments: 'A gift for member two',
      documentNumber: 'ACT-P:AUTH-1',
    });
    expect(budsRow.fingerprint).not.toBeNull();
    const tags = await as(request(server()).get(`/transactions/${budsRow.id}/tags`)).expect(200);
    expect(tags.body.map((tag: { id: string }) => tag.id)).toEqual([tagId]);

    const hotelRow = await rowOf(hotel.payee);
    expect(hotelRow).toMatchObject({
      id: before.hotel.id,
      isPending: false,
      documentNumber: 'ACT-P:BOOKED-3',
      day: new Date((now - DAY) * 1000).toISOString().slice(0, 10),
    });
    expect((await rows()).some(row => row.payee === kiosk.payee)).toBe(false);
    expect(await rows()).toHaveLength(3);

    // The approved buds now count; the hotel waits in Review like any new row.
    const wallet = await balance();
    expect(wallet.balance).toBe(opening + 3000 - 15);
    expect(wallet.pendingReviewCount).toBe(1);
  }, 240_000);

  it('imports nothing on a further pull of the same feed', async () => {
    const result = await pull();

    expect(result.imported).toBe(0);
    expect(await rows()).toHaveLength(3);
  }, 240_000);

  it('never books a reversed hold as a booked row the provider lists again', async () => {
    feed = thirdFeed;
    expect((await pull()).imported).toBe(1);
    const second = (await rows()).find(row => row.documentNumber === 'ACT-P:AUTH-6');
    expect(second).toMatchObject({ isPending: true, isDuplicate: false });

    // The bank reversed the second hold; the booked buds are listed as before.
    feed = secondFeed;
    expect((await pull()).imported).toBe(0);

    const after = await rows();
    expect(after.find(row => row.id === second?.id)).toMatchObject({
      isPending: true,
      isDuplicate: false,
      documentNumber: 'ACT-P:AUTH-6',
    });
    expect(after.filter(row => row.documentNumber === 'ACT-P:AUTH-1')).toHaveLength(1);
    expect((await balance()).balance).toBe(opening + 3000 - 15);
  }, 240_000);

  it('lists a recent hold in the forecast as spent, and not one older than the bank keeps it', async () => {
    const pendingIn = async () =>
      (await as(request(server()).get('/forecast?days=30')).expect(200)).body.events.filter(
        (event: { kind: string }) => event.kind === 'pending',
      );
    const second = (await rows()).find(row => row.documentNumber === 'ACT-P:AUTH-6');
    expect(await pendingIn()).toEqual([
      expect.objectContaining({ sourceId: second?.id, amount: -15 }),
    ]);

    // An account no longer pulled never removes its holds: the forecast ages them out.
    await dataSource.query(
      `UPDATE transactions SET transaction_date = CURRENT_DATE - 40 WHERE id = $1`,
      [second?.id],
    );
    expect(await pendingIn()).toEqual([]);
  }, 60_000);
});

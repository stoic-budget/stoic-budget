vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The tag page: everything a tag counted, read the way Reports' By tag reads
 * it, so the page and the report show one total for the same days.
 */
describe('Tag summary (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `tag-sum-owner-${stamp}@example.com`,
    partner: `tag-sum-partner-${stamp}@example.com`,
    other: `tag-sum-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let other: E2eAccount;
  let partnerMemberId: string;
  const ids: Record<string, string> = {};
  // A currency with a hand-entered rate, and one with none.
  const RATED = 'ZZQ';
  const UNRATED = 'ZZM';

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();

  const now = new Date();
  const monthOf = (back: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
  const lastDay = (month: string) => {
    const [year, index] = month.split('-').map(Number);
    return new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
  };

  async function book(
    categoryId: string,
    amount: number,
    date: string,
    merchant: string,
    currency = 'USD',
  ): Promise<{ id: string; statementId: string }> {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', currency)
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return { id: listed.body.data[0].id, statementId: statement.body.id };
  }

  const tagRow = (transactionId: string, tagIds: string[]) =>
    as(owner, request(server()).put(`/transactions/${transactionId}/tags`))
      .send({ tagIds })
      .expect(200);

  async function category(name: string, type: string): Promise<string> {
    const res = await as(owner, request(server()).post('/categories'))
      .send({ name: `${name} ${stamp}`, type })
      .expect(201);
    return res.body.id;
  }

  async function tag(name: string): Promise<string> {
    return (await as(owner, request(server()).post('/tags')).send({ name }).expect(201)).body.id;
  }

  const summary = async (tagId: string, account = owner) =>
    (
      await as(
        account,
        request(server()).get(`/tags/${tagId}/summary`),
        owner.workspaceId,
      ).expect(200)
    ).body;

  /** What Reports' By tag shows for the tag, for one side and the given days. */
  const reportOf = async (tagId: string, type: string, range = '', account = owner) => {
    const res = await as(
      account,
      request(server()).get(`/reports/spend-flow?groupBy=tag&type=${type}${range}`),
      owner.workspaceId,
    ).expect(200);
    return res.body.nodes.find((node: { id: string }) => node.id === `tag:${tagId}`)?.amount ?? 0;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member', permissions: { canEditStatements: true } })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    [{ id: partnerMemberId }] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, partner.userId],
    );
    await as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: RATED, to: 'USD', rate: 0.5, date: `${monthOf(6)}-01` })
      .expect(201);

    ids.lodging = await category('Lodging', 'expense');
    ids.food = await category('Food', 'expense');
    ids.trip = await tag('Example Trip');
    ids.work = await tag('Example Project');
    ids.quiet = await tag('Quiet');

    // Counted on the trip: 100 + 40 + 20 ZZQ at 0.5 + 60 (also on the project) + 25.
    await tagRow((await book(ids.lodging, 100, `${monthOf(5)}-10`, 'Example Hotel')).id, [
      ids.trip,
    ]);
    await tagRow((await book(ids.food, 40, `${monthOf(3)}-04`, 'Example Cafe')).id, [ids.trip]);
    await tagRow((await book(ids.food, 20, `${monthOf(3)}-05`, 'Example Cafe', RATED)).id, [
      ids.trip,
    ]);
    await tagRow((await book(ids.food, 60, `${monthOf(1)}-06`, 'Example Cafe')).id, [
      ids.trip,
      ids.work,
    ]);
    // The tag on the statement reaches its row.
    const onStatement = await book(ids.lodging, 25, `${monthOf(1)}-07`, 'Example Hostel');
    await as(owner, request(server()).patch(`/storage/files/${onStatement.statementId}/tags`))
      .send({ tagIds: [ids.trip] })
      .expect(200);
    // Money back on the trip: received, as Reports' By tag reads it.
    const refund = await book(ids.food, 15, `${monthOf(1)}-08`, 'Example Cafe');
    await dataSource.query(
      `UPDATE transactions SET transaction_type = 'income', credit = amount, debit = NULL
        WHERE id = $1`,
      [refund.id],
    );
    await tagRow(refund.id, [ids.trip]);

    // Left out, as Reports leaves them out; dated this month so a slip would move the span too.
    const excluded = {
      duplicate: await book(ids.food, 100, `${monthOf(0)}-01`, 'Left Out'),
      transfer: await book(ids.food, 200, `${monthOf(0)}-01`, 'Left Out'),
      unconfirmed: await book(ids.food, 400, `${monthOf(0)}-01`, 'Left Out'),
      trashed: await book(ids.food, 800, `${monthOf(0)}-01`, 'Left Out'),
      processing: await book(ids.food, 1600, `${monthOf(0)}-01`, 'Left Out'),
      // Named in missingRates; the day it was used still counts in the span.
      unrated: await book(ids.food, 3000, `${monthOf(1)}-08`, 'Left Out', UNRATED),
      private: await book(ids.food, 6400, `${monthOf(0)}-01`, 'Example Jeweller'),
      untagged: await book(ids.food, 12800, `${monthOf(1)}-09`, 'Example Cafe'),
    };
    for (const [key, row] of Object.entries(excluded)) {
      if (key !== 'untagged') {
        await tagRow(row.id, [ids.trip]);
      }
    }
    await dataSource.query('UPDATE transactions SET is_duplicate = true WHERE id = $1', [
      excluded.duplicate.id,
    ]);
    await dataSource.query(
      'UPDATE transactions SET transfer_pair_id = gen_random_uuid() WHERE id = $1',
      [excluded.transfer.id],
    );
    await dataSource.query('UPDATE transactions SET is_verified = false WHERE id = $1', [
      excluded.unconfirmed.id,
    ]);
    await dataSource.query('UPDATE statements SET deleted_at = now() WHERE id = $1', [
      excluded.trashed.statementId,
    ]);
    await dataSource.query("UPDATE statements SET status = 'processing' WHERE id = $1", [
      excluded.processing.statementId,
    ]);
    // Another member's private row: which tag it carries is what it hides.
    await dataSource.query(
      'UPDATE transactions SET is_private = true, owner_member_id = $2 WHERE id = $1',
      [excluded.private.id, partnerMemberId],
    );
  });

  afterAll(async () => {
    if (dataSource && owner) {
      await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('counts the tag over all time, and only what Reports counts', async () => {
    const body = await summary(ids.trip);
    expect(body.tag).toMatchObject({ id: ids.trip, name: 'Example Trip' });
    expect(body).toMatchObject({
      currency: 'USD',
      spent: 235,
      received: 15,
      net: -220,
      direction: 'expense',
      firstDate: `${monthOf(5)}-10`,
      lastDate: `${monthOf(1)}-08`,
    });
    expect(body.missingRates).toEqual([UNRATED]);
  });

  it('draws one bar a month over the tag’s own span, a quiet month as zero', async () => {
    const body = await summary(ids.trip);
    expect(body.months).toEqual([
      { month: monthOf(5), amount: 100 },
      { month: monthOf(4), amount: 0 },
      { month: monthOf(3), amount: 50 },
      { month: monthOf(2), amount: 0 },
      { month: monthOf(1), amount: 85 },
    ]);
  });

  it('breaks the spending down by category and payee', async () => {
    const body = await summary(ids.trip);
    expect(body.categories).toEqual([
      { id: ids.food, name: `Food ${stamp}`, amount: 110 },
      { id: ids.lodging, name: `Lodging ${stamp}`, amount: 125 },
    ].sort((a, b) => b.amount - a.amount));
    expect(body.topPayees.map((payee: { name: string }) => payee.name)).toEqual([
      'Example Cafe',
      'Example Hotel',
      'Example Hostel',
    ]);
    expect(body.topPayees[0]).toMatchObject({ amount: 110, count: 3 });
  });

  it('counts a row with two tags fully on each tag’s page, as Reports does', async () => {
    const work = await summary(ids.work);
    expect(work).toMatchObject({ spent: 60, received: 0, net: -60 });
    expect(work.months).toEqual([{ month: monthOf(1), amount: 60 }]);
    expect(await reportOf(ids.work, 'expense')).toBe(60);
  });

  it('agrees with Reports’ By tag for the same days and data, for either viewer', async () => {
    for (const account of [owner, partner]) {
      const body = await summary(ids.trip, account);
      expect(await reportOf(ids.trip, 'expense', '', account)).toBe(body.spent);
      expect(await reportOf(ids.trip, 'income', '', account)).toBe(body.received);
      for (const month of [monthOf(5), monthOf(3), monthOf(1)]) {
        const range = `&dateFrom=${month}-01&dateTo=${lastDay(month)}`;
        expect(await reportOf(ids.trip, 'expense', range, account)).toBe(
          body.months.find((entry: { month: string }) => entry.month === month).amount,
        );
      }
    }
  });

  it('counts another member’s private row only for its owner, as Reports does', async () => {
    const mine = await summary(ids.trip);
    const theirs = await summary(ids.trip, partner);
    expect(theirs.spent).toBe(mine.spent + 6400);
    expect(theirs.lastDate).toBe(`${monthOf(0)}-01`);
    expect(theirs.topPayees.map((payee: { name: string }) => payee.name)).toContain(
      'Example Jeweller',
    );
    expect(mine.topPayees.map((payee: { name: string }) => payee.name)).not.toContain(
      'Example Jeweller',
    );
  });

  it('keeps money back on a trip received, as Reports’ By tag does: it has no refund switch', async () => {
    // By tag has no refund switch: money back is income there, so it is received here.
    const body = await summary(ids.trip);
    expect(body.received).toBe(15);
    expect(body.categories.find((entry: { id: string }) => entry.id === ids.food).amount).toBe(110);
    expect(await reportOf(ids.trip, 'income')).toBe(15);
  });

  it('gives an unused tag zeros, no span and no bars', async () => {
    expect(await summary(ids.quiet)).toMatchObject({
      spent: 0,
      received: 0,
      net: 0,
      firstDate: null,
      lastDate: null,
      months: [],
      categories: [],
      topPayees: [],
      missingRates: [],
    });
  });

  it('answers 404 for another workspace’s tag', async () => {
    await as(other, request(server()).get(`/tags/${ids.trip}/summary`)).expect(404);
  });

  it('lists the tag’s rows, in the caller’s workspace only, without another member’s private one', async () => {
    const list = async (query: string, account = owner, workspaceId = owner.workspaceId) =>
      (
        await as(account, request(server()).get(`/transactions?${query}`), workspaceId).expect(
          200,
        )
      ).body;

    const all = await list(`tagId=${ids.trip}&limit=100`);
    const merchants = all.data.map((row: { counterpartyName: string }) => row.counterpartyName);
    expect(merchants).toContain('Example Hostel');
    expect(merchants).not.toContain('Example Jeweller');
    expect(all.data.some((row: { amount: string }) => Number(row.amount) === 12800)).toBe(false);

    const month = await list(
      `tagId=${ids.trip}&date_from=${monthOf(3)}-01&date_to=${lastDay(monthOf(3))}&limit=100`,
    );
    expect(month.total).toBe(2);

    const theirs = await list(`tagId=${ids.trip}&limit=100`, partner);
    expect(theirs.total).toBe(all.total + 1);

    expect((await list(`tagId=${ids.trip}`, other, other.workspaceId)).total).toBe(0);
  });
});

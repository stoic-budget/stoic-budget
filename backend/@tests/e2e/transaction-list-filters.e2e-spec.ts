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
 * The search filters of `GET /transactions`: text, amount, several categories,
 * tags, and the "missing" toggles, each on real rows, with another member's
 * private row and another workspace's ids in the mix.
 */
describe('Transaction list filters (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `txf-owner-${stamp}@example.com`,
    partner: `txf-partner-${stamp}@example.com`,
    other: `txf-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let other: E2eAccount;
  const merchants = {
    buds: 'ACME Store - Wireless Buds',
    bakery: 'Corner Bakery',
    sale: 'Sale 100% off',
    garden: 'Garden Centre',
    secret: 'ACME Store - Hidden Gift',
  };
  const payeeName = 'Buds Shop';
  const comment = 'birthday present for Member One';
  const ids: Record<keyof typeof merchants, string> = {
    buds: '',
    bakery: '',
    sale: '',
    garden: '',
    secret: '',
  };
  let categoryOne: string;
  let categoryTwo: string;
  let tagA: string;
  let tagB: string;
  let categoryB: string;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);

  async function book(
    account: E2eAccount,
    workspaceId: string,
    merchant: string,
    amount: string,
    categoryId: string,
  ): Promise<string> {
    const statement = await as(account, request(server()).post('/statements/manual-expense'), workspaceId)
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', '2026-06-14')
      .expect(201);
    const listed = await as(
      account,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
      workspaceId,
    ).expect(200);
    return listed.body.data[0].id;
  }

  /** The names of the rows `query` lists for `account`, sorted. */
  async function names(query: string, account: E2eAccount = owner): Promise<string[]> {
    const res = await as(account, request(server()).get(`/transactions?limit=100&${query}`)).expect(
      200,
    );
    return res.body.data
      .map((row: { id: string }) => {
        const key = (Object.keys(ids) as Array<keyof typeof ids>).find(name => ids[name] === row.id);
        return key ?? row.id;
      })
      .sort();
  }

  async function membershipId(userId: string): Promise<string> {
    const [row] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, userId],
    );
    return row.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');

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
    const partnerMemberId = await membershipId(partner.userId);

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    [categoryOne, categoryTwo] = categories.body.map((category: { id: string }) => category.id);

    ids.buds = await book(owner, owner.workspaceId, merchants.buds, '120', categoryOne);
    ids.bakery = await book(owner, owner.workspaceId, merchants.bakery, '30', categoryTwo);
    ids.sale = await book(owner, owner.workspaceId, merchants.sale, '45', categoryOne);
    ids.garden = await book(owner, owner.workspaceId, merchants.garden, '300', categoryOne);
    ids.secret = await book(owner, owner.workspaceId, merchants.secret, '80', categoryTwo);

    // The comment and the payee are searched too; the payee name appears nowhere else.
    await as(owner, request(server()).put(`/transactions/${ids.garden}`))
      .send({ comments: comment })
      .expect(200);
    await dataSource.query('UPDATE transactions SET payee_id = NULL WHERE workspace_id = $1', [
      owner.workspaceId,
    ]);
    const [payee] = await dataSource.query(
      'INSERT INTO payees (workspace_id, name) VALUES ($1, $2) RETURNING id',
      [owner.workspaceId, payeeName],
    );
    await dataSource.query('UPDATE transactions SET payee_id = $1 WHERE id = ANY($2)', [
      payee.id,
      [ids.buds, ids.sale],
    ]);

    // Garden waits for a category; Sale sits in the Uncategorized fallback.
    await dataSource.query(
      `INSERT INTO categories (workspace_id, name, type) VALUES ($1, 'Uncategorized', 'expense')
       ON CONFLICT DO NOTHING`,
      [owner.workspaceId],
    );
    const [fallback] = await dataSource.query(
      `SELECT id FROM categories WHERE workspace_id = $1 AND name = 'Uncategorized'
       AND parent_id IS NULL AND type = 'expense'`,
      [owner.workspaceId],
    );
    await dataSource.query('UPDATE transactions SET category_id = $1 WHERE id = $2', [
      fallback.id,
      ids.sale,
    ]);
    await dataSource.query('UPDATE transactions SET category_id = NULL WHERE id = $1', [
      ids.garden,
    ]);

    // The partner's private row: its text and its (missing) payee are theirs alone.
    await as(owner, request(server()).put(`/transactions/${ids.secret}`))
      .send({ ownerMemberId: partnerMemberId })
      .expect(200);
    await as(partner, request(server()).put(`/transactions/${ids.secret}`))
      .send({ isPrivate: true })
      .expect(200);

    // Buds carries the tag itself, Bakery through its statement.
    const tag = await as(owner, request(server()).post('/tags'))
      .send({ name: `Holiday ${stamp}` })
      .expect(201);
    tagA = tag.body.id;
    await as(owner, request(server()).put(`/transactions/${ids.buds}/tags`))
      .send({ tagIds: [tagA] })
      .expect(200);
    await dataSource.query(
      `INSERT INTO statement_tags (statement_id, tag_id)
       SELECT statement_id, $1 FROM transactions WHERE id = $2`,
      [tagA, ids.bakery],
    );

    // Another workspace with its own tag and category on its own row.
    const otherCategories = await as(
      other,
      request(server()).get('/categories?type=expense'),
      other.workspaceId,
    ).expect(200);
    categoryB = otherCategories.body[0].id;
    const otherRow = await book(other, other.workspaceId, merchants.buds, '120', categoryB);
    const otherTag = await as(other, request(server()).post('/tags'), other.workspaceId)
      .send({ name: `Holiday ${stamp}` })
      .expect(201);
    tagB = otherTag.body.id;
    await as(other, request(server()).put(`/transactions/${otherRow}/tags`), other.workspaceId)
      .send({ tagIds: [tagB] })
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('DELETE FROM payees WHERE workspace_id = $1', [owner.workspaceId]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app?.close();
  });

  it('lists every row without filters', async () => {
    expect(await names('')).toEqual(['bakery', 'buds', 'garden', 'sale', 'secret']);
  });

  it('finds text in the counterparty, any case, but not in another member’s private row', async () => {
    expect(await names('q=acme%20store')).toEqual(['buds']);
    expect(await names('q=acme%20store', partner)).toEqual(['buds', 'secret']);
  });

  it('finds text in the payee name and the comment', async () => {
    expect(await names(`q=${encodeURIComponent(payeeName.toLowerCase())}`)).toEqual([
      'buds',
      'sale',
    ]);
    expect(await names('q=BIRTHDAY')).toEqual(['garden']);
  });

  it('takes LIKE wildcards in the text literally', async () => {
    expect(await names(`q=${encodeURIComponent('100%')}`)).toEqual(['sale']);
    expect(await names(`q=${encodeURIComponent('%')}`)).toEqual(['sale']);
    expect(await names(`q=${encodeURIComponent('_')}`)).toEqual([]);
  });

  it('bounds the absolute amount, both ends inclusive', async () => {
    expect(await names('amountMin=45&amountMax=120')).toEqual(['buds', 'sale', 'secret']);
    expect(await names('amountMin=300')).toEqual(['garden']);
    expect(await names('amountMax=30')).toEqual(['bakery']);
  });

  it('narrows to any of several categories, alongside the single one', async () => {
    // The private row moved into the Private category, for everybody.
    expect(await names(`categoryIds=${categoryOne},${categoryTwo}`)).toEqual(['bakery', 'buds']);
    expect(await names(`categoryIds=${categoryTwo}&categoryId=${categoryTwo}`)).toEqual([
      'bakery',
    ]);
    expect(await names(`categoryIds=${categoryTwo}&categoryId=${categoryOne}`)).toEqual([]);
  });

  it('counts rows without a category and in the Uncategorized fallback as uncategorized', async () => {
    expect(await names('uncategorized=true')).toEqual(['garden', 'sale']);
  });

  it('narrows to rows carrying a tag, their own or their statement’s', async () => {
    expect(await names(`tagIds=${tagA}`)).toEqual(['bakery', 'buds']);
    expect(await names(`tagIds=${tagA}&tagIds=${tagA}`)).toEqual(['bakery', 'buds']);
    expect(await names('untagged=true')).toEqual(['garden', 'sale', 'secret']);
  });

  it('keeps readable rows without a payee', async () => {
    expect(await names('noPayee=true')).toEqual(['bakery', 'garden']);
    expect(await names('noPayee=true', partner)).toEqual(['bakery', 'garden', 'secret']);
  });

  it('combines the filters, each one narrowing', async () => {
    expect(await names(`q=a&amountMin=40&categoryIds=${categoryOne}&tagIds=${tagA}`)).toEqual([
      'buds',
    ]);
    expect(await names('uncategorized=true&noPayee=true')).toEqual(['garden']);
  });

  it('finds nothing by another workspace’s tags or categories', async () => {
    expect(await names(`tagIds=${tagB}`)).toEqual([]);
    expect(await names(`categoryIds=${categoryB}`)).toEqual([]);
    expect(await names(`tagIds=${tagA},${tagB}`)).toEqual(['bakery', 'buds']);
    const res = await as(
      other,
      request(server()).get(`/transactions?tagIds=${tagA}&categoryIds=${categoryOne}`),
      other.workspaceId,
    ).expect(200);
    expect(res.body.data).toEqual([]);
  });

  it('refuses malformed filters with a 400', async () => {
    for (const query of ['tagIds=not-a-uuid', 'amountMin=-5', 'noPayee=maybe']) {
      await as(owner, request(server()).get(`/transactions?${query}`)).expect(400);
    }
  });
});

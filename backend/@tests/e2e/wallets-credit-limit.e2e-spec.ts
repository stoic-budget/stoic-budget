vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Wallet } from '../../src/entities/wallet.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A credit card's limit: set, changed and cleared on the card, refused on any
 * other kind of account, cleared when the card becomes another kind, out of
 * reach from another workspace, and never part of a balance or a total.
 */
describe('Account credit limit (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `credit-limit-owner-${stamp}@example.com`,
    other: `credit-limit-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;

  const limit = 5000;
  const owed = 1200;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const stored = async (id: string) =>
    (await dataSource.getRepository(Wallet).findOneByOrFail({ id })).creditLimit;

  async function createCard(account: E2eAccount, body: Record<string, unknown> = {}) {
    const created = await as(
      account,
      request(server())
        .post('/wallets')
        .send({ name: 'ACME Card', type: 'credit_card', initialBalance: -owed, ...body }),
    ).expect(201);
    return created.body as Record<string, any>;
  }

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
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('sets a limit on a card, answers it on every read, and changes or clears it', async () => {
    const card = await createCard(owner, { creditLimit: limit });
    expect(card).toMatchObject({ creditLimit: '5000.00', balance: -owed });

    const listed = (await as(owner, request(server()).get('/wallets')).expect(200)).body;
    expect(listed.find((row: { id: string }) => row.id === card.id).creditLimit).toBe('5000.00');

    const changed = await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 7500.5 }),
    ).expect(200);
    expect(changed.body.creditLimit).toBe('7500.50');
    expect(changed.body.updatedAt > card.updatedAt).toBe(true);

    // A large limit with cents is taken as written.
    const large = await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 149257142.61 }),
    ).expect(200);
    expect(large.body.creditLimit).toBe('149257142.61');
    await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 7500.5 }),
    ).expect(200);

    // A write that does not name the limit leaves it.
    await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ name: 'ACME Card Gold' }),
    ).expect(200);
    expect(await stored(card.id)).toBe('7500.50');

    const cleared = await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: null }),
    ).expect(200);
    expect(cleared.body.creditLimit).toBeNull();
    expect(await stored(card.id)).toBeNull();
  });

  it('starts a card without a limit when none is given', async () => {
    const card = await createCard(owner);
    expect(card.creditLimit).toBeNull();
  });

  it.each([
    ['zero', 0],
    ['below zero', -100],
    ['more than two decimals', 100.123],
    ['beyond what the column holds', 10_000_000_000_000],
    ['a string', '5000'],
  ])('refuses a limit that is %s', async (_, creditLimit) => {
    const response = await as(
      owner,
      request(server())
        .post('/wallets')
        .send({ name: 'ACME Card', type: 'credit_card', creditLimit }),
    ).expect(400);
    expect(response.body.error.code).toBe('REQUEST_INVALID');

    const card = await createCard(owner, { creditLimit: limit });
    await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit }),
    ).expect(400);
    expect(await stored(card.id)).toBe('5000.00');
  });

  it('refuses a limit on an account that is not a credit card', async () => {
    const refused = await as(
      owner,
      request(server())
        .post('/wallets')
        .send({ name: 'Everyday', type: 'checking', creditLimit: limit }),
    ).expect(400);
    expect(refused.body.error.code).toBe('WALLET_CREDIT_LIMIT_CARD_ONLY');

    // Created without a type: a checking account, so refused as well.
    await as(
      owner,
      request(server()).post('/wallets').send({ name: 'Everyday', creditLimit: limit }),
    ).expect(400);

    const loan = await as(
      owner,
      request(server()).post('/wallets').send({ name: 'Car loan', type: 'loan' }),
    ).expect(201);
    const onUpdate = await as(
      owner,
      request(server()).put(`/wallets/${loan.body.id}`).send({ creditLimit: limit }),
    ).expect(400);
    expect(onUpdate.body.error.code).toBe('WALLET_CREDIT_LIMIT_CARD_ONLY');
    expect(await stored(loan.body.id)).toBeNull();

    // Clearing is always fine: a form sends null for a type without a limit.
    await as(
      owner,
      request(server())
        .post('/wallets')
        .send({ name: 'Everyday', type: 'checking', creditLimit: null }),
    ).expect(201);
  });

  it('clears the limit when a card becomes another kind of account', async () => {
    const card = await createCard(owner, { creditLimit: limit });
    const moved = await as(
      owner,
      request(server()).put(`/wallets/${card.id}`).send({ type: 'checking' }),
    ).expect(200);
    expect(moved.body).toMatchObject({ type: 'checking', creditLimit: null });
    expect(await stored(card.id)).toBeNull();

    // Moving and naming a limit in one write is still refused.
    const again = await createCard(owner, { creditLimit: limit });
    await as(
      owner,
      request(server()).put(`/wallets/${again.id}`).send({ type: 'loan', creditLimit: limit }),
    ).expect(400);
    expect(await stored(again.id)).toBe('5000.00');

    // Turning an account into a card and giving it a limit in one write works.
    const turned = await as(
      owner,
      request(server())
        .put(`/wallets/${card.id}`)
        .send({ type: 'credit_card', creditLimit: 900 }),
    ).expect(200);
    expect(turned.body.creditLimit).toBe('900.00');
  });

  it('never leaves a limit on a card switched to another type by a racing write', async () => {
    for (let round = 0; round < 12; round++) {
      const card = await createCard(owner, { creditLimit: limit });
      const [retyped, limited] = await Promise.all([
        as(owner, request(server()).put(`/wallets/${card.id}`).send({ type: 'checking' })),
        as(owner, request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 777 })),
      ]);
      // The type change always lands. The new limit either landed first (200) and
      // was then cleared by the type change, or came second and was refused.
      expect(retyped.status).toBe(200);
      expect(retyped.body).toMatchObject({ type: 'checking', creditLimit: null });
      // (Its answer is read after its write, so it may already show the type change.)
      if (limited.status !== 200) {
        expect(limited.status).toBe(400);
        expect(limited.body.error.code).toBe('WALLET_CREDIT_LIMIT_CARD_ONLY');
      }
      const row = await dataSource.getRepository(Wallet).findOneByOrFail({ id: card.id });
      expect({ type: row.type, creditLimit: row.creditLimit }).toEqual({
        type: 'checking',
        creditLimit: null,
      });
    }
  });

  it('makes a limit write wait for a type change in progress, then refuses it', async () => {
    const card = await createCard(owner, { creditLimit: limit });
    const holder = dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    try {
      // Another write holds the row while it turns the card into a current account.
      await holder.query('SELECT id FROM wallets WHERE id = $1 FOR UPDATE', [card.id]);
      let settled = false;
      const limited = as(
        owner,
        request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 777 }),
      ).then(response => {
        settled = true;
        return response;
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(settled).toBe(false);

      await holder.query(
        "UPDATE wallets SET type = 'checking', credit_limit = NULL WHERE id = $1",
        [card.id],
      );
      await holder.commitTransaction();

      const response = await limited;
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WALLET_CREDIT_LIMIT_CARD_ONLY');
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }
    const row = await dataSource.getRepository(Wallet).findOneByOrFail({ id: card.id });
    expect({ type: row.type, creditLimit: row.creditLimit }).toEqual({
      type: 'checking',
      creditLimit: null,
    });
  });

  it("never sets or reads another workspace's card", async () => {
    const card = await createCard(owner, { creditLimit: limit });

    await as(
      other,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: 1 }),
    ).expect(404);
    await as(
      other,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: null }),
    ).expect(404);
    await as(other, request(server()).get(`/wallets/${card.id}`)).expect(404);
    expect(await stored(card.id)).toBe('5000.00');

    const othersList = (await as(other, request(server()).get('/wallets')).expect(200)).body;
    expect(othersList.map((row: { id: string }) => row.id)).not.toContain(card.id);
  });

  it('counts only what is owed in the totals, never the limit', async () => {
    const card = await createCard(other);
    const summary = async () =>
      (await as(other, request(server()).get('/wallets/summary')).expect(200)).body;
    const netWorth = async () =>
      (await as(other, request(server()).get('/reports/net-worth')).expect(200)).body;
    const before = { summary: await summary(), netWorth: await netWorth() };

    await as(
      other,
      request(server()).put(`/wallets/${card.id}`).send({ creditLimit: limit }),
    ).expect(200);

    expect(await summary()).toEqual(before.summary);
    const after = await netWorth();
    expect(after.current).toBe(before.netWorth.current);
    expect(after.liabilitiesTotal).toBe(before.netWorth.liabilitiesTotal);
    const listed = (await as(other, request(server()).get(`/wallets/${card.id}`)).expect(200))
      .body;
    expect(listed.balance).toBe(-owed);
  });
});

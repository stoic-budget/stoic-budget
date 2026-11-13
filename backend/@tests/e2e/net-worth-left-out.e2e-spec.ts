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
  TransferPairKind,
} from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Node = { code: string; id: string; amount: number; children?: Node[] };

/**
 * An account set not to count in net worth (money held for someone else, a
 * child's account) leaves every net worth figure, over its whole history,
 * and nothing else: the balance sheet and the account itself keep it.
 */
describe('Accounts left out of net worth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `net-worth-left-out-owner-${stamp}@example.com`,
    stranger: `net-worth-left-out-stranger-${stamp}@example.com`,
    floatOwner: `net-worth-left-out-float-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let stranger: E2eAccount;
  let floatOwner: E2eAccount;
  const ids = { everyday: '', held: '', loan: '' };

  const EVERYDAY = 1000;
  const HELD_OPENING = 500;
  const HELD_INCOME = 200;
  const LOAN_OWED = 300;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const daysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const netWorth = async (query = 'range=90d') =>
    (await as(owner, request(server()).get(`/reports/net-worth?${query}`)).expect(200)).body;
  const pointOn = (body: { series: Array<{ date: string; value: number }> }, date: string) =>
    body.series.find(point => point.date === date)?.value;
  const setCounted = (account: E2eAccount, id: string, includeInNetWorth: boolean) =>
    as(account, request(server()).put(`/wallets/${id}`)).send({ includeInNetWorth });

  async function createWallet(account: E2eAccount, body: Record<string, unknown>): Promise<string> {
    const res = await as(account, request(server()).post('/wallets'))
      .send({ currency: 'KZT', ...body })
      .expect(201);
    return res.body.id;
  }

  /** A confirmed row; with `pair`, one leg of a transfer between the person's own accounts. */
  async function bookRow(
    account: E2eAccount,
    row: { walletId: string; date: string; credit?: number; debit?: number; pair?: string },
  ): Promise<void> {
    const transactions = dataSource.getRepository(Transaction);
    await transactions.save(
      transactions.create({
        workspaceId: account.workspaceId,
        userId: account.userId,
        walletId: row.walletId,
        transactionDate: new Date(row.date),
        paymentPurpose: row.pair ? 'Between my own accounts' : 'Payment from ACME Store',
        counterpartyName: row.pair ? 'Own account' : 'ACME Store',
        currency: 'KZT',
        credit: row.credit ?? null,
        debit: row.debit ?? null,
        amount: row.credit ?? row.debit ?? 0,
        transactionType: row.debit ? TransactionType.EXPENSE : TransactionType.INCOME,
        transferPairId: row.pair ?? null,
        transferPairKind: row.pair ? TransferPairKind.TRANSFER : null,
        isVerified: true,
      }),
    );
  }

  async function bookTransfer(
    account: E2eAccount,
    move: { from: string; to: string; date: string; amount: number },
  ): Promise<string> {
    const pair = randomUUID();
    await bookRow(account, { walletId: move.from, date: move.date, debit: move.amount, pair });
    await bookRow(account, { walletId: move.to, date: move.date, credit: move.amount, pair });
    return pair;
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
    stranger = await registerAccount(app, emails.stranger, 'Member Two');
    floatOwner = await registerAccount(app, emails.floatOwner, 'Member Three');
    for (const account of [owner, floatOwner]) {
      await as(account, request(server()).patch(`/workspaces/${account.workspaceId}`))
        .send({ currency: 'KZT' })
        .expect(200);
    }

    ids.everyday = await createWallet(owner, { name: 'Everyday', initialBalance: EVERYDAY });
    ids.held = await createWallet(owner, {
      name: 'Held for a friend',
      type: 'savings',
      initialBalance: HELD_OPENING,
    });
    ids.loan = await createWallet(owner, {
      name: 'Car loan',
      type: 'loan',
      initialBalance: -LOAN_OWED,
    });

    // Money that arrived on the held account twenty days ago.
    await bookRow(owner, { walletId: ids.held, date: daysAgo(20), credit: HELD_INCOME });
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, emails.owner);
      await deleteUserByEmail(dataSource, emails.stranger);
      await deleteUserByEmail(dataSource, emails.floatOwner);
    }
    await app.close();
  });

  // Every test starts from all three accounts counted and sets what it needs.
  beforeEach(async () => {
    for (const id of Object.values(ids)) {
      await setCounted(owner, id, true).expect(200);
    }
  });

  it('counts every account by default', async () => {
    const body = await netWorth();

    expect(body.current).toBe(EVERYDAY + HELD_OPENING + HELD_INCOME - LOAN_OWED);
    expect(pointOn(body, daysAgo(60))).toBe(EVERYDAY + HELD_OPENING - LOAN_OWED);
    expect(body.accountsLeftOut).toBe(0);
    expect(body.savings.income).toBe(HELD_INCOME);
  });

  it('a new account counts by default and the list says so', async () => {
    const list = await as(owner, request(server()).get('/wallets')).expect(200);
    const flags = Object.fromEntries(
      list.body.map((wallet: { id: string; includeInNetWorth: boolean }) => [
        wallet.id,
        wallet.includeInNetWorth,
      ]),
    );
    expect(flags).toEqual({ [ids.everyday]: true, [ids.held]: true, [ids.loan]: true });
  });

  it('refuses to switch an account of another workspace, and leaves it as it was', async () => {
    await setCounted(owner, ids.held, false).expect(200);

    await setCounted(stranger, ids.held, true).expect(404);

    const held = await as(owner, request(server()).get(`/wallets/${ids.held}`)).expect(200);
    expect(held.body.includeInNetWorth).toBe(false);
    expect((await netWorth()).accountsLeftOut).toBe(1);
  });

  it('drops a switched-off account from every figure and its whole history', async () => {
    const saved = await setCounted(owner, ids.held, false).expect(200);
    expect(saved.body.includeInNetWorth).toBe(false);

    const body = await netWorth();
    const counted = EVERYDAY - LOAN_OWED;
    expect(body.current).toBe(counted);
    expect(body.assetsTotal).toBe(EVERYDAY);
    // Not only from today: the curve before the switch follows it too, so nothing jumps.
    expect(pointOn(body, daysAgo(60))).toBe(counted);
    expect(body.series[0].value).toBe(counted);
    expect(body.change).toBe(0);
    expect(body.groups.find((group: { key: string }) => group.key === 'cash')?.amount).toBe(
      EVERYDAY,
    );
    expect(body.accountsLeftOut).toBe(1);
    // What arrived on the held account is not the household's income.
    expect(body.savings.income).toBe(0);
  });

  it('leaves a switched-off debt out of the liabilities', async () => {
    await setCounted(owner, ids.loan, false).expect(200);

    const body = await netWorth();
    expect(body.liabilitiesTotal).toBe(0);
    expect(body.current).toBe(EVERYDAY + HELD_OPENING + HELD_INCOME);
    expect(body.accountsLeftOut).toBe(1);
  });

  it('keeps the page filter working on top of the setting', async () => {
    await setCounted(owner, ids.held, false).expect(200);
    const sheet = await as(owner, request(server()).get('/reports/balance/accounts')).expect(200);
    const cashLineId = findAccountId(sheet.body.assets, 'ASSET_CASH');

    const body = await netWorth(`range=90d&exclude=${cashLineId}`);
    expect(body.current).toBe(-LOAN_OWED);
    expect(body.excluded).toEqual([cashLineId]);
    expect(body.accountsLeftOut).toBe(1);
  });

  it('keeps the account everywhere else: its own balance and the balance sheet', async () => {
    await setCounted(owner, ids.held, false).expect(200);

    const held = await as(owner, request(server()).get(`/wallets/${ids.held}`)).expect(200);
    expect(held.body.balance).toBe(HELD_OPENING + HELD_INCOME);

    const sheet = await as(owner, request(server()).get('/reports/balance/sheet')).expect(200);
    const cash = findNode(sheet.body.assets.sections, 'ASSET_CASH');
    expect(cash?.amount).toBe(EVERYDAY + HELD_OPENING + HELD_INCOME);
  });

  it('counts the account again, history and all, once switched back on', async () => {
    await setCounted(owner, ids.held, false).expect(200);
    await setCounted(owner, ids.held, true).expect(200);

    const body = await netWorth();
    expect(body.current).toBe(EVERYDAY + HELD_OPENING + HELD_INCOME - LOAN_OWED);
    expect(pointOn(body, daysAgo(60))).toBe(EVERYDAY + HELD_OPENING - LOAN_OWED);
    expect(body.accountsLeftOut).toBe(0);
  });

  it('creates an account already left out when asked', async () => {
    const id = await createWallet(owner, { name: 'Business float', includeInNetWorth: false });
    try {
      const created = await as(owner, request(server()).get(`/wallets/${id}`)).expect(200);
      expect(created.body.includeInNetWorth).toBe(false);
      expect((await netWorth()).accountsLeftOut).toBe(1);
    } finally {
      await as(owner, request(server()).delete(`/wallets/${id}`)).expect(200);
    }
  });

  describe('savings rate with a business float left out', () => {
    let float = '';
    let everyday = '';
    const FLOAT_IN = 1000;
    const MOVED_ON = 600;
    const SIDE_INCOME = 400;
    const savings = async () =>
      (await as(floatOwner, request(server()).get('/reports/net-worth?range=90d')).expect(200))
        .body;

    beforeAll(async () => {
      everyday = await createWallet(floatOwner, { name: 'Everyday', initialBalance: 0 });
      float = await createWallet(floatOwner, { name: 'Business float', includeInNetWorth: false });
      // Paid into the float, part of it moved on to the counted account, plus income of its own.
      await bookRow(floatOwner, { walletId: float, date: daysAgo(20), credit: FLOAT_IN });
      await bookTransfer(floatOwner, { from: float, to: everyday, date: daysAgo(15), amount: MOVED_ON });
      await bookRow(floatOwner, { walletId: everyday, date: daysAgo(10), credit: SIDE_INCOME });
    });

    it('counts money moved in from the float as income, so the rate cannot pass 100%', async () => {
      const body = await savings();

      expect(body.savings.kept).toBe(MOVED_ON + SIDE_INCOME);
      expect(body.savings.income).toBe(MOVED_ON + SIDE_INCOME);
      expect(body.savings.rate).toBe(100);
    });

    it('reads money moved out to the float as less kept, not as less income', async () => {
      const back = 300;
      const pairId = await bookTransfer(floatOwner, {
        from: everyday,
        to: float,
        date: daysAgo(5),
        amount: back,
      });
      try {
        const body = await savings();
        expect(body.savings.income).toBe(MOVED_ON + SIDE_INCOME);
        expect(body.savings.kept).toBe(MOVED_ON + SIDE_INCOME - back);
        expect(body.savings.rate).toBe(70);
      } finally {
        await dataSource.getRepository(Transaction).delete({ transferPairId: pairId });
      }
    });
  });
});

function findNode(nodes: Node[], code: string): Node | null {
  for (const node of nodes) {
    if (node.code === code) return node;
    const found = node.children ? findNode(node.children, code) : null;
    if (found) return found;
  }
  return null;
}

function findAccountId(nodes: Node[], code: string): string {
  return findNode(nodes, code)?.id ?? '';
}

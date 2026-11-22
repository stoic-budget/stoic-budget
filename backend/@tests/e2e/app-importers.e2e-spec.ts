import { readFileSync } from 'node:fs';
import * as path from 'node:path';
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

const FIXTURES = path.join(__dirname, '../fixtures/app-exports');
const file = (name: string) => ({ name, data: readFileSync(path.join(FIXTURES, name)) });
const text = (name: string, body: string) => ({ name, data: Buffer.from(body) });
type Upload = ReturnType<typeof file>;

/**
 * Exports of other budgeting apps read in one go: a dry run counts per kind
 * of record, the commit books one undoable batch, transfers land as one pair,
 * splits as splits, the plan as budgets, and the same files again add nothing.
 */
describe('Import from another app (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `app-import-owner-${stamp}@example.com`,
    viewer: `app-import-viewer-${stamp}@example.com`,
    other: `app-import-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let viewer: E2eAccount;
  let other: E2eAccount;

  const server = () => app.getHttpServer();
  const send = (
    account: E2eAccount,
    uploads: Upload[],
    fields: Record<string, string> = {},
    workspaceId = account.workspaceId,
  ) => {
    let req = request(server())
      .post('/entity-imports/apps')
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', workspaceId)
      .field('currency', 'USD');
    for (const [key, value] of Object.entries(fields)) {
      req = req.field(key, value);
    }
    for (const upload of uploads) {
      req = req.attach('files', upload.data, upload.name);
    }
    return req;
  };
  const undo = (account: E2eAccount, batchId: string) =>
    request(server())
      .delete(`/entity-imports/${batchId}`)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', account.workspaceId);
  const q = <T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> =>
    dataSource.query(sql, params);
  const count = async (table: string, workspaceId: string) =>
    Number((await q<{ n: string }>(`SELECT count(*) AS n FROM ${table} WHERE workspace_id = $1`, [workspaceId]))[0].n);
  const snapshot = async (workspaceId: string) => ({
    wallets: await count('wallets', workspaceId),
    transactions: await count('transactions', workspaceId),
    statements: await count('statements', workspaceId),
    categories: await count('categories', workspaceId),
    payees: await count('payees', workspaceId),
    budgets: await count('budgets', workspaceId),
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Member One');
    viewer = await registerAccount(app, emails.viewer, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    const invite = await request(server())
      .post(`/workspaces/${owner.workspaceId}/invitations`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send({ email: viewer.email, role: 'viewer' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('YNAB register and plan', () => {
    const files = [file('ynab-register.csv'), file('ynab-plan.csv')];
    let batchId = '';
    let groceriesBudgetId = '';

    it('previews per kind of record and writes nothing', async () => {
      // A budget the plan will raise, to see undo put it back.
      const [groceries] = await q<{ id: string }>(
        `SELECT id FROM categories WHERE workspace_id = $1 AND lower(name) = 'groceries' AND parent_id IS NULL`,
        [owner.workspaceId],
      );
      const budget = await request(server())
        .post('/budgets')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send({ name: 'Groceries', categoryId: groceries.id, limitAmount: 100, currency: 'USD', periodType: 'monthly' })
        .expect(201);
      groceriesBudgetId = budget.body.id;
      const before = await snapshot(owner.workspaceId);

      const res = await send(owner, files, { dryRun: 'true' }).expect(201);
      expect(res.body.batchId).toBeNull();
      expect(res.body.files.map((item: { app: string; kind: string }) => [item.app, item.kind])).toEqual([
        ['ynab', 'register'],
        ['ynab', 'plan'],
      ]);
      expect(
        res.body.accounts.map((item: { name: string; status: string; opening: number }) => [item.name, item.status, item.opening]),
      ).toEqual([
        ['Checking', 'created', 1000],
        ['Savings', 'created', 500],
        ['Brokerage', 'created', 0],
        ['Visa Card', 'created', 0],
      ]);
      // 13 rows without the openings: 10 ordinary/split rows and 3 transfers of two legs, one written.
      expect(res.body.transactions).toMatchObject({ created: 13, skipped: 0, errors: 0, transfers: 3, splits: 1 });
      expect(res.body.budgets).toEqual({ month: '2026-10', created: 1, updated: 1, skipped: 1 });
      expect(res.body.categories.items).toEqual(
        expect.arrayContaining([
          { group: 'Everyday', name: 'Groceries', status: 'matched' },
          { group: 'Home', name: 'Household', status: 'created' },
          { group: 'Fun', name: 'Books', status: 'created' },
        ]),
      );
      expect(res.body.payees.created).toBeGreaterThan(0);
      expect(await snapshot(owner.workspaceId)).toEqual(before);
    });

    it('books one batch: accounts, groups, splits, one pair per transfer, budgets', async () => {
      const res = await send(owner, files, { categorize: 'false' }).expect(201);
      batchId = res.body.batchId;
      expect(batchId).toBeTruthy();
      expect(res.body.transactions.created).toBe(13);

      const wallets = await q<{ name: string; initial_balance: string; currency: string }>(
        'SELECT name, initial_balance, currency FROM wallets WHERE workspace_id = $1 ORDER BY name',
        [owner.workspaceId],
      );
      expect(wallets.map(row => [row.name, Number(row.initial_balance), row.currency])).toEqual([
        ['Brokerage', 0, 'USD'],
        ['Checking', 1000, 'USD'],
        ['Savings', 500, 'USD'],
        ['Visa Card', 0, 'USD'],
      ]);
      const pairs = await q<{ legs: string; types: string }>(
        `SELECT count(*) AS legs, string_agg(transaction_type::text, ',' ORDER BY transaction_type::text) AS types
           FROM transactions WHERE workspace_id = $1 AND transfer_pair_id IS NOT NULL
          GROUP BY transfer_pair_id`,
        [owner.workspaceId],
      );
      expect(pairs).toHaveLength(3);
      expect(pairs.every(pair => Number(pair.legs) === 2)).toBe(true);
      expect(pairs.every(pair => `${pair.types}` === 'expense,income')).toBe(true);

      const split = await q<{ amount: string; split_index: number; category: string }>(
        `SELECT t.amount, t.split_index, c.name AS category FROM transactions t
           JOIN categories c ON c.id = t.category_id
          WHERE t.workspace_id = $1 AND t.split_group_id IS NOT NULL ORDER BY t.split_index`,
        [owner.workspaceId],
      );
      expect(split.map(row => [Number(row.amount), row.split_index, row.category])).toEqual([
        [30, 0, 'Groceries'],
        [12.25, 1, 'Household'],
      ]);
      const [household] = await q<{ parent: string }>(
        `SELECT p.name AS parent FROM categories c JOIN categories p ON p.id = c.parent_id
          WHERE c.workspace_id = $1 AND c.name = 'Household'`,
        [owner.workspaceId],
      );
      expect(household.parent).toBe('Home');

      const coffees = await q('SELECT id FROM transactions WHERE workspace_id = $1 AND counterparty_name = $2', [
        owner.workspaceId,
        'Bean Cafe',
      ]);
      expect(coffees).toHaveLength(2);
      const budgets = await q<{ id: string; limit_amount: string }>(
        `SELECT b.id, b.limit_amount FROM budgets b JOIN categories c ON c.id = b.category_id
          WHERE b.workspace_id = $1 ORDER BY c.name`,
        [owner.workspaceId],
      );
      expect(budgets.map(row => Number(row.limit_amount)).sort((a, b) => a - b)).toEqual([320, 1200]);
      expect(budgets.find(row => row.id === groceriesBudgetId)?.limit_amount).toBe('320.00');
    });

    it('reading the same files again adds nothing', async () => {
      const before = await snapshot(owner.workspaceId);
      const preview = await send(owner, files, { dryRun: 'true' }).expect(201);
      expect(preview.body.transactions).toMatchObject({ created: 0, skipped: 13 });
      expect(preview.body.accounts.every((item: { status: string }) => item.status === 'matched')).toBe(true);
      expect(preview.body.budgets).toMatchObject({ created: 0, updated: 0 });
      const res = await send(owner, files).expect(400);
      expect(res.body.error?.code ?? res.body.code).toBe('IMPORT_NO_VALID_ROWS');
      expect(await snapshot(owner.workspaceId)).toEqual(before);
    });

    it('undo removes the batch and keeps what was used since', async () => {
      const [savings] = await q<{ id: string }>(
        `SELECT id FROM wallets WHERE workspace_id = $1 AND name = 'Savings'`,
        [owner.workspaceId],
      );
      const [books] = await q<{ id: string }>(
        `SELECT id FROM categories WHERE workspace_id = $1 AND name = 'Books'`,
        [owner.workspaceId],
      );
      // A row booked by hand after the import, on an imported account and category.
      await request(server())
        .post('/statements/manual-expense')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .field('amount', '7.00')
        .field('currency', 'USD')
        .field('merchant', 'Example Kiosk')
        .field('walletId', savings.id)
        .field('categoryId', books.id)
        .field('date', '2026-02-01')
        .expect(201);

      const res = await undo(owner, batchId).expect(200);
      expect(res.body).toMatchObject({ undone: true, restored: 1 });
      const left = await q<{ name: string }>('SELECT name FROM wallets WHERE workspace_id = $1', [owner.workspaceId]);
      expect(left.map(row => row.name)).toEqual(['Savings']);
      expect(
        await q('SELECT id FROM transactions WHERE workspace_id = $1 AND fingerprint IS NOT NULL AND counterparty_name = $2', [
          owner.workspaceId,
          'Bean Cafe',
        ]),
      ).toHaveLength(0);
      const categories = await q<{ name: string }>(
        `SELECT name FROM categories WHERE workspace_id = $1 AND name IN ('Household', 'Books', 'Home', 'Fun') ORDER BY name`,
        [owner.workspaceId],
      );
      // Books holds the new row, and Fun holds Books.
      expect(categories.map(row => row.name)).toEqual(['Books', 'Fun']);
      expect(await q('SELECT id FROM payees WHERE workspace_id = $1 AND name = $2', [owner.workspaceId, 'Bean Cafe'])).toHaveLength(0);
      const [budget] = await q<{ limit_amount: string }>('SELECT limit_amount FROM budgets WHERE id = $1', [groceriesBudgetId]);
      expect(budget.limit_amount).toBe('100.00');
      expect(await count('budgets', owner.workspaceId)).toBe(1);
    });
  });

  describe('Actual Budget', () => {
    it('pairs the two legs, keeps the split, and undoes', async () => {
      const res = await send(owner, [file('actual-export.csv')], { categorize: 'false' }).expect(201);
      expect(res.body.files[0]).toMatchObject({ app: 'actual', kind: 'register' });
      expect(res.body.transactions).toMatchObject({ created: 7, transfers: 1, splits: 1 });
      const legs = await q<{ name: string; type: string }>(
        `SELECT w.name, t.transaction_type AS type FROM transactions t JOIN wallets w ON w.id = t.wallet_id
          WHERE t.workspace_id = $1 AND t.transfer_pair_id IS NOT NULL ORDER BY w.name`,
        [owner.workspaceId],
      );
      expect(legs).toEqual([
        { name: 'Everyday Account', type: 'expense' },
        { name: 'Rainy Day', type: 'income' },
      ]);
      const [everyday] = await q<{ initial_balance: string }>(
        `SELECT initial_balance FROM wallets WHERE workspace_id = $1 AND name = 'Everyday Account'`,
        [owner.workspaceId],
      );
      expect(Number(everyday.initial_balance)).toBe(800);
      await send(owner, [file('actual-export.csv')]).expect(400);
      await undo(owner, res.body.batchId).expect(200);
      expect(
        await q(`SELECT id FROM wallets WHERE workspace_id = $1 AND name IN ('Everyday Account', 'Rainy Day')`, [
          owner.workspaceId,
        ]),
      ).toHaveLength(0);
    });

    it('a second account exported on its own does not book its transfer leg twice', async () => {
      const header = 'Account,Date,Payee,Notes,Category_Group,Category,Amount,Split_Amount,Cleared';
      const first = await send(owner, [
        text('everyday.csv', `${header}\nDaily,2026-04-02,Reserve,Top up,,,-75,0,Cleared\nDaily,2026-04-03,Corner Market,,Food,Food,-5,0,Cleared\n`),
        text('reserve.csv', `${header}\nReserve,2026-04-01,Starting Balance,,,,10,0,Cleared\n`),
      ], { categorize: 'false' }).expect(201);
      expect(first.body.transactions).toMatchObject({ created: 3, transfers: 1 });
      // The reserve account's own export later brings the other leg.
      const second = await send(owner, [
        text('reserve-2.csv', `${header}\nReserve,2026-04-02,Daily,Top up,,,75,0,Cleared\n`),
      ], { dryRun: 'true' }).expect(201);
      // Both legs are already there: the one booked then and the one written for it.
      expect(second.body.transactions).toMatchObject({ created: 0, skipped: 2 });
      await undo(owner, first.body.batchId).expect(200);
    });

    describe('accounts exported one by one and read in separate imports', () => {
      const header = 'Account,Date,Payee,Notes,Category_Group,Category,Amount,Split_Amount,Cleared';
      const spending = text('spending.csv', `${header}\nSpending,2026-05-02,Buffer,Top up,,,-75,0,Cleared\n`);
      const buffer = text('buffer.csv', `${header}\nBuffer,2026-05-02,Spending,Top up,,,75,0,Cleared\n`);
      const legs = () =>
        q<{ name: string; type: string; amount: string; pair: string | null }>(
          `SELECT w.name, t.transaction_type AS type, t.amount, t.transfer_pair_id AS pair
             FROM transactions t JOIN wallets w ON w.id = t.wallet_id
            WHERE t.workspace_id = $1 AND w.name IN ('Spending', 'Buffer') ORDER BY w.name`,
          [owner.workspaceId],
        );

      it('books the transfer once: the row read before becomes its leg', async () => {
        // Buffer is no account yet: the row is an ordinary expense paid to "Buffer".
        const first = await send(owner, [spending], { categorize: 'false' }).expect(201);
        expect(first.body.transactions).toMatchObject({ created: 1, transfers: 0 });
        const preview = await send(owner, [buffer], { dryRun: 'true' }).expect(201);
        expect(preview.body.transactions).toMatchObject({ created: 1, linked: 1, transfers: 1 });
        expect(preview.body.accounts).toEqual([
          expect.objectContaining({ name: 'Buffer', status: 'created', transactions: 1 }),
          expect.objectContaining({ name: 'Spending', status: 'matched', transactions: 0 }),
        ]);
        const second = await send(owner, [buffer], { categorize: 'false' }).expect(201);
        const booked = await legs();
        expect(booked.map(row => [row.name, row.type, Number(row.amount)])).toEqual([
          ['Buffer', 'income', 75],
          ['Spending', 'expense', 75],
        ]);
        expect(booked[0].pair).toBeTruthy();
        expect(booked[0].pair).toBe(booked[1].pair);

        // Either file again, or both, adds nothing.
        for (const files of [[spending], [buffer], [spending, buffer]]) {
          const again = await send(owner, files, { dryRun: 'true' }).expect(201);
          expect(again.body.transactions).toMatchObject({ created: 0, linked: 0 });
        }

        // Undo puts the row read first back as it was.
        await undo(owner, second.body.batchId).expect(200);
        expect((await legs()).map(row => [row.name, row.type, row.pair])).toEqual([['Spending', 'expense', null]]);

        // Undoing the first import while the second still uses its row leaves no half pair.
        const third = await send(owner, [buffer], { categorize: 'false' }).expect(201);
        await undo(owner, first.body.batchId).expect(200);
        expect((await legs()).map(row => [row.name, row.type, row.pair])).toEqual([['Buffer', 'income', null]]);
        await undo(owner, third.body.batchId).expect(200);
        expect(await legs()).toEqual([]);
      });

      it('takes over the row read before when both files come later together', async () => {
        const first = await send(owner, [spending], { categorize: 'false' }).expect(201);
        const both = await send(owner, [spending, buffer], { categorize: 'false' }).expect(201);
        expect(both.body.transactions).toMatchObject({ created: 1, linked: 1, transfers: 1 });
        const booked = await legs();
        expect(booked.map(row => [row.name, row.type])).toEqual([
          ['Buffer', 'income'],
          ['Spending', 'expense'],
        ]);
        expect(booked[0].pair).toBe(booked[1].pair);
        await undo(owner, both.body.batchId).expect(200);
        await undo(owner, first.body.batchId).expect(200);
      });

      it('skips the transfer when the row read before is a transfer already', async () => {
        const first = await send(owner, [spending], { categorize: 'false' }).expect(201);
        // Paired since, by hand or by transfer detection, with a row of some other account.
        await q(
          `UPDATE transactions SET transfer_pair_id = gen_random_uuid(), transfer_pair_source = 'manual'
            WHERE workspace_id = $1 AND counterparty_name = 'Buffer'`,
          [owner.workspaceId],
        );
        const both = await send(owner, [spending, buffer], { dryRun: 'true' }).expect(201);
        expect(both.body.transactions).toMatchObject({ created: 0, linked: 0, skipped: 2 });
        await undo(owner, first.body.batchId).expect(200);
      });

      it("pairs the leg written for an account with that account's own row of the day", async () => {
        // The vault already holds the deposit (its own export, or its bank statement).
        const vault = await send(
          owner,
          [text('vault.csv', `${header}\nVault,2026-05-09,Deposit,,,,50,0,Cleared\n`)],
          { categorize: 'false' },
        ).expect(201);
        const ynab =
          '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"\n' +
          '"Daily Card","","05/09/2026","Transfer : Vault","","","","",$50.00,$0.00,"Cleared"\n';
        // A row unlinked by hand, marked a duplicate, or part of a split is not taken.
        for (const change of [
          "transfer_pair_source = 'rejected'",
          'is_duplicate = true',
          'split_group_id = gen_random_uuid(), split_index = 0',
        ]) {
          const reset = 'transfer_pair_source = NULL, is_duplicate = false, split_group_id = NULL, split_index = NULL';
          await q(`UPDATE transactions SET ${change} WHERE workspace_id = $1 AND counterparty_name = 'Deposit'`, [owner.workspaceId]);
          const preview = await send(owner, [text('ynab.csv', ynab)], { dryRun: 'true' }).expect(201);
          expect(preview.body.transactions).toMatchObject({ created: 2, linked: 0 });
          await q(`UPDATE transactions SET ${reset} WHERE workspace_id = $1 AND counterparty_name = 'Deposit'`, [owner.workspaceId]);
        }
        // A category the row was only suggested goes with the pairing, and comes back on undo.
        const [suggested] = await q<{ id: string }>(
          `SELECT id FROM categories WHERE workspace_id = $1 AND parent_id IS NULL ORDER BY name LIMIT 1`,
          [owner.workspaceId],
        );
        const deposit = async () =>
          (
            await q<{ category_id: string | null; category_source: string | null; pair: string | null }>(
              `SELECT category_id, category_source, transfer_pair_id AS pair FROM transactions
                WHERE workspace_id = $1 AND counterparty_name = 'Deposit'`,
              [owner.workspaceId],
            )
          )[0];
        await q(
          `UPDATE transactions SET category_id = $2, category_source = 'kind', is_verified = false
            WHERE workspace_id = $1 AND counterparty_name = 'Deposit'`,
          [owner.workspaceId, suggested.id],
        );
        const res = await send(owner, [text('ynab.csv', ynab)], { categorize: 'false' }).expect(201);
        expect(res.body.transactions).toMatchObject({ created: 1, linked: 1, transfers: 1 });
        expect(await deposit()).toMatchObject({ category_id: null, category_source: 'default' });
        const rows = await q<{ name: string; type: string; pair: string | null }>(
          `SELECT w.name, t.transaction_type AS type, t.transfer_pair_id AS pair
             FROM transactions t JOIN wallets w ON w.id = t.wallet_id
            WHERE t.workspace_id = $1 AND w.name IN ('Vault', 'Daily Card') ORDER BY w.name`,
          [owner.workspaceId],
        );
        expect(rows.map(row => [row.name, row.type])).toEqual([
          ['Daily Card', 'expense'],
          ['Vault', 'income'],
        ]);
        expect(rows[0].pair).toBeTruthy();
        expect(rows[0].pair).toBe(rows[1].pair);
        await undo(owner, res.body.batchId).expect(200);
        expect(await deposit()).toEqual({ category_id: suggested.id, category_source: 'kind', pair: null });
        await undo(owner, vault.body.batchId).expect(200);
      });
    });
  });

  describe('YNAB accounts read in separate imports', () => {
    const header =
      '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"';
    const main = text(
      'main.csv',
      `${header}\n"Main","","03/01/2026","Starting Balance","Inflow: Ready to Assign","Inflow","Ready to Assign","",$0.00,$900.00,"Cleared"\n` +
        `"Main","","03/02/2026","Transfer : Rainy","","","","",$100.00,$0.00,"Cleared"\n`,
    );
    const rainy = text(
      'rainy.csv',
      `${header}\n"Rainy","","03/01/2026","Starting Balance","Inflow: Ready to Assign","Inflow","Ready to Assign","",$0.00,$400.00,"Cleared"\n` +
        `"Rainy","","03/02/2026","Transfer : Main","","","","",$0.00,$100.00,"Cleared"\n`,
    );
    const opening = async (name: string) =>
      Number(
        (
          await q<{ initial_balance: string }>(
            'SELECT initial_balance FROM wallets WHERE workspace_id = $1 AND name = $2',
            [owner.workspaceId, name],
          )
        )[0]?.initial_balance,
      );

    it("gives an account created as a transfer's other side its own opening balance later", async () => {
      const first = await send(owner, [main], { categorize: 'false' }).expect(201);
      expect(await opening('Rainy')).toBe(0);
      const preview = await send(owner, [rainy], { dryRun: 'true' }).expect(201);
      expect(preview.body.accounts).toEqual([
        expect.objectContaining({ name: 'Rainy', status: 'matched', opening: 400, openingsSkipped: 0 }),
        expect.objectContaining({ name: 'Main', status: 'matched', opening: 0 }),
      ]);
      expect(preview.body.transactions).toMatchObject({ created: 0, skipped: 2 });
      const second = await send(owner, [rainy], { categorize: 'false' }).expect(201);
      expect(await opening('Rainy')).toBe(400);
      expect(await opening('Main')).toBe(900);

      // Now it has its own: read again, the opening is shown as left out, and nothing is written.
      const again = await send(owner, [rainy], { dryRun: 'true' }).expect(201);
      expect(again.body.accounts[0]).toMatchObject({ name: 'Rainy', opening: 0, openingsSkipped: 1 });
      await send(owner, [rainy]).expect(400);

      await undo(owner, second.body.batchId).expect(200);
      expect(await opening('Rainy')).toBe(0);
      await undo(owner, first.body.batchId).expect(200);
    });

    it('leaves the opening of an account the person made alone, and says so', async () => {
      await request(server())
        .post('/wallets')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send({ name: 'Rainy', currency: 'USD' })
        .expect(201);
      const preview = await send(owner, [rainy], { dryRun: 'true' }).expect(201);
      expect(preview.body.accounts[0]).toMatchObject({ name: 'Rainy', status: 'matched', opening: 0, openingsSkipped: 1 });
      await q('DELETE FROM wallets WHERE workspace_id = $1 AND name = $2', [owner.workspaceId, 'Rainy']);
    });

    it('two commits of the same file at once book it once', async () => {
      const register = text(
        'twice.csv',
        `${header}\n"Twice Checking","","04/01/2026","Example Shop","Everyday: Groceries","Everyday","Groceries","",$5.00,$0.00,"Cleared"\n` +
          `"Twice Checking","","04/02/2026","Example Shop","Everyday: Groceries","Everyday","Groceries","",$6.00,$0.00,"Cleared"\n`,
      );
      const results = await Promise.all([
        send(owner, [register], { categorize: 'false' }),
        send(owner, [register], { categorize: 'false' }),
      ]);
      expect(results.map(res => res.status).sort()).toEqual([201, 400]);
      const wallets = await q<{ id: string }>('SELECT id FROM wallets WHERE workspace_id = $1 AND name = $2', [
        owner.workspaceId,
        'Twice Checking',
      ]);
      expect(wallets).toHaveLength(1);
      expect(await q('SELECT id FROM transactions WHERE wallet_id = $1', [wallets[0].id])).toHaveLength(2);
      const done = results.find(res => res.status === 201);
      await undo(owner, done?.body.batchId).expect(200);
    });
  });

  describe('Firefly III', () => {
    it('books a transfer row as two legs, the opening balance, and the split', async () => {
      const res = await send(owner, [file('firefly-export.csv')], { categorize: 'false' }).expect(201);
      expect(res.body.accounts.map((item: { name: string; currency: string }) => [item.name, item.currency])).toEqual([
        ['Main account', 'EUR'],
        ['Savings account', 'EUR'],
      ]);
      expect(res.body.transactions).toMatchObject({ created: 6, transfers: 1, splits: 1 });
      const [main] = await q<{ id: string; initial_balance: string }>(
        `SELECT id, initial_balance FROM wallets WHERE workspace_id = $1 AND name = 'Main account'`,
        [owner.workspaceId],
      );
      expect(Number(main.initial_balance)).toBe(1250);
      const legs = await q<{ amount: string; type: string; currency: string }>(
        `SELECT amount, transaction_type AS type, currency FROM transactions
          WHERE workspace_id = $1 AND transfer_pair_id IS NOT NULL ORDER BY transaction_type::text`,
        [owner.workspaceId],
      );
      expect(legs.map(row => [Number(row.amount), row.type, row.currency])).toEqual([
        [400, 'expense', 'EUR'],
        [400, 'income', 'EUR'],
      ]);
      const preview = await send(owner, [file('firefly-export.csv')], { dryRun: 'true' }).expect(201);
      expect(preview.body.transactions).toMatchObject({ created: 0, skipped: 6 });
      await undo(owner, res.body.batchId).expect(200);
    });
  });

  describe('workspaces and rights', () => {
    it("never matches or books into another workspace's accounts", async () => {
      const otherWallet = await request(server())
        .post('/wallets')
        .set('Authorization', `Bearer ${other.token}`)
        .set('x-workspace-id', other.workspaceId)
        .send({ name: 'Main account', currency: 'EUR' })
        .expect(201);
      const chosen = await send(owner, [file('firefly-export.csv')], {
        dryRun: 'true',
        accounts: JSON.stringify({ 'Main account': otherWallet.body.id }),
      });
      expect(chosen.status).toBe(404);

      const byName = await send(owner, [file('firefly-export.csv')], { dryRun: 'true' }).expect(201);
      expect(byName.body.accounts[0]).toMatchObject({ name: 'Main account', status: 'created', walletId: null });

      const otherBefore = await snapshot(other.workspaceId);
      const res = await send(owner, [file('firefly-export.csv')], { categorize: 'false' }).expect(201);
      expect(await snapshot(other.workspaceId)).toEqual(otherBefore);
      await undo(other, res.body.batchId).expect(404);
      await undo(owner, res.body.batchId).expect(200);
    });

    it('is refused to a viewer and to a workspace the caller is not in', async () => {
      await send(viewer, [file('actual-export.csv')], { dryRun: 'true' }, owner.workspaceId).expect(403);
      const outsider = await send(other, [file('actual-export.csv')], { dryRun: 'true' }, owner.workspaceId);
      expect([403, 404]).toContain(outsider.status);
    });

    it('says which files it could not read', async () => {
      const res = await send(owner, [text('bank.csv', 'Date,Payee,Amount\n2026-01-01,Shop,-1\n')], {
        dryRun: 'true',
      }).expect(201);
      expect(res.body.files).toEqual([{ fileName: 'bank.csv', app: null, kind: null, rows: 0 }]);
      expect(res.body.transactions.created).toBe(0);
    });
  });
});

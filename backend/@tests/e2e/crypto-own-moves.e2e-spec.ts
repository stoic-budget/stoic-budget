vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CryptoSyncService } from '../../src/modules/crypto/crypto-sync.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** Coins sent to an address that later turns out to be one's own wallet were a move (#695). */
describe('Connecting a wallet one already sent coins to (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `crypto-own-moves-${Date.now()}@example.com`;
  const otherEmail = `crypto-own-moves-other-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let other: E2eAccount;
  const SECOND = '0x5555555555555555555555555555555555555555';

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  /** A stored crypto row of the account's manual wallet that sent ETH to `to`. */
  const sentTo = async (account: E2eAccount, to: string): Promise<string> => {
    const holding = await as(account, request(server()).post('/crypto/holdings'))
      .send({ asset: 'ETH', amount: '2', costPerUnit: 2000 })
      .expect(201);
    const categories = await as(account, request(server()).get('/categories?type=expense')).expect(200);
    const statement = await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', '2000')
      .field('currency', 'USD')
      .field('merchant', 'ACME Wallet')
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-10-05')
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [statement.body.id]);
    await dataSource.query(
      `UPDATE transactions SET crypto_wallet_id = $1, crypto_asset = 'ETH', crypto_amount = 1,
              crypto_leg = 'value', crypto_tx_hash = $2, counterparty_account = $3
        WHERE id = $4`,
      [holding.body.id, `0xhash-${account.workspaceId}`, to, row.id],
    );
    return row.id;
  };
  const leg = async (id: string) =>
    (await dataSource.query('SELECT crypto_leg, transfer_pair_id FROM transactions WHERE id = $1', [id]))[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    other = await registerAccount(app, otherEmail, 'Member Two');
    // No chain is reachable from a test: the connect's first sync finds nothing.
    vi.spyOn(app.get(CryptoSyncService), 'syncWallet').mockResolvedValue({ imported: 0, skipped: 0 } as never);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
      await deleteUserByEmail(dataSource, otherEmail);
    }
    await app.close();
  });

  it('turns the stored send into a move between own wallets, and leaves another workspace alone', async () => {
    const mine = await sentTo(owner, SECOND.toUpperCase().replace('0X', '0x'));
    const theirs = await sentTo(other, SECOND);

    await as(owner, request(server()).post('/crypto/wallets')).send({ address: SECOND, chainId: 1 }).expect(201);

    await expect.poll(async () => (await leg(mine)).crypto_leg).toBe('move');
    expect((await leg(mine)).transfer_pair_id).not.toBeNull();
    expect((await leg(theirs)).crypto_leg).toBe('value');
  });
});

vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CryptoHoldingsService } from '../../src/modules/crypto/crypto-holdings.service';
import { CryptoPriceService } from '../../src/modules/crypto/crypto-price.service';
import { CryptoSnapshotScheduler } from '../../src/modules/crypto/crypto-snapshot.scheduler';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** The crypto value net worth reads follows the coins: daily, and on removal (#694). */
describe('Crypto value on the balance sheet (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `crypto-snapshot-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let walletId: string;
  let ethPrice = 2000;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  /** Today's crypto line on the workspace's balance sheet. */
  const cryptoOnSheet = async (): Promise<number | undefined> => {
    const [row] = await dataSource.query(
      `SELECT s.amount FROM balance_snapshots s
         JOIN balance_accounts a ON a.id = s.account_id
        WHERE s.workspace_id = $1 AND a.account_kind = 'crypto'
        ORDER BY s.snapshot_date DESC, s.created_at DESC LIMIT 1`,
      [owner.workspaceId],
    );
    return row ? Number(row.amount) : undefined;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`)).send({ currency: 'USD' }).expect(200);
    // No price source is reachable from a test: today's price is set here.
    vi.spyOn(app.get(CryptoPriceService), 'getCurrentUsdPrices').mockImplementation(async () => ({ ETH: ethPrice }));
    const holding = await as(request(server()).post('/crypto/holdings'))
      .send({ asset: 'ETH', amount: '1.5', costPerUnit: 2000 })
      .expect(201);
    walletId = holding.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('moves a manual holding with the price once a day, with no chain to sync', async () => {
    expect(await cryptoOnSheet()).toBe(3000);

    ethPrice = 3000;
    await app.get(CryptoSnapshotScheduler).writeDailySnapshots();

    expect(await cryptoOnSheet()).toBe(4500);
  });

  it('writes the daily value as the system, not as a member', async () => {
    const [event] = await dataSource.query(
      `SELECT actor_type FROM audit_events
        WHERE workspace_id = $1 AND meta->>'kind' = 'balance_snapshot'
        ORDER BY created_at DESC LIMIT 1`,
      [owner.workspaceId],
    );
    expect(event?.actor_type).toBe('system');
  });

  it('takes the value off by the next day when the write failed with the last wallet', async () => {
    // The write after the delete fails once; the delete itself goes through.
    vi.spyOn(app.get(CryptoHoldingsService), 'portfolioValue').mockRejectedValueOnce(new Error('no rate'));
    await as(request(server()).delete(`/crypto/wallets/${walletId}`)).expect(200);
    expect(await cryptoOnSheet()).toBe(4500);

    await app.get(CryptoSnapshotScheduler).writeDailySnapshots();

    expect(await cryptoOnSheet()).toBe(0);
  });

  it('takes a removed wallet off the balance sheet at once', async () => {
    const holding = await as(request(server()).post('/crypto/holdings'))
      .send({ asset: 'ETH', amount: '1', costPerUnit: 2000 })
      .expect(201);
    expect(await cryptoOnSheet()).toBe(3000);

    await as(request(server()).delete(`/crypto/wallets/${holding.body.id}`)).expect(200);

    expect(await cryptoOnSheet()).toBe(0);
  });
});

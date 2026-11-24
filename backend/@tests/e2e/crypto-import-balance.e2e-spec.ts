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

const HEADER =
  'ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes';

/**
 * An exchange export for one month is part of the history, not all of it: a
 * January and a February file add up, and a March sale takes from both (#689).
 */
describe('Exchange imports add up (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `crypto-import-balance-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const server = () => app.getHttpServer();
  const importFile = (rows: string[]) =>
    request(server())
      .post('/crypto/import')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .attach('file', Buffer.from([HEADER, ...rows].join('\n')), {
        filename: 'coinbase.csv',
        contentType: 'text/csv',
      })
      .expect(201);
  /** What the exchange wallet holds in BTC, as the import stored it. */
  const btc = async (): Promise<string | undefined> => {
    const [wallet] = await dataSource.query(
      `SELECT balances FROM crypto_wallets WHERE workspace_id = $1 AND kind = 'exchange'`,
      [owner.workspaceId],
    );
    return (wallet?.balances ?? []).find((balance: { asset: string }) => balance.asset === 'BTC')?.amount;
  };
  const january = ['buy-1,2026-01-05T10:00:00Z,Buy,BTC,1,USD,40000,40000.00,40000.00,0.00,Bought 1 BTC'];
  const february = ['buy-2,2026-02-05T10:00:00Z,Buy,BTC,0.1,USD,45000,4500.00,4500.00,0.00,Bought 0.1 BTC'];
  const march = ['sell-1,2026-03-05T10:00:00Z,Sell,BTC,0.2,USD,50000,10000.00,10000.00,0.00,Sold 0.2 BTC'];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('adds a second month to the first instead of replacing it', async () => {
    await importFile(january);
    expect(await btc()).toBe('1');

    await importFile(february);
    expect(await btc()).toBe('1.1');
  });

  it('takes a sale in a later file from what the earlier ones bought', async () => {
    await importFile(march);

    expect(await btc()).toBe('0.9');
  });

  it('changes nothing when a file is imported again', async () => {
    const again = await importFile(february);

    expect(again.body.imported).toBe(0);
    expect(await btc()).toBe('0.9');
  });
});

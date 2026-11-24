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
  const importFile = (rows: string[], header = HEADER) =>
    request(server())
      .post('/crypto/import')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .attach('file', Buffer.from([header, ...rows].join('\n')), {
        filename: 'export.csv',
        contentType: 'text/csv',
      })
      .expect(201);
  /** What an exchange wallet holds of a coin, as the import stored it. */
  const held = async (asset: string, label = 'Coinbase'): Promise<string | undefined> => {
    const [wallet] = await dataSource.query(
      `SELECT balances FROM crypto_wallets WHERE workspace_id = $1 AND kind = 'exchange' AND label = $2`,
      [owner.workspaceId, label],
    );
    return (wallet?.balances ?? []).find((balance: { asset: string }) => balance.asset === asset)?.amount;
  };
  const btc = () => held('BTC');
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

  it('keeps a coin no price is known for in the balance of its file', async () => {
    // ZZQ is on no price list: the rows cannot be booked, but they are still held.
    const kraken = 'txid,refid,time,type,subtype,aclass,asset,amount,fee,balance';
    await importFile(
      [
        'LZZ1-A,R1,2026-01-05 10:00:00,deposit,,currency,ZZQ,2.0000000000,0,2',
        'LZZ1-B,R2,2026-01-06 10:00:00,withdrawal,,currency,ZZQ,-0.5000000000,0.01,1.49',
      ],
      kraken,
    );

    expect(await held('ZZQ', 'Kraken')).toBe('1.49');
    expect(await held('BTC', 'Kraken')).toBeUndefined();
    // Another exchange's rows stay out of this one.
    expect(await btc()).toBe('0.9');
  });

  it('leaves a coin out once more was sold than held, and does not count a duplicate', async () => {
    await importFile(['sell-2,2026-04-05T10:00:00Z,Sell,BTC,5,USD,50000,250000.00,250000.00,0.00,Sold 5 BTC']);
    expect(await btc()).toBeUndefined();

    // Marked a duplicate by hand: the sale no longer counts on the next import.
    await dataSource.query(
      `UPDATE transactions SET is_duplicate = true
        WHERE workspace_id = $1 AND crypto_asset = 'BTC' AND crypto_amount = 5`,
      [owner.workspaceId],
    );
    await importFile(march);
    expect(await btc()).toBe('0.9');
  });
});

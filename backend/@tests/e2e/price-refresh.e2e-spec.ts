vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { InvestmentsScheduler } from '../../src/modules/investments/investments.scheduler';
import { MetalsService } from '../../src/modules/investments/metals.service';
import { StockPriceService } from '../../src/modules/investments/stock-price.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A failed quote is said, and metals are repriced every day (#696). */
describe('Price refresh (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `price-refresh-${Date.now()}@example.com`;
  const goldEmail = `price-refresh-gold-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
      await deleteUserByEmail(dataSource, goldEmail);
    }
    await app.close();
  });

  it('answers how many holdings got no price when the source gives none', async () => {
    const prices = vi.spyOn(app.get(StockPriceService), 'getPrices').mockResolvedValue(new Map());
    const account = await as(request(server()).post('/investments/accounts'))
      .send({ name: 'Brokerage', kind: 'investment' })
      .expect(201);
    for (const price of [undefined, 5]) {
      await as(request(server()).post(`/investments/accounts/${account.body.id}/holdings`))
        .send({ name: 'ACME', symbol: 'ACME', assetClass: 'stock', quantity: 10, price, priceCurrency: 'USD' })
        .expect(201);
    }

    const down = await as(request(server()).post('/investments/refresh-prices')).expect(200);
    expect(down.body).toEqual({ updated: 0, failed: 2 });

    prices.mockResolvedValue(
      new Map([['ACME.US', { symbol: 'ACME.US', price: 7, currency: 'USD', at: new Date() }]]),
    );
    const back = await as(request(server()).post('/investments/refresh-prices')).expect(200);
    expect(back.body).toEqual({ updated: 2, failed: 0 });
  });

  it('reprices metal lots in the daily job, not past versions', async () => {
    const refresh = vi.spyOn(app.get(MetalsService), 'refreshPrices').mockResolvedValue(1);
    // A workspace with gold only: nothing else would bring it into a price job.
    const goldOnly = await registerAccount(app, goldEmail, 'Member Two');
    await request(server())
      .post('/investments/accounts')
      .set('Authorization', `Bearer ${goldOnly.token}`)
      .set('x-workspace-id', goldOnly.workspaceId)
      .send({ name: 'Vault', kind: 'investment' })
      .expect(201);
    await dataSource.query(
      `INSERT INTO investment_holdings (workspace_id, account_id, name, asset_class, quantity, price, price_currency, metal)
       SELECT $1, id, 'Gold coin', 'metal', 1, 2000, 'EUR', 'XAU' FROM balance_accounts WHERE workspace_id = $1 LIMIT 1`,
      [goldOnly.workspaceId],
    );

    await app.get(InvestmentsScheduler).refreshMetalPrices();

    expect(refresh).toHaveBeenCalledWith(null, goldOnly.workspaceId);
  });
});

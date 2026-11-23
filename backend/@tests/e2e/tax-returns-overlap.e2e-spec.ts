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

/** Filed returns never share a day, and reopening one keeps another's rows locked. */
describe('Overlapping tax returns (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `tax-overlap-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let rowId: string;

  const api = (method: 'post' | 'put' | 'patch' | 'get', url: string) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
  const file = (periodStart: string, periodEnd: string) =>
    api('post', '/tax/returns/file').send({ periodStart, periodEnd });
  const locked = async () =>
    (await dataSource.query('SELECT tax_locked FROM transactions WHERE id = $1', [rowId]))[0].tax_locked;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Tax Overlap Owner');
    await api('patch', `/workspaces/${owner.workspaceId}`).send({ currency: 'EUR' }).expect(200);
    await api('put', '/tax/settings/jurisdiction').send({ code: 'DE', effectiveFrom: '2025-01-01' }).expect(200);
    const categories = await api('get', '/categories?type=expense').expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null; name: string }>).find(
      item => !item.parentId && item.name !== 'Uncategorized',
    );
    const created = await api('post', '/statements/manual-expense')
      .field('amount', '119')
      .field('currency', 'EUR')
      .field('merchant', 'ACME Store')
      .field('categoryId', category?.id ?? '')
      .field('date', '2026-03-10')
      .expect(201);
    rowId = (await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [created.body.id]))[0]
      .id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('refuses a year that overlaps a filed quarter, and files the next quarter', async () => {
    await file('2026-01-01', '2026-03-31').expect(201);

    const year = await file('2026-01-01', '2026-12-31').expect(409);
    expect(year.body.error.code).toBe('TAX_RETURN_PERIOD_OVERLAPS');
    await file('2026-04-01', '2026-06-30').expect(201);
  });

  it('refuses an overlap of a single day, and files the day after', async () => {
    await file('2026-07-01', '2026-09-30').expect(201);

    await file('2026-09-30', '2026-10-31').expect(409);
    await file('2026-10-01', '2026-10-31').expect(201);
  });

  it('files only one of two overlapping returns sent at the same time, and one of two identical ones', async () => {
    const [quarter, year] = await Promise.all([file('2027-01-01', '2027-03-31'), file('2027-01-01', '2027-12-31')]);
    expect([quarter.status, year.status].sort()).toEqual([201, 409]);

    const twins = await Promise.all([file('2028-01-01', '2028-03-31'), file('2028-01-01', '2028-03-31')]);
    expect(twins.map(answer => answer.status).sort()).toEqual([201, 409]);
  });

  it('keeps a row locked on reopening while another filed return holds it', async () => {
    // A year filed beside its quarter before overlaps were refused.
    await dataSource.query(
      `INSERT INTO tax_returns (workspace_id, jurisdiction_id, currency, period_start, period_end, status, filed_at, snapshot)
       SELECT workspace_id, jurisdiction_id, currency, '2025-10-01', '2026-12-31', 'filed', now(), snapshot
         FROM tax_returns WHERE workspace_id = $1 AND period_start = '2026-01-01'`,
      [owner.workspaceId],
    );

    await api('post', '/tax/returns/reopen').send({ periodStart: '2026-01-01', periodEnd: '2026-03-31' }).expect(201);

    expect(await locked()).toBe(true);
  });
});

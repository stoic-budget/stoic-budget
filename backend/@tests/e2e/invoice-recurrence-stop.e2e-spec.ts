vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { InvoicesScheduler } from '../../src/modules/invoices/invoices.scheduler';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A recurring invoice can be stopped, issued or not, and a voided one bills no more. */
describe('Stopping a recurring invoice (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `invoice-stop-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let clientId: string;

  const send = (method: 'post' | 'put' | 'get', url: string, body?: object, as?: E2eAccount) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${(as ?? owner).token}`)
      .set('x-workspace-id', (as ?? owner).workspaceId)
      .send(body);
  const drafts = async () =>
    Number(
      (
        await dataSource.query(
          "SELECT count(*) AS n FROM invoices WHERE workspace_id = $1 AND status = 'draft'",
          [owner.workspaceId],
        )
      )[0].n,
    );
  /** A monthly invoice whose next copy is due today (sending needs a business profile; any status repeats). */
  const recurringSent = async () => {
    const invoice = await send('post', '/invoices', {
      clientId,
      issueDate: '2026-01-05',
      dueDate: '2026-02-04',
      currency: 'USD',
      recurrenceInterval: 'monthly',
      lineItems: [{ description: 'Monthly retainer', quantity: 1, unitPrice: 500 }],
    }).expect(201);
    await dataSource.query('UPDATE invoices SET is_recurring = true, next_issue_date = CURRENT_DATE WHERE id = $1', [
      invoice.body.id,
    ]);
    return invoice.body.id as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Invoice Stop Owner');
    clientId = (
      await send('post', '/clients', { name: 'ACME Store', email: 'billing@example.com', currency: 'USD' }).expect(
        201,
      )
    ).body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('issues no more copies once a recurring invoice is stopped', async () => {
    const id = await recurringSent();

    const stopped = await send('put', `/invoices/${id}/stop-recurring`).expect(200);
    expect(stopped.body).toMatchObject({ isRecurring: false, recurrenceInterval: null, nextIssueDate: null });
    const before = await drafts();
    await app.get(InvoicesScheduler).generateRecurringInvoices();

    expect(await drafts()).toBe(before);
  });

  it('issues no copies of a voided invoice', async () => {
    const id = await recurringSent();
    await send('put', `/invoices/${id}/void`).expect(200);

    const before = await drafts();
    await app.get(InvoicesScheduler).generateRecurringInvoices();

    expect(await drafts()).toBe(before);
  });

  it('still issues the copy of a recurring invoice nobody stopped', async () => {
    await recurringSent();

    const before = await drafts();
    await app.get(InvoicesScheduler).generateRecurringInvoices();

    expect(await drafts()).toBe(before + 1);
  });

  it("cannot stop another workspace's invoice", async () => {
    const id = await recurringSent();
    const other = await registerAccount(app, `invoice-stop-other-${Date.now()}@example.com`, 'Other Owner');

    await send('put', `/invoices/${id}/stop-recurring`, undefined, other).expect(404);

    const [row] = await dataSource.query('SELECT is_recurring FROM invoices WHERE id = $1', [id]);
    expect(row.is_recurring).toBe(true);
    await deleteUserByEmail(dataSource, other.email);
  });
});

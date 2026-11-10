vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { APP_NAME, APP_SLUG } from '../../src/common/brand';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const DAY_MS = 86_400_000;
const dayFromToday = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const icsDay = (day: string) => day.replace(/-/g, '');
/** RFC 5545 §3.1 unfolding: a CRLF followed by a space joins two lines. */
const unfold = (text: string) => text.replace(/\r\n /g, '');
/** The VEVENT blocks of a feed, unfolded, each as its property lines. */
const eventsOf = (text: string) =>
  unfold(text)
    .split('BEGIN:VEVENT\r\n')
    .slice(1)
    .map(block => block.split('END:VEVENT')[0].split('\r\n').filter(Boolean));
const prop = (lines: string[], name: string) =>
  lines.find(line => line.startsWith(`${name}:`) || line.startsWith(`${name};`));
const summaryOf = (lines: string[]) => prop(lines, 'SUMMARY')?.slice('SUMMARY:'.length) ?? '';
const eventWith = (text: string, needle: string) =>
  eventsOf(text).find(lines => summaryOf(lines).includes(needle));

/**
 * A member's calendar feed, read the way a calendar app reads it: by the link
 * alone. It carries the workspace's money dates for that member, in their
 * language, as strict iCalendar; never another workspace's data, never
 * another member's private rows, and nothing once the link is revoked.
 */
describe('Calendar feed (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `cal-owner-${stamp}@example.com`,
    partner: `cal-partner-${stamp}@example.com`,
    other: `cal-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;
  let other: E2eAccount;
  let partnerMemberId: string;
  let ownerToken: string;
  const ids: Record<string, string> = {};
  const otherMarker = `othermark${stamp}`;

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test, workspaceId = owner.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const feed = (token: string) => request(server()).get(`/public/calendar/${token}.ics`);
  const fetchFeed = async (token: string) => (await feed(token).expect(200)).text;

  async function bookExpense(merchant: string): Promise<string> {
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(200);
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '25')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categories.body[0].id)
      .field('date', dayFromToday(-3))
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    return listed.body.data[0].id;
  }

  const createPayable = async (body: object, account = owner, workspaceId = owner.workspaceId) => {
    const res = await as(account, request(server()).post('/payables'), workspaceId).send(body);
    if (res.status !== 201) throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    partner = await registerAccount(app, emails.partner, 'Member Two');
    other = await registerAccount(app, emails.other, 'Member Three');
    // The owner reads the feed in German; the partner keeps English.
    await dataSource.query('UPDATE users SET locale = $1 WHERE id = $2', ['de', owner.userId]);

    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
    [{ id: partnerMemberId }] = await dataSource.query(
      'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [owner.workspaceId, partner.userId],
    );

    // A bill whose name needs escaping, with a two-day reminder.
    ids.bill = await createPayable({
      vendor: 'ACME Store, Ltd; Wireless Buds',
      amount: 1234.5,
      currency: 'EUR',
      dueDate: dayFromToday(5),
      remindDaysBefore: 2,
    });
    // Paid last week: stays in the feed, marked paid.
    ids.paid = await createPayable({
      vendor: 'Example Power Co',
      amount: 80,
      currency: 'USD',
      dueDate: dayFromToday(-7),
    });
    await dataSource.query(
      "UPDATE payables SET status = 'paid', paid_amount = amount, paid_at = now() WHERE id = $1",
      [ids.paid],
    );
    // Money expected in.
    ids.receivable = await createPayable({
      vendor: 'Client Alpha',
      amount: 500,
      currency: 'EUR',
      dueDate: dayFromToday(10),
      direction: 'receivable',
    });
    // A weekly bill: the occurrences not made yet are projected.
    ids.weekly = await createPayable({
      vendor: 'Weekly Cleaner',
      amount: 30,
      currency: 'EUR',
      remindDaysBefore: 1,
      recurrence: { frequency: 'weekly', interval: 1, startDate: dayFromToday(1) },
    });

    // Two bills tied to the partner's private transaction: one by the single link, one by a payment.
    const privateTx = await bookExpense('Gift Shop');
    await dataSource.query(
      'UPDATE transactions SET is_private = true, owner_member_id = $1 WHERE id = $2',
      [partnerMemberId, privateTx],
    );
    ids.privateLinked = await createPayable({
      vendor: 'Secret Jeweller',
      amount: 70,
      currency: 'EUR',
      dueDate: dayFromToday(4),
    });
    await dataSource.query('UPDATE payables SET linked_transaction_id = $1 WHERE id = $2', [
      privateTx,
      ids.privateLinked,
    ]);
    ids.privatePaid = await createPayable({
      vendor: 'Hidden Florist',
      amount: 40,
      currency: 'EUR',
      dueDate: dayFromToday(3),
    });
    await dataSource.query(
      `INSERT INTO payable_payments (payable_id, workspace_id, amount, paid_on, transaction_id)
       VALUES ($1, $2, 5, $3, $4)`,
      [ids.privatePaid, owner.workspaceId, dayFromToday(-1), privateTx],
    );

    // A repeating bill whose occurrences made so far are all tied to it: its projected repeats stay out too.
    ids.privateSeries = await createPayable({
      vendor: 'Private Gym',
      amount: 20,
      currency: 'EUR',
      recurrence: { frequency: 'weekly', interval: 1, startDate: dayFromToday(2) },
    });
    await dataSource.query(
      `UPDATE payables SET linked_transaction_id = $1
        WHERE workspace_id = $2 AND series_id = (SELECT series_id FROM payables WHERE id = $3)`,
      [privateTx, owner.workspaceId, ids.privateSeries],
    );

    await as(owner, request(server()).post('/subscriptions'))
      .send({
        vendorName: 'Example Streaming',
        amount: 9.99,
        frequency: 'monthly',
        currency: 'USD',
        nextChargeDate: dayFromToday(6),
      })
      .expect(201)
      .then(res =>
        as(owner, request(server()).put(`/subscriptions/${res.body.id}`))
          .send({ status: 'active' })
          .expect(200),
      );

    // A sent invoice: its receivable shows once, as the invoice.
    await as(owner, request(server()).put('/business-profile'))
      .send({ legalName: 'Example Studio', addressLines: '1 Example Street' })
      .expect(200);
    const client = await as(owner, request(server()).post('/clients'))
      .send({ name: 'Client Beta', email: 'member-1@example.com', currency: 'EUR' })
      .expect(201);
    const invoice = await as(owner, request(server()).post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: dayFromToday(-2),
        dueDate: dayFromToday(12),
        currency: 'EUR',
        lineItems: [{ description: 'Design work', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);
    await as(owner, request(server()).put(`/invoices/${invoice.body.id}/send`)).expect(200);
    ids.invoice = invoice.body.id;

    await as(owner, request(server()).put('/tax/settings/jurisdiction'))
      .send({ code: 'DE' })
      .expect(200);

    // Another workspace with its own bill and feed.
    await createPayable(
      { vendor: `${otherMarker} vendor`, amount: 11, currency: 'EUR', dueDate: dayFromToday(5) },
      other,
      other.workspaceId,
    );

    const created = await as(owner, request(server()).post('/calendar-feed')).send({}).expect(201);
    ownerToken = created.body.token;
  }, 120_000);

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app?.close();
  });

  it('keeps only a hash of the token and never shows the token again', async () => {
    const [row] = await dataSource.query(
      'SELECT token_hash FROM calendar_feeds WHERE workspace_id = $1',
      [owner.workspaceId],
    );
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(ownerToken);
    const settings = await as(owner, request(server()).get('/calendar-feed')).expect(200);
    expect(settings.body).toEqual(
      expect.objectContaining({ enabled: true, createdAt: expect.any(String) }),
    );
    expect(JSON.stringify(settings.body)).not.toContain(ownerToken);
  });

  it('answers text/calendar with CRLF lines folded within 75 octets', async () => {
    const res = await feed(ownerToken).expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/calendar; charset=utf-8/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(res.text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(res.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of res.text.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(unfold(res.text)).toContain(`PRODID:-//${APP_NAME}//Calendar feed//EN`);
    // The calendar's name is in the owner's language.
    expect(unfold(res.text)).toContain('Geldtermine');
  });

  it("carries the owner's bills as all-day events with reminders, in their language", async () => {
    const text = await fetchFeed(ownerToken);
    const bill = eventWith(text, 'ACME Store');
    expect(bill).toBeDefined();
    // German template, escaped comma and semicolon, the amount in its own currency.
    expect(summaryOf(bill ?? [])).toMatch(/^ACME Store\\, Ltd\\; Wireless Buds bezahlen · 1\.234\\,50\s€$/);
    expect(prop(bill ?? [], 'DTSTART')).toBe(`DTSTART;VALUE=DATE:${icsDay(dayFromToday(5))}`);
    expect(prop(bill ?? [], 'DTEND')).toBe(`DTEND;VALUE=DATE:${icsDay(dayFromToday(6))}`);
    expect(prop(bill ?? [], 'UID')).toBe(`UID:payable-${ids.bill}.${owner.workspaceId}@${APP_SLUG}`);
    expect(prop(bill ?? [], 'DTSTAMP')).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
    expect(bill).toContain('BEGIN:VALARM');
    expect(bill).toContain('TRIGGER:-P2D');

    const paid = eventWith(text, 'Example Power Co');
    expect(summaryOf(paid ?? [])).toMatch(/^Bezahlt: Example Power Co · /);
    expect(paid).not.toContain('BEGIN:VALARM');

    expect(summaryOf(eventWith(text, 'Client Alpha') ?? [])).toMatch(/^Erwartet von Client Alpha/);
  });

  it('gives each event the same UID on every fetch', async () => {
    const uids = (text: string) => eventsOf(text).map(lines => prop(lines, 'UID')).sort();
    const first = uids(await fetchFeed(ownerToken));
    const second = uids(await fetchFeed(ownerToken));
    expect(first.length).toBeGreaterThan(3);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });

  it('projects the occurrences of a repeating bill the scheduler has not made yet', async () => {
    const text = await fetchFeed(ownerToken);
    const weekly = eventsOf(text).filter(lines => summaryOf(lines).includes('Weekly Cleaner'));
    // The first bill plus about half a year of weekly occurrences.
    expect(weekly.length).toBeGreaterThan(20);
    const [{ series_id: seriesId }] = await dataSource.query(
      'SELECT series_id FROM payables WHERE id = $1',
      [ids.weekly],
    );
    for (const lines of weekly) {
      expect(prop(lines, 'UID')).toMatch(new RegExp(`^UID:payable-${seriesId}-\\d{4}-\\d{2}-\\d{2}\\.`));
      expect(lines).toContain('TRIGGER:-P1D');
    }
  });

  it('carries subscription charges, tax deadlines and invoice due dates', async () => {
    const text = await fetchFeed(ownerToken);
    expect(summaryOf(eventWith(text, 'Example Streaming') ?? [])).toMatch(/^Abo-Abbuchung: Example Streaming/);
    const deadlines = await as(owner, request(server()).get('/tax/deadlines')).expect(200);
    expect(deadlines.body.length).toBeGreaterThan(0);
    type Deadline = { kind: string; periodEnd: string; returnName: string; dueDate: string };
    for (const deadline of deadlines.body as Deadline[]) {
      const event = eventsOf(text).find(lines =>
        prop(lines, 'UID')?.startsWith(`UID:tax-${deadline.kind}-${deadline.periodEnd}.`),
      );
      expect(event).toBeDefined();
      expect(summaryOf(event ?? [])).toContain(deadline.returnName.replace(/[\\;,]/g, char => `\\${char}`));
      expect(prop(event ?? [], 'DTSTART')).toBe(`DTSTART;VALUE=DATE:${icsDay(deadline.dueDate)}`);
    }
    const invoice = eventWith(text, 'Client Beta');
    expect(summaryOf(invoice ?? [])).toMatch(/^Rechnung \S+ fällig: Client Beta · 300\\,00\s€$/);
    // Its receivable is the same money: it is not listed a second time as a bill.
    expect(eventsOf(text).filter(lines => summaryOf(lines).includes('Client Beta'))).toHaveLength(1);
  });

  it('shows what is still owed on an invoice once a credit note lowered it', async () => {
    const client = await as(owner, request(server()).post('/clients'))
      .send({ name: 'Client Gamma', email: 'member-3@example.com', currency: 'EUR' })
      .expect(201);
    const invoice = await as(owner, request(server()).post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: dayFromToday(-1),
        dueDate: dayFromToday(14),
        currency: 'EUR',
        lineItems: [{ description: 'Design work', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);
    await as(owner, request(server()).put(`/invoices/${invoice.body.id}/send`)).expect(200);
    await as(owner, request(server()).post('/credit-notes'))
      .send({ reason: 'Discount', applications: [{ invoiceId: invoice.body.id, amount: 100 }] })
      .expect(201);
    const detail = await as(owner, request(server()).get(`/invoices/${invoice.body.id}`)).expect(200);
    expect(Number(detail.body.amountDue)).toBe(200);

    const text = await fetchFeed(ownerToken);
    const events = eventsOf(text).filter(lines => summaryOf(lines).includes('Client Gamma'));
    expect(events).toHaveLength(1);
    expect(summaryOf(events[0])).toMatch(/^Rechnung \S+ fällig: Client Gamma · 200\\,00\s€$/);
  });

  it("leaves out bills tied to another member's private transaction, and shows them to their owner", async () => {
    const ownerText = await fetchFeed(ownerToken);
    expect(ownerText).not.toContain('Secret Jeweller');
    expect(ownerText).not.toContain('Hidden Florist');
    expect(ownerText).not.toContain('Private Gym');

    const partnerFeed = await as(partner, request(server()).post('/calendar-feed')).send({}).expect(201);
    const partnerText = await fetchFeed(partnerFeed.body.token);
    expect(unfold(partnerText)).toContain('Pay Secret Jeweller');
    expect(unfold(partnerText)).toContain('Pay Hidden Florist');
    // The occurrence itself and its projected repeats.
    expect(eventsOf(partnerText).filter(lines => summaryOf(lines).includes('Private Gym')).length).toBeGreaterThan(20);
    // In the partner's own language.
    expect(unfold(partnerText)).toContain('Money dates');
  });

  it("never carries another workspace's data, and each token reads only its own workspace", async () => {
    expect(await fetchFeed(ownerToken)).not.toContain(otherMarker);
    const otherFeed = await as(other, request(server()).post('/calendar-feed'), other.workspaceId)
      .send({})
      .expect(201);
    const otherText = unfold(await fetchFeed(otherFeed.body.token));
    expect(otherText).toContain(`${otherMarker} vendor`);
    for (const name of ['ACME Store', 'Client Beta', 'Example Streaming', 'Weekly Cleaner']) {
      expect(otherText).not.toContain(name);
    }
    expect(otherText).not.toContain(owner.workspaceId);
  });

  it('follows the choice of kinds; without invoices, the receivable shows as a bill', async () => {
    await as(owner, request(server()).patch('/calendar-feed'))
      .send({ subscriptions: false, invoices: false, taxDeadlines: false })
      .expect(200);
    const text = unfold(await fetchFeed(ownerToken));
    expect(text).not.toContain('Example Streaming');
    expect(text).not.toContain('Rechnung');
    expect(text).toContain('Erwartet von Client Beta');
    expect(text).toContain('ACME Store');

    await as(owner, request(server()).patch('/calendar-feed'))
      .send({ payables: false, invoices: true })
      .expect(200);
    const invoicesOnly = unfold(await fetchFeed(ownerToken));
    expect(invoicesOnly).not.toContain('ACME Store');
    expect(invoicesOnly).toContain('Client Beta');
    await as(owner, request(server()).patch('/calendar-feed'))
      .send({ payables: true, subscriptions: true, taxDeadlines: true })
      .expect(200);
  });

  it('a new link revokes the old one; turning the feed off removes it; unknown tokens are 404', async () => {
    const renewed = await as(owner, request(server()).post('/calendar-feed')).send({}).expect(201);
    expect(renewed.body.token).not.toBe(ownerToken);
    // The choice of kinds survives a new link.
    expect(renewed.body.include).toEqual({
      payables: true,
      subscriptions: true,
      taxDeadlines: true,
      invoices: true,
    });
    await feed(ownerToken).expect(404);
    await feed(renewed.body.token).expect(200);

    await as(owner, request(server()).delete('/calendar-feed')).expect(200);
    await feed(renewed.body.token).expect(404);
    const settings = await as(owner, request(server()).get('/calendar-feed')).expect(200);
    expect(settings.body.enabled).toBe(false);
    await as(owner, request(server()).patch('/calendar-feed')).send({ payables: false }).expect(404);

    await feed('x'.repeat(32)).expect(404);
    await feed('not a token').expect(400);
  });

  it('answers one live link, or a 409, when the feed is turned on twice at once', async () => {
    await as(owner, request(server()).delete('/calendar-feed')).expect(200);
    const answers = await Promise.all(
      [0, 1].map(() => as(owner, request(server()).post('/calendar-feed')).send({})),
    );
    const statuses = answers.map(res => res.status).sort();
    // Without the conditional write both answered 201, and one of the links was dead from the start.
    expect(statuses).toEqual([201, 409]);
    const loser = answers.find(res => res.status === 409);
    expect(loser?.body.error.code).toBe('CALENDAR_FEED_CHANGED');
    const winner = answers.find(res => res.status === 201);
    await feed(winner?.body.token).expect(200);
  });

  it('stops answering once the member has left the workspace', async () => {
    const partnerFeed = await as(partner, request(server()).post('/calendar-feed')).send({}).expect(201);
    await feed(partnerFeed.body.token).expect(200);
    await dataSource.query('DELETE FROM workspace_members WHERE id = $1', [partnerMemberId]);
    await feed(partnerFeed.body.token).expect(404);
  });
});

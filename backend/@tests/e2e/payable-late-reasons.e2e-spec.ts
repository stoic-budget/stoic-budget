vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { DataSource as DataSourceToken } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LatePaymentsSummary, Payable } from '../../src/contracts';
import { LatePaymentsAnalyzer } from '../../src/modules/insights/analyzers/late-payments.analyzer';
import { renderInsight } from '../../src/modules/insights/insight-translations';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put';
const day = (offset: number) => {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};

/**
 * Why a bill was paid late: one of six reasons on a late bill, read back as a
 * yearly summary and, when a reason repeats, as advice. Another workspace
 * reaches none of it.
 */
describe('Payable late reasons (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `late-owner-${stamp}@example.com`,
    other: `late-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;

  const call = (method: Method, url: string, status: number, body?: object, as = owner) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${as.token}`)
      .set('x-workspace-id', as.workspaceId);
    return (body ? req.send(body) : req).expect(status);
  };
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>)(body);
  const bill = async (dueDate: string, fields: object = {}) =>
    (
      await call('post', '/payables', 201, {
        vendor: 'ACME Power',
        amount: 40,
        currency: 'EUR',
        dueDate,
        ...fields,
      })
    ).body as { id: string };
  const codeOf = (body: { error?: { code?: string }; code?: string }) =>
    body.error?.code ?? body.code;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSourceToken);
    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('a bill past its due date takes a reason and a note, and answers the bill with them', async () => {
    const { id } = await bill(day(-5));
    const res = await call('put', `/payables/${id}/late-reason`, 200, {
      reason: 'forgot',
      note: '  Was travelling  ',
    });
    matches(Payable, res.body);
    expect(res.body).toMatchObject({ lateReason: 'forgot', lateReasonNote: 'Was travelling' });
    const read = await call('get', `/payables/${id}`, 200);
    expect(read.body.lateReason).toBe('forgot');
  });

  it('taking the reason back clears the note too', async () => {
    const { id } = await bill(day(-6));
    await call('put', `/payables/${id}/late-reason`, 200, { reason: 'other', note: 'x' });
    const res = await call('put', `/payables/${id}/late-reason`, 200, { reason: null });
    expect(res.body).toMatchObject({ lateReason: null, lateReasonNote: null });
  });

  it('a bill paid after its due date takes one too', async () => {
    const { id } = await bill(day(-9));
    await call('put', `/payables/${id}/mark-paid`, 200, { inHand: true, paidOn: day(-2) });
    const res = await call('put', `/payables/${id}/late-reason`, 200, {
      reason: 'short_before_payday',
    });
    expect(res.body.lateReason).toBe('short_before_payday');
  });

  it('refuses a bill not late, a bill to receive, an unknown reason and a long note', async () => {
    const onTime = await bill(day(10));
    expect(
      codeOf((await call('put', `/payables/${onTime.id}/late-reason`, 400, { reason: 'forgot' })).body),
    ).toBe('PAYABLE_NOT_LATE');
    const paidOnTime = await bill(day(-9));
    await call('put', `/payables/${paidOnTime.id}/mark-paid`, 200, {
      inHand: true,
      paidOn: day(-10),
    });
    await dataSource.query('UPDATE payables SET paid_at = $1 WHERE id = $2', [
      `${day(-10)}T12:00:00Z`,
      paidOnTime.id,
    ]);
    expect(
      codeOf(
        (await call('put', `/payables/${paidOnTime.id}/late-reason`, 400, { reason: 'forgot' }))
          .body,
      ),
    ).toBe('PAYABLE_NOT_LATE');
    const owed = await bill(day(-3), { direction: 'receivable' });
    expect(
      codeOf((await call('put', `/payables/${owed.id}/late-reason`, 400, { reason: 'forgot' })).body),
    ).toBe('PAYABLE_LATE_REASON_PAYABLES_ONLY');
    const late = await bill(day(-3));
    await call('put', `/payables/${late.id}/late-reason`, 400, { reason: 'lazy' });
    await call('put', `/payables/${late.id}/late-reason`, 400, {
      reason: 'other',
      note: 'x'.repeat(201),
    });
    await call('put', `/payables/${late.id}/late-reason`, 400, { reason: 'forgot', extra: 1 });
  });

  it('another workspace can neither set nor read it', async () => {
    const { id } = await bill(day(-4));
    await call('put', `/payables/${id}/late-reason`, 404, { reason: 'forgot' }, other);
    await call('put', `/payables/${id}/late-reason`, 200, { reason: 'income_late' });
    const theirs = await call('get', '/late-payments/summary', 200, undefined, other);
    expect(theirs.body.total).toBe(0);
    const [{ late_reason: kept }] = await dataSource.query(
      'SELECT late_reason FROM payables WHERE id = $1',
      [id],
    );
    expect(kept).toBe('income_late');
  });

  it('the summary counts the year’s late bills by reason, and the ones with none', async () => {
    const res = await call('get', '/late-payments/summary', 200);
    matches(LatePaymentsSummary, res.body);
    const counts = Object.fromEntries(
      (res.body.byReason as Array<{ reason: string; count: number }>).map(row => [
        row.reason,
        row.count,
      ]),
    );
    // forgot (1), short_before_payday (1), income_late (1); the cleared one and the
    // unpaid ones without a reason are "not said". On-time and future bills are not late.
    expect(counts).toEqual({ forgot: 1, short_before_payday: 1, income_late: 1 });
    expect(res.body.unexplained).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.since).toBe(day(-365));
  });

  it('the same reason twice in half a year becomes advice, in the reader’s language', async () => {
    const second = await bill(day(-20));
    await call('put', `/payables/${second.id}/late-reason`, 200, { reason: 'forgot' });
    const analyzer = app.get(LatePaymentsAnalyzer);
    const found = await analyzer.analyze({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
    });
    // Short before payday once and income late once: the same habit, money after the bill.
    expect(found.map(item => item.messageKey).sort()).toEqual([
      'pattern.late_forgot',
      'pattern.late_short',
    ]);
    const advice = found.find(item => item.messageKey === 'pattern.late_forgot');
    if (!advice) throw new Error('no advice');
    expect(advice).toMatchObject({
      type: 'pattern.late_payments',
      messageKey: 'pattern.late_forgot',
      messageParams: { count: 2 },
      data: { target: 'bills', count: 2 },
    });
    const text = renderInsight('en', advice.messageKey, advice.messageParams);
    expect(text.message).toContain('2 bills');
    expect(renderInsight('ru', advice.messageKey, advice.messageParams).title).not.toBe(text.title);
    // Another workspace's reasons are not this one's.
    expect(await analyzer.analyze({ userId: other.userId, workspaceId: other.workspaceId })).toEqual(
      [],
    );
  });
});

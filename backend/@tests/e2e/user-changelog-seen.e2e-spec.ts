import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

type Marker = { changelog_seen_id: string | null; changelog_seen_at: Date | null };

/**
 * The What's new marker: the newest changelog entry the user has seen. It lives on
 * the server so a release opens the dialog once across devices, and it only moves
 * forward, so an older client cannot bring an entry back.
 */
describe('User changelog seen (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const run = Date.now();
  const emails = [`changelog-seen-${run}@example.com`, `changelog-seen-other-${run}@example.com`];
  const tokens: string[] = [];
  const ids: string[] = [];
  let registeredAt: number;

  // Entries are dated relative to the sign-up, which is where a new account starts.
  const entry = (offsetMinutes: number, sha: string) => {
    const date = new Date(registeredAt + offsetMinutes * 60_000).toISOString();
    return { id: `changelog-${date.slice(0, 10)}-${sha}`, date };
  };
  const older = () => entry(-60 * 24, 'aaaaaaa');
  const middle = () => entry(10, 'bbbbbbb');
  const newer = () => entry(20, 'ccccccc');
  const newest = () => entry(30, 'ddddddd');

  const mark = (body: unknown, who = 0) =>
    request(app.getHttpServer())
      .post('/users/me/changelog-seen')
      .set('Authorization', `Bearer ${tokens[who]}`)
      .send(body as object);
  const stored = async (who = 0): Promise<Marker> => {
    const [row] = await dataSource.query(
      'SELECT changelog_seen_id, changelog_seen_at FROM users WHERE id = $1',
      [ids[who]],
    );
    return row;
  };
  // An account from before the column: it has seen nothing yet.
  const resetToPreFeature = (who = 0) =>
    dataSource.query(
      'UPDATE users SET changelog_seen_id = NULL, changelog_seen_at = NULL WHERE id = $1',
      [ids[who]],
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    for (const [index, email] of emails.entries()) {
      const register = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'Test123!@#', name: `Member ${index + 1}` });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Test123!@#' });
      tokens.push(accessTokenOf(login));
      ids.push(login.body?.user?.id);
      if (!(tokens[index] && ids[index])) {
        throw new Error(`Auth setup failed: register ${register.status}, login ${login.status}`);
      }
    }
    const marker = await stored();
    registeredAt = (marker.changelog_seen_at as Date).getTime();
  });

  afterAll(async () => {
    for (const email of emails) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/users/me/changelog-seen')
      .send({ id: 'changelog-2026-01-01-aaaaaaa', date: '2026-01-01T00:00:00.000Z' })
      .expect(401);
  });

  it('starts a new account at its sign-up time, so older releases are not new to it', async () => {
    expect(Math.abs(registeredAt - run)).toBeLessThan(5 * 60_000);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .expect(200);
    expect(me.body.changelogSeenId).toBeNull();
    expect(Date.parse(me.body.changelogSeenAt)).toBe(registeredAt);

    const answer = await mark(older()).expect(201);
    expect(answer.body).toEqual({ changelogSeenId: null, changelogSeenAt: me.body.changelogSeenAt });
  });

  it('moves the marker forward, for the caller only', async () => {
    const before = await stored(1);

    const answer = await mark(middle()).expect(201);

    expect(answer.body).toEqual({ changelogSeenId: middle().id, changelogSeenAt: middle().date });
    expect((await stored()).changelog_seen_id).toBe(middle().id);
    expect(await stored(1)).toEqual(before);
  });

  it('never moves the marker back', async () => {
    await mark(newer()).expect(201);

    const answer = await mark(middle()).expect(201);

    expect(answer.body).toEqual({ changelogSeenId: newer().id, changelogSeenAt: newer().date });
    expect((await stored()).changelog_seen_id).toBe(newer().id);
    // The same entry again is no change either.
    await mark(newer()).expect(201);
    expect((await stored()).changelog_seen_id).toBe(newer().id);
  });

  it('lets an account from before the column record any entry, then only newer ones', async () => {
    await resetToPreFeature();

    await mark(older()).expect(201);
    expect((await stored()).changelog_seen_id).toBe(older().id);
    await mark(newer()).expect(201);
    expect((await stored()).changelog_seen_id).toBe(newer().id);
  });

  it('ends at the newest entry when two devices mark at once', async () => {
    await resetToPreFeature();

    await Promise.all([mark(newest()).expect(201), mark(middle()).expect(201)]);
    await Promise.all([mark(newer()).expect(201), mark(older()).expect(201)]);

    const marker = await stored();
    expect(marker.changelog_seen_id).toBe(newest().id);
    expect(marker.changelog_seen_at?.toISOString()).toBe(newest().date);
  });

  it('keeps the marker through a whole-profile save and answers it there', async () => {
    const response = await request(app.getHttpServer())
      .patch('/users/me/preferences')
      .set('Authorization', `Bearer ${tokens[0]}`)
      .send({ locale: 'en' })
      .expect(200);

    expect(response.body.user.changelogSeenId).toBe(newest().id);
    expect(response.body.user.changelogSeenAt).toBe(newest().date);
    expect((await stored()).changelog_seen_id).toBe(newest().id);
  });

  it.each([
    [{ id: 'Changelog-2026-01-01-aaaaaaa', date: '2026-01-01T00:00:00.000Z' }],
    [{ id: 'changelog 2026', date: '2026-01-01T00:00:00.000Z' }],
    [{ id: `c${'a'.repeat(80)}`, date: '2026-01-01T00:00:00.000Z' }],
    [{ id: 'changelog-2026-01-01-aaaaaaa', date: '2026-01-01' }],
    [{ id: 'changelog-2026-01-01-aaaaaaa', date: 'yesterday' }],
    [{ id: 'changelog-2026-01-01-aaaaaaa', date: '2026-13-45T00:00:00.000Z' }],
    [{ id: 'changelog-2026-01-01-aaaaaaa' }],
    [{ date: '2026-01-01T00:00:00.000Z' }],
    [{ id: 'changelog-2026-01-01-aaaaaaa', date: '2026-01-01T00:00:00.000Z', userId: 'x' }],
  ])('refuses %j', async body => {
    await mark(body).expect(400);
  });
});

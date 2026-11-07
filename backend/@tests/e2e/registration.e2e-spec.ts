import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { RegistrationStatus } from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

describe('Closing registration (e2e)', () => {
  const stamp = Date.now();
  const adminEmail = `registration-admin-${stamp}@example.com`;
  const memberEmail = `registration-member-${stamp}@example.com`;
  const strangerEmail = `registration-stranger-${stamp}@example.com`;
  const invitedEmail = `registration-invited-${stamp}@example.com`;
  const emails = [adminEmail, memberEmail, strangerEmail, invitedEmail];
  let app: INestApplication;
  let dataSource: DataSource;
  let admin: E2eAccount;
  let member: E2eAccount;

  const save = (account: E2eAccount, open: boolean) =>
    request(app.getHttpServer())
      .put('/settings/instance/registration')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ open });
  const status = async () => {
    const response = await request(app.getHttpServer()).get('/auth/registration').expect(200);
    return Schema.decodeUnknownSync(RegistrationStatus)(response.body);
  };
  const signUp = (email: string, invitationToken?: string) =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Member One', invitationToken });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    admin = await registerAccount(app, adminEmail, 'Registration Admin');
    member = await registerAccount(app, memberEmail, 'Registration Member');
    await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', admin.userId]);
  });

  afterAll(async () => {
    // Every other suite signs people up: the setting must not outlive this one.
    await dataSource.query(`DELETE FROM instance_settings WHERE key = 'registration'`);
    for (const email of emails) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('is open until someone closes it, and anyone can see that', async () => {
    await expect(status()).resolves.toEqual({ open: true });
  });

  it('lets only an instance admin change it', async () => {
    await save(member, false).expect(403);
    await request(app.getHttpServer())
      .put('/settings/instance/registration')
      .send({ open: false })
      .expect(401);
    await expect(status()).resolves.toEqual({ open: true });
  });

  it('turns away a stranger once closed, without saying who has an account', async () => {
    const saved = await save(admin, false).expect(200);
    expect(saved.body).toEqual({ open: false });
    await expect(status()).resolves.toEqual({ open: false });

    const refused = await signUp(strangerEmail).expect(403);
    expect(refused.body.error?.code ?? refused.body.code).toBe('AUTH_REGISTRATION_CLOSED');
    // The same answer for an address that is taken: no way to probe for accounts.
    await signUp(memberEmail).expect(403);
  });

  it('still takes someone with a real invitation, and refuses a made-up one', async () => {
    const invitation = await request(app.getHttpServer())
      .post(`/workspaces/${admin.workspaceId}/invitations`)
      .set('Authorization', `Bearer ${admin.token}`)
      .set('x-workspace-id', admin.workspaceId)
      .send({ email: invitedEmail, role: 'member' })
      .expect(201);

    const madeUp = await signUp(invitedEmail, '00000000-0000-4000-8000-000000000000');
    expect(madeUp.status).toBeGreaterThanOrEqual(400);
    expect(madeUp.status).toBeLessThan(500);

    await signUp(invitedEmail, invitation.body.invitation.token).expect(201);
  });

  it('opens again', async () => {
    const saved = await save(admin, true).expect(200);
    expect(saved.body).toEqual({ open: true });
    await signUp(strangerEmail).expect(201);
  });
});

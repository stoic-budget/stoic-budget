vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A deleted workspace takes its files; a deleted account frees its e-mail (#642). */
describe('Deleting a workspace and an account (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `deleted-again-${stamp}@example.com`;
  const otherEmail = `deleted-other-${stamp}@example.com`;
  let member: E2eAccount;
  let other: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const exists = (file: string) =>
    fs.access(file).then(
      () => true,
      () => false,
    );
  /** A statement of the account's workspace whose file is `file` on disk. */
  const statementOn = async (account: E2eAccount, file: string, amount: string): Promise<void> => {
    const categories = await as(account, request(server()).get('/categories?type=expense')).expect(200);
    const statement = await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', 'ACME Store')
      .field('categoryId', categories.body[0].id)
      .field('date', '2026-10-05')
      .expect(201);
    await dataSource.query('UPDATE statements SET file_path = $1 WHERE id = $2', [file, statement.body.id]);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    member = await registerAccount(app, email, 'Member One');
    other = await registerAccount(app, otherEmail, 'Member Two');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
      await deleteUserByEmail(dataSource, otherEmail);
    }
    await app.close();
  });

  it("removes the workspace's statement files, but not one another workspace still reads", async () => {
    const dir = path.join(resolveUploadsDir(), `e2e-642-${stamp}`);
    await fs.mkdir(dir, { recursive: true });
    const own = path.join(dir, 'own.pdf');
    const shared = path.join(dir, 'shared.pdf');
    await fs.writeFile(own, 'own statement');
    await fs.writeFile(shared, 'shared statement');
    await statementOn(member, own, '12');
    await statementOn(member, shared, '13');
    // A copy of a past version reads the same file.
    await statementOn(other, shared, '14');

    await as(member, request(server()).delete(`/workspaces/${member.workspaceId}`)).expect(200);

    await expect.poll(() => exists(own)).toBe(false);
    expect(await exists(shared)).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('forgets a deleted account, so the same e-mail registers again', async () => {
    await request(server())
      .delete('/users/me')
      .set('Authorization', `Bearer ${member.token}`)
      .send({ currentPassword: 'Test123!@#' })
      .expect(200);

    const [gone] = await dataSource.query(
      'SELECT email, name, deleted_at FROM users WHERE id = $1',
      [member.userId],
    );
    expect(gone).toMatchObject({ email: `deleted-${member.userId}@deleted.invalid`, name: 'Deleted user' });
    expect(gone.deleted_at).not.toBeNull();

    const again = await registerAccount(app, email, 'Member One');
    expect(again.userId).not.toBe(member.userId);
  });
});

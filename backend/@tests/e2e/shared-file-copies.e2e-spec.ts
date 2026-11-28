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
import { BusinessProfileService } from '../../src/modules/business-profile/business-profile.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A copy of a past version (or a backup restored on the same server) names
 * the original's logo file: removing it in one must not take it from the
 * other, and the file goes once nothing names it (#789).
 */
describe('A file shared by a workspace and its copy (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = [`shared-file-a-${stamp}@example.com`, `shared-file-b-${stamp}@example.com`];
  let original: E2eAccount;
  let copy: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const exists = (file: string) =>
    fs.access(file).then(
      () => true,
      () => false,
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    original = await registerAccount(app, emails[0], 'Member One');
    copy = await registerAccount(app, emails[1], 'Member Two');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of emails) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('keeps a logo the copy still shows, and removes it with the last one', async () => {
    const profiles = app.get(BusinessProfileService);
    const fileName = `e2e-789-${stamp}.png`;
    const file = profiles.logoPath(fileName);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, 'ACME logo');
    // Both workspaces name the same file, as a copy made on this server does.
    await profiles.setLogo(original.workspaceId, fileName);
    await profiles.setLogo(copy.workspaceId, fileName);

    await as(original, request(server()).delete('/business-profile/logo')).expect(200);
    expect(await exists(file)).toBe(true);

    await as(copy, request(server()).delete('/business-profile/logo')).expect(200);
    expect(await exists(file)).toBe(false);
  });
});

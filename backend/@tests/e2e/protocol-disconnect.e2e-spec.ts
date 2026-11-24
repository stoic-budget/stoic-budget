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

/** Disconnect forgets the stored connection and its credentials (#788). */
describe('Disconnecting a storage protocol (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `protocol-disconnect-${Date.now()}@example.com`;
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
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('deletes the stored S3 settings and credentials, so nothing reads them', async () => {
    const [integration] = await dataSource.query(
      `INSERT INTO integrations (workspace_id, provider, status) VALUES ($1, 's3_compatible', 'connected') RETURNING id`,
      [owner.workspaceId],
    );
    await dataSource.query(
      `INSERT INTO open_protocol_settings (integration_id, config, encrypted_secrets)
       VALUES ($1, $2, $3)`,
      [
        integration.id,
        JSON.stringify({ endpoint: 'https://s3.example.com', bucket: 'acme-backups', region: 'eu-1' }),
        JSON.stringify({ accessKeyId: 'stored', secretAccessKey: 'stored' }),
      ],
    );
    const before = await as(request(server()).get('/integrations/s3-compatible/status')).expect(200);
    expect(before.body.connected).toBe(true);

    await as(request(server()).delete('/integrations/s3-compatible')).expect(200);

    const [left] = await dataSource.query(
      'SELECT count(*)::int AS n FROM open_protocol_settings WHERE integration_id = $1',
      [integration.id],
    );
    expect(left.n).toBe(0);
    const after = await as(request(server()).get('/integrations/s3-compatible/status')).expect(200);
    expect(after.body.connected).toBe(false);
  });
});

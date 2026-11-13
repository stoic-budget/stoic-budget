vi.mock('franc', () => ({ franc: () => 'und' }));

import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { McpBulkChange } from '../../src/contracts';
import { ApiKeysService } from '../../src/modules/api-keys/api-keys.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * MCP answers with an output contract, read the way an MCP client reads them:
 * the official client checks `structuredContent` against the listed
 * `outputSchema`, and the contract decodes it with data in every list.
 */
describe('API contracts: MCP structured answers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `contracts-mcp-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let client: Client;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const decode = (body: unknown) =>
    Schema.decodeUnknownSync(McpBulkChange as Schema.Codec<unknown, unknown>)(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    const categories = await as(request(app.getHttpServer()).get('/categories?type=expense')).expect(
      200,
    );
    for (const merchant of ['ACME Store - Wireless Buds', 'Example Bakery - Rye Loaf']) {
      await as(request(app.getHttpServer()).post('/statements/manual-expense'))
        .field({
          amount: '12.5',
          currency: 'EUR',
          merchant,
          categoryId: categories.body[0].id,
          date: new Date().toISOString().slice(0, 10),
        })
        .expect(201);
    }
    await as(request(app.getHttpServer()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ plugins: { mcp: true } })
      .expect(200);
    const { key } = await app
      .get(ApiKeysService)
      .generate(owner.workspaceId, owner.userId, 'Contracts MCP', {
        scopes: ['transaction.view', 'transaction.edit'],
      });

    const http = app.getHttpServer();
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    const { port } = http.address() as AddressInfo;
    client = new Client({ name: 'contracts-e2e', version: '0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { 'x-api-key': key } },
      }),
    );
  });

  afterAll(async () => {
    await client?.close();
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('McpBulkChange: approve_transactions preview and applied', async () => {
    const { tools } = await client.listTools();
    expect(tools.find(tool => tool.name === 'approve_transactions')?.outputSchema).toMatchObject({
      type: 'object',
    });
    const rows: Array<{ id: string }> = await dataSource.query(
      `UPDATE transactions SET is_verified = false WHERE workspace_id = $1 RETURNING id`,
      [owner.workspaceId],
    ).then(([updated]) => updated);
    const args = { ids: [...rows.map(row => row.id), '00000000-0000-4000-8000-000000000000'] };

    const preview = await client.callTool({ name: 'approve_transactions', arguments: args });
    const previewed = decode(preview.structuredContent);
    expect(previewed).toMatchObject({ status: 'preview', rows: 2 });
    expect(previewed.examples).toHaveLength(2);
    expect(previewed.skipped).toEqual([
      { reason: 'not_found', ids: ['00000000-0000-4000-8000-000000000000'] },
    ]);

    const applied = await client.callTool({
      name: 'approve_transactions',
      arguments: { ...args, confirmToken: previewed.confirmToken },
    });
    expect(decode(applied.structuredContent)).toMatchObject({ status: 'applied', rows: 2 });
  });
});

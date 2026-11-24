vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A CSV that states no currency takes its wallet's, then the workspace's: never
 * USD by default, nor a code-like word in a row (#675).
 */
describe('CSV currency without a stated one (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let processing: StatementProcessingService;
  const email = `csv-currency-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let gbpWallet: string;
  let uploads = 0;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const statementOf = (id: string) => dataSource.getRepository(Statement).findOneByOrFail({ id });
  /** Processed by the queue's worker when one runs, else here. */
  const processed = async (id: string) => {
    for (let tries = 0; tries < 40; tries++) {
      const { status } = await statementOf(id);
      if (status !== StatementStatus.UPLOADED && status !== StatementStatus.PROCESSING) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    await processing.processStatement(id);
  };
  const upload = async (lines: string[], walletId?: string) => {
    let call = as(request(server()).post('/statements/upload')).attach(
      'files',
      Buffer.from(lines.join('\n')),
      { filename: `export-${uploads++}.csv`, contentType: 'text/csv' },
    );
    if (walletId) call = call.field('walletId', walletId);
    const { body } = await call.expect(201);
    const id: string = body.data[0].id;
    await processed(id);
    return id;
  };
  const currencies = async (statementId: string) =>
    (await dataSource.getRepository(Transaction).find({ where: { statementId } })).map(
      row => row.currency,
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    processing = moduleFixture.get(StatementProcessingService);
    owner = await registerAccount(app, email, 'Member One');
    await dataSource.query('UPDATE workspaces SET currency = $1 WHERE id = $2', ['EUR', owner.workspaceId]);
    const wallet = await as(request(server()).post('/wallets'))
      .send({ name: 'Savings', currency: 'GBP' })
      .expect(201);
    gbpWallet = wallet.body.id;
  });

  afterAll(async () => {
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it("books an upload into a wallet in the wallet's currency, whatever words its rows hold", async () => {
    const id = await upload(
      ['Date,Description,Amount', '05/01/2026,TRY FITNESS CLUB,-30.00', '06/01/2026,ACME Store refund of 12 USD,12.00'],
      gbpWallet,
    );

    expect(await currencies(id)).toEqual(['GBP', 'GBP']);
    expect((await statementOf(id)).currency).toBe('GBP');
  });

  it("falls back to the workspace's currency, not USD", async () => {
    const id = await upload(['Date,Description,Amount', '07/01/2026,ACME Market,-8.00']);

    expect(await currencies(id)).toEqual(['EUR']);
  });

  it('takes a currency the file states above its table over the wallet', async () => {
    const id = await upload(
      ['Account statement,USD', 'Date,Description,Amount', '08/01/2026,ACME Market,-8.00'],
      gbpWallet,
    );

    expect(await currencies(id)).toEqual(['USD']);
  });

  it("a reprocess starts again from the wallet's currency, not the last run's", async () => {
    const id = await upload(['Date,Description,Amount', '09/01/2026,ACME Market,-4.00'], gbpWallet);
    await dataSource.query('UPDATE statements SET currency = $1 WHERE id = $2', ['TRY', id]);

    await as(request(server()).post(`/statements/${id}/reprocess`)).expect(201);
    await processed(id);

    expect((await statementOf(id)).currency).toBe('GBP');
  });
});

vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction } from '../../src/entities/transaction.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A CSV that states no currency takes the statement's own (its wallet's), then
 * the workspace's, never USD by default nor a word in a row (#675).
 */
describe('CSV currency without a stated one (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let processing: StatementProcessingService;
  const email = `csv-currency-${Date.now()}@example.com`;
  let owner: E2eAccount;
  const files: string[] = [];

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  /** A statement as an upload leaves it: its currency the wallet's, or none. */
  const processCsv = async (lines: string[], currency: string) => {
    const filePath = path.join(os.tmpdir(), `csv-currency-${Date.now()}-${files.length}.csv`);
    fs.writeFileSync(filePath, lines.join('\n'));
    files.push(filePath);
    const saved = await dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      fileName: 'export.csv',
      filePath,
      fileType: FileType.CSV,
      fileSize: fs.statSync(filePath).size,
      fileHash: `csv-currency-${Date.now()}-${files.length}`,
      bankName: BankName.OTHER,
      status: StatementStatus.UPLOADED,
      currency,
    } as never);
    await processing.processStatement((saved as unknown as Statement).id);
    return dataSource.getRepository(Transaction).find({ where: { statementId: (saved as unknown as Statement).id } });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    processing = moduleFixture.get(StatementProcessingService);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(app.getHttpServer()).patch(`/workspaces/${owner.workspaceId}`)).send({ currency: 'EUR' }).expect(200);
  });

  afterAll(async () => {
    for (const file of files) fs.rmSync(file, { force: true });
    if (dataSource) await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it("books the rows in the statement's own currency, not lira from a description", async () => {
    const rows = await processCsv(
      ['Date,Description,Amount', '05/01/2026,Try Fitness,-30.00', '06/01/2026,ACME Store,-12.50'],
      'GBP',
    );

    expect(rows.map(row => row.currency)).toEqual(['GBP', 'GBP']);
  });

  it('takes a currency the file states above its table over the statement\'s', async () => {
    const rows = await processCsv(['Account statement,USD', 'Date,Description,Amount', '07/01/2026,ACME Market,-8.00'], 'EUR');

    expect(rows.map(row => row.currency)).toEqual(['USD']);
  });
});

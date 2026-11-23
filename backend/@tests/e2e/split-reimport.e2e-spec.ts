vi.mock('franc', () => ({
  franc: () => 'und',
}));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A split row is still the bank's row: an overlapping export does not add it back (#633). */
describe('Split row and re-import (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let processing: StatementProcessingService;
  const stamp = Date.now();
  const email = `split-reimport-${stamp}@example.com`;
  const files: string[] = [];
  let owner: E2eAccount;
  const ROW = '15.01.2026,ACME Store - Wireless Buds,-100.00';

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  /** Imports a CSV export and hands back its rows. */
  const importCsv = async (name: string, rows: string[]) => {
    const csv = ['Date,Details,Amount', ...rows].join('\n');
    const filePath = path.join(os.tmpdir(), `split-reimport-${stamp}-${name}.csv`);
    files.push(filePath);
    await fs.promises.writeFile(filePath, csv, 'utf-8');
    const saved = await dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      fileName: `${name}.csv`,
      filePath,
      fileType: FileType.CSV,
      fileSize: csv.length,
      fileHash: `split-reimport-${stamp}-${name}`,
      bankName: BankName.OTHER,
      status: StatementStatus.UPLOADED,
      currency: 'EUR',
    });
    await processing.processStatement(saved.id);
    return dataSource.query(
      'SELECT id, amount, is_duplicate, duplicate_of_id FROM transactions WHERE statement_id = $1 ORDER BY transaction_date',
      [saved.id],
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    processing = moduleFixture.get(StatementProcessingService);
    owner = await registerAccount(app, email, 'Member One');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    for (const file of files) {
      await fs.promises.rm(file, { force: true });
    }
    await app.close();
  });

  it('knows the split row in an overlapping export, and again after unsplit', async () => {
    const [original] = await importCsv('january', [ROW]);
    await as(request(server()).post(`/transactions/${original.id}/split`))
      .send({ parts: [{ amount: 60 }, { amount: 40 }] })
      .expect(200);

    const overlap = await importCsv('jan-feb', [ROW, '02.02.2026,Member One,-12.00']);
    expect(overlap[0]).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
    expect(overlap[1]).toMatchObject({ is_duplicate: false });

    await as(request(server()).post(`/transactions/${original.id}/unsplit`)).expect(200);
    const [again] = await importCsv('january-again', [ROW, '20.01.2026,Member One,-5.00']);
    expect(again).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
  });
});

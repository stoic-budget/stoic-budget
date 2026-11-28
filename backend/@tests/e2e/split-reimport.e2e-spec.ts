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
import { AuditService } from '../../src/modules/audit/audit.service';
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

  /** Spending the books count: live rows only. */
  const liveSpending = async () =>
    Number(
      (
        await dataSource.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE workspace_id = $1 AND is_duplicate = false',
          [owner.workspaceId],
        )
      )[0].total,
    );

  it('knows the split row in an overlapping export, and keeps it known when part 0 goes', async () => {
    const [original] = await importCsv('january', [ROW]);
    const split = await as(request(server()).post(`/transactions/${original.id}/split`))
      .send({ parts: [{ amount: 60 }, { amount: 40 }] })
      .expect(200);
    const second = split.body.find((part: { id: string }) => part.id !== original.id);

    const overlap = await importCsv('jan-feb', [ROW, '02.02.2026,Member One,-12.00']);
    expect(overlap[0]).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
    expect(overlap[1]).toMatchObject({ is_duplicate: false });
    expect(await liveSpending()).toBe(112);

    // Deleting the 60 part: the copy of the whole row stays a copy, of the part left.
    await as(request(server()).delete(`/transactions/${original.id}`)).expect(204);
    const [copy] = await dataSource.query(
      'SELECT is_duplicate, duplicate_of_id FROM transactions WHERE id = $1',
      [overlap[0].id],
    );
    expect(copy).toEqual({ is_duplicate: true, duplicate_of_id: second.id });
    expect(await liveSpending()).toBe(52);

    // Undo: the part comes back with the bank row's fingerprint, its copy too.
    const [deleted] = await dataSource.query(
      "SELECT id FROM audit_events WHERE entity_id = $1 AND action = 'delete'",
      [original.id],
    );
    // Undoing a delete is the audit rollback (admins only over HTTP): called directly.
    await app.get(AuditService).rollback(deleted.id, owner.userId, owner.workspaceId);
    const parts = await dataSource.query(
      'SELECT id, fingerprint IS NOT NULL AS holds FROM transactions WHERE id = ANY($1::uuid[]) ORDER BY id = $2 DESC',
      [[original.id, second.id], original.id],
    );
    expect(parts.map((part: { holds: boolean }) => part.holds)).toEqual([true, false]);
    expect(await liveSpending()).toBe(112);

    // A third export: its row is a copy of the live original, never of a copy.
    const [third] = await importCsv('january-third', [ROW, '25.01.2026,Member One,-3.00']);
    expect(third).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
  });

  it('knows the row again after it is split and folded back', async () => {
    const [original] = await importCsv('march', ['15.03.2026,ACME Store - Wireless Buds,-90.00']);
    await as(request(server()).post(`/transactions/${original.id}/split`))
      .send({ parts: [{ amount: 50 }, { amount: 40 }] })
      .expect(200);
    await as(request(server()).post(`/transactions/${original.id}/unsplit`)).expect(200);

    const [again] = await importCsv('march-again', [
      '15.03.2026,ACME Store - Wireless Buds,-90.00',
      '20.03.2026,Member One,-5.00',
    ]);
    expect(again).toMatchObject({ is_duplicate: true, duplicate_of_id: original.id });
  });
});

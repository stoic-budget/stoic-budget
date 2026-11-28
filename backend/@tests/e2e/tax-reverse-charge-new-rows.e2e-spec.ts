vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../../src/app.module';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { StatementProcessingService } from '../../src/modules/parsing/services/statement-processing.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A supplier's EU VAT id, set once on the payee, reverse-charges its new rows too (#667). */
describe('Reverse charge on new rows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `reverse-new-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let office: string;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const expense = async (amount: string, date: string) => {
    const created = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', 'ACME Software')
      .field('categoryId', office)
      .field('date', date)
      .expect(201);
    const [row] = await dataSource.query(
      'SELECT id, payee_id FROM transactions WHERE statement_id = $1',
      [created.body.id],
    );
    return row as { id: string; payee_id: string };
  };
  const taxOf = async (id: string) =>
    (
      await dataSource.query(
        'SELECT tax_amount, tax_reverse_charge FROM transactions WHERE id = $1',
        [id],
      )
    )[0] as { tax_amount: string | null; tax_reverse_charge: boolean };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'EUR' })
      .expect(200);
    await as(request(server()).put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);
    await as(request(server()).put('/tax/settings/vat-status'))
      .send({ status: 'registered' })
      .expect(200);
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    office = (categories.body as Array<{ id: string; name: string }>).find(
      category => category.name === 'Office supplies',
    )?.id as string;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('reverse-charges a new purchase and the parts of its split', async () => {
    const first = await expense('100', '2026-03-10');
    await as(request(server()).patch(`/payees/${first.payee_id}`))
      .send({ countryCode: 'FR', vatId: 'FR00000000001' })
      .expect(200);

    const next = await expense('100', '2026-04-10');
    expect(await taxOf(next.id)).toEqual({ tax_amount: '0.00', tax_reverse_charge: true });

    const split = await as(request(server()).post(`/transactions/${next.id}/split`))
      .send({ parts: [{ amount: 60 }, { amount: 40 }] })
      .expect(200);
    for (const part of split.body as Array<{ id: string }>) {
      expect(await taxOf(part.id)).toEqual({ tax_amount: '0.00', tax_reverse_charge: true });
    }
  });

  it("reverse-charges an imported row, even the first time the bank cuts the name short", async () => {
    const qif = '!Type:Bank\nD05/12/2026\nT-100.00\nPACME SOFTWA\n^\n';
    const filePath = path.join(os.tmpdir(), `reverse-new-${Date.now()}.qif`);
    fs.writeFileSync(filePath, qif, 'utf-8');
    try {
      const saved = await dataSource.getRepository(Statement).save({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        fileName: 'export.qif',
        filePath,
        fileType: FileType.QIF,
        fileSize: qif.length,
        fileHash: `reverse-new-${Date.now()}`,
        bankName: BankName.OTHER,
        status: StatementStatus.UPLOADED,
        currency: 'EUR',
      });
      await app.get(StatementProcessingService).processStatement(saved.id);
      const [row] = await dataSource.query(
        'SELECT id FROM transactions WHERE statement_id = $1',
        [saved.id],
      );

      expect(await taxOf(row.id)).toEqual({ tax_amount: '0.00', tax_reverse_charge: true });
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });
});

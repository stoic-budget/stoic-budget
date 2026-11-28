vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../src/entities/statement.entity';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** Approving a scan in Review documents the bank row it matched, counted once (#687). */
describe('Review approval of a scan matched to a bank row (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `review-scan-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let category: string;

  const statement = (fields: Partial<Statement>) =>
    dataSource.getRepository(Statement).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      fileName: 'doc.pdf',
      filePath: `/tmp/${randomUUID()}.pdf`,
      fileType: FileType.PDF,
      fileSize: 1,
      fileHash: randomUUID(),
      bankName: BankName.OTHER,
      status: StatementStatus.COMPLETED,
      currency: 'EUR',
      ...fields,
    });
  const row = (statementId: string) =>
    dataSource.getRepository(Transaction).save({
      workspaceId: owner.workspaceId,
      statementId,
      transactionDate: new Date('2026-03-10'),
      counterpartyName: 'ACME Store',
      paymentPurpose: 'ACME Store',
      currency: 'EUR',
      transactionType: TransactionType.EXPENSE,
      amount: 80,
      debit: 80,
      credit: null,
      isVerified: false,
    });
  /** A bank row, a scan of its receipt, and the receipt matched to the bank row. */
  const scanOfBankRow = async () => {
    const bankStatement = await statement({ fileName: 'bank.pdf' });
    const bank = await row(bankStatement.id);
    const scanStatement = await statement({
      fileName: 'scan.jpg',
      parsingDetails: { detectedBy: 'receipt-scan' } as Statement['parsingDetails'],
    });
    const scan = await row(scanStatement.id);
    await dataSource.getRepository(Receipt).save({
      userId: owner.userId,
      workspaceId: owner.workspaceId,
      source: ReceiptSource.SCAN,
      subject: 'scan.jpg',
      sender: 'me',
      receivedAt: new Date('2026-03-10'),
      status: ReceiptStatus.DRAFT,
      statementId: scanStatement.id,
      metadata: { transactionMatch: { transactionIds: [bank.id] } } as Receipt['metadata'],
      parsedData: { amount: 80, currency: 'EUR', vendor: 'ACME Store' },
    });
    return { bank, bankStatement, scan };
  };
  const approve = (ids: string[]) =>
    request(app.getHttpServer())
      .post('/review-inbox/transactions/approve')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send({ ids, categoryId: category })
      .expect(200);
  const state = async (id: string) =>
    (
      await dataSource.query(
        'SELECT is_verified, is_duplicate, category_id FROM transactions WHERE id = $1',
        [id],
      )
    )[0];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    const categories = await request(app.getHttpServer())
      .get('/categories?type=expense')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .expect(200);
    category = (categories.body as Array<{ id: string; name: string }>).find(
      item => item.name === 'Office supplies',
    )?.id as string;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('confirms the bank row with the picked category and counts the expense once', async () => {
    const { bank, scan } = await scanOfBankRow();

    await approve([scan.id]);

    expect(await state(bank.id)).toEqual({ is_verified: true, is_duplicate: false, category_id: category });
    expect(await state(scan.id)).toMatchObject({ is_duplicate: true });
    const [receipt] = await dataSource.query('SELECT transaction_id FROM receipts WHERE statement_id = $1', [
      scan.statementId,
    ]);
    expect(receipt.transaction_id).toBe(bank.id);
  });

  it("keeps the scan's own row when the matched bank statement was trashed", async () => {
    const { bankStatement, scan } = await scanOfBankRow();
    await dataSource.query('UPDATE statements SET deleted_at = now() WHERE id = $1', [bankStatement.id]);

    await approve([scan.id]);

    expect(await state(scan.id)).toEqual({ is_verified: true, is_duplicate: false, category_id: category });
  });
});

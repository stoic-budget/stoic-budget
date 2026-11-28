vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A receipt that states no currency is in its workspace's, however it is stored (#685). */
describe('Receipt currency from the workspace (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `receipt-currency-${Date.now()}@example.com`;
  let owner: E2eAccount;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Member One');
    await request(app.getHttpServer())
      .patch(`/workspaces/${owner.workspaceId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .send({ currency: 'EUR' })
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it("stores the workspace's currency on a receipt that states none, and keeps a stated one", async () => {
    const receipts = dataSource.getRepository(Receipt);
    const receipt = await receipts.save(
      receipts.create({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        source: ReceiptSource.IMAP,
        messageId: `receipt-currency-${Date.now()}`,
        subject: 'ACME Store receipt',
        sender: 'shop@example.com',
        receivedAt: new Date(),
        status: ReceiptStatus.PARSED,
        parsedData: { amount: 20, vendor: 'ACME Store' },
      }),
    );
    expect((await receipts.findOneByOrFail({ id: receipt.id })).parsedData?.currency).toBe('EUR');

    // A later save with a stated currency keeps it.
    receipt.parsedData = { ...receipt.parsedData, currency: 'USD' };
    await receipts.save(receipt);
    expect((await receipts.findOneByOrFail({ id: receipt.id })).parsedData?.currency).toBe('USD');
  });
});

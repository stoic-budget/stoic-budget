vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** A Solana transfer's signature fits the row it is booked on. */
describe('Crypto transaction hash length (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `crypto-hash-${Date.now()}@example.com`;
  let owner: E2eAccount;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, email, 'Crypto Hash Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('stores an 88-character Solana signature', async () => {
    const signature = '5'.repeat(88);
    const result = await dataSource
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values({
        workspaceId: owner.workspaceId,
        cryptoAsset: 'SOL',
        cryptoAmount: '1.5',
        cryptoTxHash: signature,
        transactionDate: new Date('2026-11-20'),
        counterpartyName: 'Solana',
        paymentPurpose: 'transfer 1.5 SOL',
        amount: 300,
        credit: 300,
        currency: 'USD',
        transactionType: TransactionType.INCOME,
      })
      .orIgnore()
      .execute();

    expect((result.raw as Array<{ id: string }>)[0]?.id).toBeTruthy();
  });
});

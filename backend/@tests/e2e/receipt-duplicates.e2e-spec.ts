vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Receipt } from '../../src/entities/receipt.entity';
import { ReceiptDuplicateService } from '../../src/modules/receipts/services/receipt-duplicate.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** The same receipt photographed again days later is found by the day of purchase it states. */
describe('Receipt duplicates by purchase date (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let duplicates: ReceiptDuplicateService;
  const email = `receipt-dups-${Date.now()}@example.com`;
  let owner: E2eAccount;

  async function insertReceipt(parsed: Record<string, unknown>, receivedAt: string): Promise<Receipt> {
    const [row] = await dataSource.query(
      `INSERT INTO receipts
         (user_id, workspace_id, source, subject, sender, received_at, parsed_data, status)
       VALUES ($1, $2, 'scan', 'scan.jpg', 'scan', $3, $4::jsonb, 'draft')
       RETURNING id`,
      [owner.userId, owner.workspaceId, receivedAt, JSON.stringify(parsed)],
    );
    return dataSource.getRepository(Receipt).findOneByOrFail({ id: row.id });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    duplicates = moduleFixture.get(ReceiptDuplicateService);
    owner = await registerAccount(app, email, 'Receipt Dups Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('finds a receipt uploaded a week after the purchase when it comes in again', async () => {
    const purchase = { amount: 42.5, currency: 'EUR', vendor: 'ACME Store', date: '2026-10-01' };
    const first = await insertReceipt(purchase, '2026-10-08T18:00:00Z');
    const again = await insertReceipt(purchase, '2026-10-09T09:00:00Z');

    const found = await duplicates.findPotentialDuplicates(again);

    expect(found.map(receipt => receipt.id)).toEqual([first.id]);
  });

  it('does not take a receipt of another purchase day that arrived the same day', async () => {
    const other = await insertReceipt(
      { amount: 19.9, currency: 'EUR', vendor: 'Corner Cafe', date: '2026-09-01' },
      '2026-10-15T08:00:00Z',
    );
    const today = await insertReceipt(
      { amount: 19.9, currency: 'EUR', vendor: 'Corner Cafe', date: '2026-10-15' },
      '2026-10-15T09:00:00Z',
    );

    const found = await duplicates.findPotentialDuplicates(today);

    expect(found.map(receipt => receipt.id)).not.toContain(other.id);
  });

  it('falls back to the arrival time for a receipt whose date was not read', async () => {
    const unread = await insertReceipt(
      { amount: 7.8, currency: 'EUR', vendor: 'Kiosk Example', date: '' },
      '2026-11-02T10:00:00Z',
    );
    const scanned = await insertReceipt(
      { amount: 7.8, currency: 'EUR', vendor: 'Kiosk Example', date: '2026-11-01' },
      '2026-11-20T10:00:00Z',
    );

    const found = await duplicates.findPotentialDuplicates(scanned);

    expect(found.map(receipt => receipt.id)).toContain(unread.id);
  });
});

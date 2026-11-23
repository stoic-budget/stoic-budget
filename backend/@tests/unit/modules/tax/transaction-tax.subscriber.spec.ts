import type { DataSource, InsertEvent } from 'typeorm';
import type { Transaction } from '@/entities/transaction.entity';
import type { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { TransactionTaxSubscriber } from '@/modules/tax/transaction-tax.subscriber';

const assessed = {
  taxRateId: 'rate-19',
  taxRuleId: null,
  taxSource: 'category',
  taxAmount: 19,
  taxReverseCharge: false,
} as const;

function build() {
  const resolve = vi.fn(async () => assessed);
  const subscriber = new TransactionTaxSubscriber(
    { subscribers: [] } as unknown as DataSource,
    { resolve } as unknown as TaxAssignmentService,
  );
  const insert = (entity: Partial<Transaction>) =>
    subscriber.beforeInsert({ entity } as unknown as InsertEvent<Transaction>);
  return { resolve, insert };
}

const payment = (): Partial<Transaction> => ({
  workspaceId: 'ws-1',
  amount: 119,
  debit: 119,
  categoryId: 'cat-office',
  transactionDate: new Date('2026-11-02'),
});

describe('TransactionTaxSubscriber.beforeInsert', () => {
  it('assesses the tax of a row created without it (a payment from a wallet)', async () => {
    const { resolve, insert } = build();
    const row = payment();

    await insert(row);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(row).toMatchObject({ taxRateId: 'rate-19', taxAmount: 19 });
  });

  it('leaves a row whose creator assessed it already', async () => {
    const { resolve, insert } = build();

    await insert({ ...payment(), taxSource: null, taxRateId: null, taxAmount: null });

    expect(resolve).not.toHaveBeenCalled();
  });
});

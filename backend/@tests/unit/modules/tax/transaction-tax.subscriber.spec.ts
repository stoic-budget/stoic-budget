import type { DataSource, InsertEvent, TransactionCommitEvent } from 'typeorm';
import type { Transaction } from '@/entities/transaction.entity';
import type { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { TransactionTaxSubscriber } from '@/modules/tax/transaction-tax.subscriber';

function build() {
  const reassess = vi.fn(async () => 1);
  const subscriber = new TransactionTaxSubscriber(
    { subscribers: [] } as unknown as DataSource,
    { reassess } as unknown as TaxAssignmentService,
  );
  const runner = { isTransactionActive: true, transactionDepth: 1 };
  const insert = (entity: Partial<Transaction>, id = 'tx-1') => {
    const event = { entity, queryRunner: runner } as unknown as InsertEvent<Transaction>;
    subscriber.beforeInsert(event);
    entity.id = id;
    subscriber.afterInsert(event);
  };
  const commit = () => {
    runner.isTransactionActive = false;
    runner.transactionDepth = 0;
    subscriber.afterTransactionCommit({ queryRunner: runner } as unknown as TransactionCommitEvent);
  };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { reassess, insert, commit, runner, subscriber, settle };
}

const payment = (): Partial<Transaction> => ({
  workspaceId: 'ws-1',
  amount: 119,
  debit: 119,
  categoryId: 'cat-office',
  transactionDate: new Date('2026-11-02'),
});

describe('TransactionTaxSubscriber on insert', () => {
  it('assesses a row created without its tax once its transaction commits', async () => {
    const { reassess, insert, commit, settle } = build();

    insert(payment());
    await settle();
    expect(reassess).not.toHaveBeenCalled();

    commit();
    await settle();
    expect(reassess).toHaveBeenCalledWith('ws-1', { ids: ['tx-1'] });
  });

  it('assesses at once an insert made outside a transaction', async () => {
    const { reassess, insert, runner, settle } = build();
    runner.isTransactionActive = false;

    insert(payment());
    await settle();

    expect(reassess).toHaveBeenCalledWith('ws-1', { ids: ['tx-1'] });
  });

  it('assesses nothing a rolled-back transaction inserted', async () => {
    const { reassess, insert, runner, subscriber, settle } = build();

    insert(payment());
    runner.isTransactionActive = false;
    runner.transactionDepth = 0;
    subscriber.afterTransactionRollback({ queryRunner: runner } as never);
    subscriber.afterTransactionCommit({ queryRunner: runner } as never);
    await settle();

    expect(reassess).not.toHaveBeenCalled();
  });

  it('leaves a row whose creator assessed it, and loan interest', async () => {
    const { reassess, insert, commit, settle } = build();

    insert({ ...payment(), taxSource: null, taxRateId: null, taxAmount: null }, 'assessed');
    insert({ ...payment(), loanInterestOfId: 'payment-1' }, 'interest');
    commit();
    await settle();

    expect(reassess).not.toHaveBeenCalled();
  });

  it('waits for the outermost commit, past a released savepoint', async () => {
    const { reassess, insert, commit, runner, subscriber, settle } = build();
    runner.transactionDepth = 2;
    insert(payment());
    // Releasing the savepoint: still inside the outer transaction.
    runner.transactionDepth = 1;
    subscriber.afterTransactionCommit({ queryRunner: runner } as never);
    await settle();
    expect(reassess).not.toHaveBeenCalled();

    commit();
    await settle();
    expect(reassess).toHaveBeenCalledWith('ws-1', { ids: ['tx-1'] });
  });

  it('drops only the rows of a rolled-back savepoint', async () => {
    const { reassess, insert, commit, runner, subscriber, settle } = build();
    insert(payment(), 'outer');
    runner.transactionDepth = 2;
    insert(payment(), 'inner');
    runner.transactionDepth = 1;
    subscriber.afterTransactionRollback({ queryRunner: runner } as never);

    commit();
    await settle();
    expect(reassess).toHaveBeenCalledWith('ws-1', { ids: ['outer'] });
  });
});

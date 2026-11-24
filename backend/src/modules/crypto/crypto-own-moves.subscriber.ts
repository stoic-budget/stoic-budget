import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { CryptoWallet } from '../../entities/crypto-wallet.entity';

/**
 * A wallet connected after the user's other wallets already sent coins to it,
 * or got coins from it, turns those stored rows into what they were: moves
 * between one's own accounts (#695). Read at the time, the address was a
 * stranger's, so the row stood as a spend (or income) and, worse, as a
 * disposal in the cost basis. Marked as an exchange import marks a move: the
 * `move` leg the lots leave out, and a pair of one that every total reads as
 * "not spending". Runs once the wallet is committed.
 */
@Injectable()
export class CryptoOwnMovesSubscriber implements EntitySubscriberInterface<CryptoWallet> {
  private readonly logger = new Logger(CryptoOwnMovesSubscriber.name);
  private readonly queued = new WeakMap<QueryRunner, Array<() => Promise<void>>>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return CryptoWallet;
  }

  afterInsert(event: InsertEvent<CryptoWallet>): void {
    const wallet = event.entity;
    if (!(wallet?.address && wallet.workspaceId)) return;
    const task = () => this.markMoves(wallet.workspaceId, wallet.id, wallet.address as string);
    const runner = event.queryRunner;
    if (runner?.isTransactionActive) {
      this.queued.set(runner, [...(this.queued.get(runner) ?? []), task]);
    } else {
      void task();
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const tasks = this.queued.get(event.queryRunner);
    this.queued.delete(event.queryRunner);
    for (const task of tasks ?? []) void task();
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.queued.delete(event.queryRunner);
  }

  async markMoves(workspaceId: string, walletId: string, address: string): Promise<void> {
    await this.dataSource
      .query(
        `UPDATE "transactions"
            SET "crypto_leg" = 'move',
                "transfer_pair_id" = COALESCE("transfer_pair_id", gen_random_uuid()),
                "transfer_pair_source" = COALESCE("transfer_pair_source", 'auto'),
                "transfer_pair_kind" = COALESCE("transfer_pair_kind", 'transfer')
          WHERE "workspace_id" = $1
            AND "crypto_wallet_id" IS NOT NULL AND "crypto_wallet_id" <> $2
            AND "crypto_leg" = 'value'
            AND lower("counterparty_account") = lower($3)`,
        [workspaceId, walletId, address],
      )
      .catch(error => this.logger.warn(`Own moves not marked for ${walletId}: ${String(error)}`));
  }
}

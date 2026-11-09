import type { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { type DataSource, In } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';
import { writeClassification } from '../../classification/engine/rule-row-write';
import type { ClassificationService } from '../../classification/services/classification.service';
import type { TransactionsImportedEvent } from '../../notifications/events/notification-events';

/**
 * Rows without a category get one the same way an imported statement does:
 * rules first, then what the user taught about the payee. A transfer's legs
 * are no spending and get none.
 */
export async function categorizeImported(
  deps: { dataSource: DataSource; classification?: ClassificationService; logger: Logger },
  userId: string,
  workspaceId: string,
  statementIds: string[],
): Promise<void> {
  if (!(deps.classification && statementIds.length)) {
    return;
  }
  try {
    const repo = deps.dataSource.getRepository(Transaction);
    const pending = await repo.find({ where: { workspaceId, statementId: In(statementIds) } });
    for (const tx of pending.filter(row => !row.categoryId && !row.transferPairId)) {
      const result = await deps.classification.classifyTransaction(tx, userId);
      await writeClassification(deps.dataSource.manager, tx, result);
    }
  } catch (error) {
    deps.logger.warn(
      `Categorization after import failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** One `transactions.imported` per statement the import created, after the commit. */
export async function announceImported(
  dataSource: DataSource,
  eventEmitter: EventEmitter2 | undefined,
  workspaceId: string,
  statementIds: string[],
): Promise<void> {
  if (!eventEmitter) {
    return;
  }
  for (const statementId of statementIds) {
    const rows = await dataSource.getRepository(Transaction).find({
      select: { id: true },
      where: { workspaceId, statementId },
    });
    if (rows.length > 0) {
      eventEmitter.emit('transactions.imported', {
        workspaceId,
        source: 'entity_import',
        statementId,
        transactionIds: rows.map(row => row.id),
      } satisfies TransactionsImportedEvent);
    }
  }
}

/** The category lists are cached per workspace; an import that adds or removes categories drops them. */
export async function invalidateCategoryCache(
  cache: { del(key: string): Promise<unknown> },
  workspaceId: string,
): Promise<void> {
  for (const kind of ['all', 'income', 'expense']) {
    await cache.del(`categories:${workspaceId}:${kind}`);
  }
}

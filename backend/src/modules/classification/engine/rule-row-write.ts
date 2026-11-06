import type { EntityManager } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';
import { addTransactionTags } from './rule-tags';

/**
 * Writes onto a row already saved what the classifier decided for it: the
 * category with where it came from, and the tags of the rule that matched.
 * A row being imported takes the classification whole instead; this is for the
 * paths that classify after the insert (a CSV import, a converted table).
 */
export async function writeClassification(
  manager: EntityManager,
  row: Pick<Transaction, 'id' | 'workspaceId'>,
  classification: Partial<Transaction>,
): Promise<void> {
  if (!row.workspaceId) {
    return;
  }
  const { categoryId, categorySource, categoryReason, tags } = classification;
  if (categoryId) {
    await manager.update(
      Transaction,
      { id: row.id, workspaceId: row.workspaceId },
      {
        categoryId,
        categorySource: categorySource ?? null,
        categoryReason: categoryReason ?? null,
      },
    );
  }
  await addTransactionTags(
    manager,
    row.workspaceId,
    [row.id],
    (tags ?? []).map(tag => tag.id),
  );
}

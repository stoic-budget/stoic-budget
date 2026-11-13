import type { DeepPartial, EntityManager } from 'typeorm';
import { Transaction } from '../../../entities/transaction.entity';
import { lockStatements, recountStatementTotals } from '../../statements/helpers/statement-totals';
import { type DeletedRowLinks, restoreLinks } from './transaction-delete-links';

/** The links a delete event recorded; an event written before they were recorded has none. */
export function recordedLinks(meta: Record<string, unknown> | null | undefined): DeletedRowLinks {
  const links = meta?.links as Partial<DeletedRowLinks> | undefined;
  return {
    partners: links?.partners ?? [],
    copies: links?.copies ?? [],
    splitSiblings: links?.splitSiblings ?? [],
    reimbursements: links?.reimbursements ?? [],
  };
}

/**
 * Brings a deleted transaction back from its audit snapshot, in one database
 * transaction with what the delete changed around it (see `restoreLinks`), and
 * recounts its statement.
 *
 * Locks are taken in the order a delete takes them: the rows this undo will
 * change, in id order, then the statement, and only then the insert (whose
 * foreign key to the statement would otherwise hold it first).
 *
 * A link to a row that is gone meanwhile is dropped from the restored row: the
 * foreign key would refuse it, and a duplicate flag without its master would
 * hide the charge for good.
 */
export async function restoreDeletedTransaction(
  manager: EntityManager,
  workspaceId: string,
  before: Record<string, unknown>,
  links: DeletedRowLinks,
): Promise<void> {
  await manager.transaction(async tx => {
    const repo = tx.getRepository(Transaction);
    const row = repo.create(before as DeepPartial<Transaction>);
    row.workspaceId = workspaceId;

    const linked = [
      row.duplicateOfId,
      row.reimbursementOfId,
      ...links.partners.map(link => link.id),
      ...links.copies.map(link => link.id),
      ...links.splitSiblings.map(link => link.id),
      ...links.reimbursements,
    ].filter((id): id is string => Boolean(id));
    const present = new Set(
      linked.length === 0
        ? []
        : (
            (await tx.query(
              `SELECT id FROM transactions WHERE workspace_id = $1 AND id = ANY($2::uuid[])
               ORDER BY id FOR UPDATE`,
              [workspaceId, [...new Set(linked)]],
            )) as Array<{ id: string }>
          ).map(found => found.id),
    );
    await lockStatements(tx, workspaceId, [row.statementId]);

    if (row.duplicateOfId && !present.has(row.duplicateOfId)) {
      row.isDuplicate = false;
      row.duplicateOfId = null;
      row.duplicateConfidence = null;
      row.duplicateMatchType = null;
    }
    if (row.reimbursementOfId && !present.has(row.reimbursementOfId)) {
      row.reimbursementOfId = null;
    }

    const saved = await repo.save(row);
    await restoreLinks(tx, workspaceId, saved, links);
    await recountStatementTotals(tx, workspaceId, [saved.statementId]);
  });
}

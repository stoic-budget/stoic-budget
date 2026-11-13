import type { EntityManager } from 'typeorm';

/**
 * Sets each statement's row count and debit/credit totals from its rows as they
 * are now, by the rule the import writes them with: every row of the statement,
 * suspected duplicates included, since the totals describe the document itself
 * (analytics leaves duplicates out on its own). Summed in SQL, so the decimals
 * stay exact.
 *
 * The statements are locked first, in id order, in a statement of their own:
 * the recount that follows then reads what a concurrent writer of the same
 * statement committed while this one waited, instead of a stale snapshot.
 */
export async function recountStatementTotals(
  manager: EntityManager,
  workspaceId: string,
  statementIds: ReadonlyArray<string | null | undefined>,
): Promise<void> {
  const ids = await lockStatements(manager, workspaceId, statementIds);
  if (ids.length === 0) {
    return;
  }
  await manager.query(
    `UPDATE statements s SET
       total_transactions = totals.row_count,
       total_debit = totals.debits,
       total_credit = totals.credits
     FROM (
       SELECT st.id,
              count(t.id)::int AS row_count,
              COALESCE(sum(t.debit), 0) AS debits,
              COALESCE(sum(t.credit), 0) AS credits
       FROM statements st
       LEFT JOIN transactions t
         ON t.statement_id = st.id AND t.workspace_id = st.workspace_id
       WHERE st.workspace_id = $1 AND st.id = ANY($2::uuid[])
       GROUP BY st.id
     ) totals
     WHERE s.id = totals.id AND s.workspace_id = $1`,
    [workspaceId, ids],
  );
}

/**
 * Locks the statements in id order. Writers that change a statement's rows take
 * the row locks first and this one last, so they queue instead of deadlocking.
 */
export async function lockStatements(
  manager: EntityManager,
  workspaceId: string,
  statementIds: ReadonlyArray<string | null | undefined>,
): Promise<string[]> {
  const ids = [...new Set(statementIds.filter((id): id is string => Boolean(id)))].sort();
  if (ids.length > 0) {
    await manager.query(
      `SELECT id FROM statements WHERE workspace_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE`,
      [workspaceId, ids],
    );
  }
  return ids;
}

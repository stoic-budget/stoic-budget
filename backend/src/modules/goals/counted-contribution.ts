/**
 * SQL: a contribution counts — it has no row (`transactionId` null matches
 * none), or its row is not a duplicate, not still pending at the bank and not
 * on a trashed statement. A row still waiting in Review counts, as it always
 * did: linking it moves the goal at once, as the link's hint says. Scoped to
 * the workspace, so Postgres looks the row up by key instead of scanning.
 */
export function countedLinkSql(transactionId: string, workspaceId: string): string {
  return `NOT EXISTS (SELECT 1 FROM transactions linked
    WHERE linked.workspace_id = ${workspaceId} AND linked.id = ${transactionId}
      AND (linked.is_duplicate = true OR linked.is_pending = true
        OR EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = linked.statement_id AND trashed.deleted_at IS NOT NULL)))`;
}

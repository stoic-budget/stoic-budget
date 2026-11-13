import type { EntityManager } from 'typeorm';

/** A tag set as the history compares it: sorted ids, comma-joined; empty is null. */
export function tagSetKey(ids: readonly string[]): string | null {
  return ids.length > 0 ? [...ids].sort().join(',') : null;
}

/** The ids of a tag-set key; null reads as no tags. */
export function tagSetIds(key: string | null): string[] {
  return key ? key.split(',') : [];
}

/** The row's tags right now, read inside the caller's transaction. */
export async function currentTagIds(
  manager: EntityManager,
  transactionId: string,
): Promise<string[]> {
  const links: Array<{ tag_id: string }> = await manager.query(
    'SELECT tag_id FROM transaction_tags WHERE transaction_id = $1',
    [transactionId],
  );
  return links.map(link => link.tag_id);
}

/**
 * Puts a row's tags back from `after` to `before`, inside the caller's DB
 * transaction and with the row locked. Returns null, changing nothing, when the
 * row no longer carries exactly `after`: somebody changed its tags since, and
 * undoing blindly would take away (or bring back) a tag they chose.
 * A tag deleted since cannot come back and is left out.
 */
export async function restoreTagSet(
  manager: EntityManager,
  transactionId: string,
  workspaceId: string,
  before: readonly string[],
  after: readonly string[],
): Promise<{ was: string[]; now: string[] } | null> {
  const locked = await manager.query(
    'SELECT id FROM transactions WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
    [transactionId, workspaceId],
  );
  if (locked.length === 0) {
    return null;
  }
  const was = await currentTagIds(manager, transactionId);
  if (tagSetKey(was) !== tagSetKey(after)) {
    return null;
  }
  const remove = after.filter(id => !before.includes(id));
  const add = before.filter(id => !after.includes(id));
  if (remove.length > 0) {
    await manager.query(
      'DELETE FROM transaction_tags WHERE transaction_id = $1 AND tag_id = ANY($2::uuid[])',
      [transactionId, remove],
    );
  }
  if (add.length > 0) {
    await manager.query(
      `INSERT INTO transaction_tags (transaction_id, tag_id)
       SELECT $1, id FROM tags WHERE workspace_id = $2 AND id = ANY($3::uuid[])
       ON CONFLICT DO NOTHING`,
      [transactionId, workspaceId, add],
    );
  }
  return { was, now: await currentTagIds(manager, transactionId) };
}

/** A later audit entry of the row that changed its tags: a hand edit or another bulk add. */
export function touchesTags(event: {
  meta?: Record<string, unknown> | null;
  diff?: unknown;
}): boolean {
  const path = typeof event.meta?.path === 'string' ? event.meta.path : '';
  if (path.endsWith('/tags')) {
    return true;
  }
  const diff = event.diff as { after?: Record<string, unknown> | null } | null | undefined;
  return Boolean(diff && !Array.isArray(diff) && diff.after && 'tagIds' in diff.after);
}

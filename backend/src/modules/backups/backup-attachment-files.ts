import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DataSource } from 'typeorm';
import {
  sha256Of,
  storedAttachmentPath,
} from '../transactions/services/transaction-attachment-files';

const TABLE = 'transaction_attachments';
/** Where an attachment's bytes sit inside a backup or a version. */
const PORTABLE_PREFIX = 'transaction-attachments/';

/**
 * A backup (and so a workspace version) carries the files pinned to rows, not
 * only their rows: restored elsewhere, or after the original was deleted, the
 * row would otherwise name a file that is not there. Each row's stored name
 * becomes the file's path in the archive; a row whose file is already gone
 * from disk is left out, since it could not be opened anyway.
 */
export async function collectTransactionAttachmentFiles(
  records: Record<string, unknown>[],
  files: Array<{ path: string; contents: Buffer }>,
): Promise<Record<string, unknown>[]> {
  const kept: Record<string, unknown>[] = [];
  for (const record of records) {
    if (typeof record.storedFileName !== 'string') continue;
    const stored = path.basename(record.storedFileName);
    const contents = await fs.readFile(storedAttachmentPath(stored)).catch(() => null);
    if (!contents) continue;
    const portablePath = `${PORTABLE_PREFIX}${String(record.id)}/${stored}`;
    files.push({ path: portablePath, contents });
    kept.push({ ...record, storedFileName: portablePath });
  }
  return kept;
}

/**
 * The archive with only the attachment rows whose file it carries. Backups
 * made before files were included name a file on some server's disk; such a
 * row is dropped rather than pointed at another workspace's file.
 */
export function withRestorableAttachments<
  T extends { collections: Record<string, unknown[]>; files: Map<string, Buffer> },
>(opened: T): T {
  const rows = opened.collections[TABLE];
  if (!rows) return opened;
  const carried = rows.filter(row => {
    const name = (row as Record<string, unknown> | null)?.storedFileName;
    return typeof name === 'string' && opened.files.has(name);
  });
  return { ...opened, collections: { ...opened.collections, [TABLE]: carried } };
}

/**
 * An approved receipt's photo is also copied onto its bank row, so a backup
 * would carry the same bytes twice. An attachment whose bytes another file of
 * the backup already carries points at that file instead; a restore still
 * gives the attachment a copy of its own.
 */
export function shareIdenticalAttachmentFiles(
  collections: Record<string, unknown[]>,
  files: Array<{ path: string; contents: Buffer }>,
): void {
  const firstPathBySha = new Map<string, string>();
  const shared = new Map<string, string>();
  // Other documents first, so an attachment points at the receipt, not the other way round.
  const ordered = [...files].sort(
    (a, b) =>
      Number(a.path.startsWith(PORTABLE_PREFIX)) - Number(b.path.startsWith(PORTABLE_PREFIX)),
  );
  for (const file of ordered) {
    const sha = sha256Of(file.contents) as string;
    const first = firstPathBySha.get(sha);
    if (first === undefined) firstPathBySha.set(sha, file.path);
    else if (file.path.startsWith(PORTABLE_PREFIX)) shared.set(file.path, first);
  }
  if (shared.size === 0) return;
  for (const record of (collections[TABLE] ?? []) as Record<string, unknown>[]) {
    const target = shared.get(String(record.storedFileName));
    if (target) record.storedFileName = target;
  }
  for (let index = files.length - 1; index >= 0; index--) {
    if (shared.has(files[index].path)) files.splice(index, 1);
  }
}

/**
 * Backups and versions made before files were carried name a file on this
 * server's disk. Such a file comes back (as a copy) only while it is still
 * there and the person restoring can open it today: it is pinned to a row,
 * in a workspace they belong to, that is not another member's private row.
 * That is exactly what they could download anyway, so a crafted archive
 * naming someone else's file gets nothing. Anything else is dropped by
 * withRestorableAttachments.
 *
 * The lookup goes through the restorer's memberships rather than one
 * workspace: the archive's source workspace is whatever the archive says.
 */
export async function withLegacyAttachmentFiles<
  T extends { collections: Record<string, unknown[]>; files: Map<string, Buffer> },
>(dataSource: DataSource, userId: string, opened: T): Promise<T> {
  const named = (opened.collections[TABLE] ?? [])
    .map(row => (row as Record<string, unknown> | null)?.storedFileName)
    .filter(
      (name): name is string =>
        typeof name === 'string' && path.basename(name) === name && !opened.files.has(name),
    );
  if (named.length === 0) return opened;
  const readable: Array<{ stored_file_name: string }> = await dataSource.query(
    `SELECT DISTINCT ta.stored_file_name
       FROM transaction_attachments ta
       JOIN workspace_members wm ON wm.workspace_id = ta.workspace_id AND wm.user_id = $1
       JOIN transactions t ON t.id = ta.transaction_id AND t.workspace_id = ta.workspace_id
      WHERE ta.stored_file_name = ANY($2::text[])
        AND (t.is_private = false OR t.owner_member_id = wm.id)`,
    [userId, named],
  );
  const files = new Map(opened.files);
  for (const { stored_file_name: name } of readable) {
    const bytes = await fs.readFile(storedAttachmentPath(name)).catch(() => null);
    if (bytes) files.set(name, bytes);
  }
  return { ...opened, files };
}

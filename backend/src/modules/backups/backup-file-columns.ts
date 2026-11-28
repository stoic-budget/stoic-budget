import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { LOGO_DIRECTORY } from '../business-profile/business-profile.service';
import { COVER_DIRECTORY } from '../goals/goal-cover.constants';
import { ITEM_IMAGE_DIRECTORY } from '../item-images/item-images.service';

/**
 * Columns that name one picture in a folder of the uploads directory (#677).
 * A backup, and so a version, carries the file, not only its name: restored
 * elsewhere the picture would be lost, and restored on the same server the
 * copy would point at the original's file, so deleting it in one deleted it
 * in both. On restore each gets a fresh name, so the copy owns its file.
 */
export const FILE_COLUMNS = [
  {
    table: 'workspace_business_profiles',
    column: 'logoFile',
    directory: LOGO_DIRECTORY,
    key: 'workspaceId',
  },
  { table: 'goals', column: 'coverFile', directory: COVER_DIRECTORY, key: 'id' },
  // The row is the picture: without its file there is nothing to restore.
  {
    table: 'item_images',
    column: 'fileName',
    directory: ITEM_IMAGE_DIRECTORY,
    key: 'id',
    rowIsPicture: true,
  },
] as const;

type FileColumn = (typeof FILE_COLUMNS)[number];

const columnOf = (table: string): FileColumn | undefined =>
  FILE_COLUMNS.find(item => item.table === table);
/** Only the image types an upload accepts: anything else could never be shown. */
const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

/** The records with their picture carried in the archive; one whose file is gone keeps none. */
export async function collectColumnFiles(
  table: string,
  records: Record<string, unknown>[],
  files: Array<{ path: string; contents: Buffer }>,
): Promise<Record<string, unknown>[]> {
  const spec = columnOf(table);
  if (!spec) return records;
  const carried = await Promise.all(
    records.map(async record => {
      const stored = record[spec.column];
      if (typeof stored !== 'string') return record;
      const name = path.basename(stored);
      const contents = await fs
        .readFile(path.join(resolveUploadsDir(), spec.directory, name))
        .catch(() => null);
      if (!contents) return { ...record, [spec.column]: null };
      const portablePath = `${spec.directory}/${String(record[spec.key])}/${name}`;
      files.push({ path: portablePath, contents });
      return { ...record, [spec.column]: portablePath };
    }),
  );
  // A picture row without its file is left out, not kept without a picture.
  return 'rowIsPicture' in spec
    ? carried.filter(record => typeof record[spec.column] === 'string')
    : carried;
}

/**
 * A backup's rows whose picture is the row itself, kept only when the archive
 * carries that picture: an older archive (or a missing file) names the
 * original's file, and the row could not be restored with a picture of its own.
 */
export function withRestorablePictures<
  T extends { collections: Record<string, unknown[]>; files: Map<string, Buffer> },
>(opened: T): T {
  const collections = { ...opened.collections };
  for (const spec of FILE_COLUMNS) {
    if (!('rowIsPicture' in spec) || !collections[spec.table]) continue;
    collections[spec.table] = collections[spec.table].filter(row => {
      const stored = (row as Record<string, unknown> | null)?.[spec.column];
      // The same test a restore applies, so a row that passes is restored with its picture.
      return (
        typeof stored === 'string' &&
        IMAGE.test(stored) &&
        stored.startsWith(`${spec.directory}/`) &&
        opened.files.has(stored)
      );
    });
  }
  return { ...opened, collections };
}

/**
 * Gives a restored row its own copy of its picture: staged under a fresh name in
 * its folder. An older archive names the original's file instead, which is the
 * sharing this prevents, so such a row comes back without its picture.
 */
export async function restoreColumnFile(
  table: string,
  source: Record<string, unknown>,
  mapped: Record<string, unknown>,
  stage: (portablePath: string, targetPath: (safeName: string) => string) => Promise<string>,
): Promise<boolean> {
  const spec = columnOf(table);
  if (!spec) return false;
  const stored = source[spec.column];
  if (typeof stored !== 'string') return true;
  if (!(IMAGE.test(stored) && stored.startsWith(`${spec.directory}/`))) {
    mapped[spec.column] = null;
    return true;
  }
  const target = await stage(stored, safeName => {
    const extension = path.extname(safeName).toLowerCase();
    return path.join(resolveUploadsDir(), spec.directory, `${randomUUID()}${extension}`);
  });
  mapped[spec.column] = path.basename(target);
  return true;
}

/** The pictures only this workspace's rows name, as files on disk: what discarding it removes. */
export async function columnFilesOf(
  query: (sql: string, params: unknown[]) => Promise<Array<{ name: string }>>,
  workspaceId: string,
): Promise<string[]> {
  // A file another workspace still names stays: a version opened before its
  // pictures were copied points at the original's, which must survive it.
  const sql = FILE_COLUMNS.map((spec, index) => {
    const column = snake(spec.column);
    return `SELECT t.${column} AS name, ${index} AS spec FROM ${spec.table} t
        WHERE t.workspace_id = $1 AND t.${column} IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM ${spec.table} o
                           WHERE o.${column} = t.${column} AND o.workspace_id <> $1)`;
  }).join(' UNION ALL ');
  const rows = (await query(sql, [workspaceId])) as Array<{ name: string; spec: number }>;
  return rows.map(row =>
    path.join(resolveUploadsDir(), FILE_COLUMNS[row.spec].directory, path.basename(row.name)),
  );
}

const snake = (column: string) => column.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

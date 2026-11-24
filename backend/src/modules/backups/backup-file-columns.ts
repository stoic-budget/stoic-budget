import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { LOGO_DIRECTORY } from '../business-profile/business-profile.service';
import { COVER_DIRECTORY } from '../goals/goal-cover.constants';

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
  return Promise.all(
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

/** The pictures a workspace's rows name, as files on disk: what discarding it removes. */
export async function columnFilesOf(
  query: (sql: string, params: unknown[]) => Promise<Array<{ name: string }>>,
  workspaceId: string,
): Promise<string[]> {
  const sql = FILE_COLUMNS.map(
    (spec, index) =>
      `SELECT ${snake(spec.column)} AS name, ${index} AS spec FROM ${spec.table}
        WHERE workspace_id = $1 AND ${snake(spec.column)} IS NOT NULL`,
  ).join(' UNION ALL ');
  const rows = (await query(sql, [workspaceId])) as Array<{ name: string; spec: number }>;
  return rows.map(row =>
    path.join(resolveUploadsDir(), FILE_COLUMNS[row.spec].directory, path.basename(row.name)),
  );
}

const snake = (column: string) => column.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

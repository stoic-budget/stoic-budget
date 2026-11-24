import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  BACKGROUND_DIRECTORY,
  BACKGROUND_URL_PREFIX,
} from '../workspaces/workspace-background.constants';

/**
 * The workspace's own background picture (#677). Uploaded ones live in the
 * uploads folder and are named by URL, so a backup carried only the URL: a
 * restore elsewhere lost the picture, and a copy on the same server showed
 * the original's file rather than one of its own. A built-in choice is not a
 * file and travels as it is. The photo's credit travels with it.
 */
const UPLOADED = `${BACKGROUND_URL_PREFIX}/`;
const PORTABLE = `${BACKGROUND_DIRECTORY}/`;
const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

/** The value a snapshot keeps for the background, with an uploaded picture put into `files`. */
export async function carryBackground(
  stored: string | null,
  workspaceId: string,
  files: Array<{ path: string; contents: Buffer }>,
): Promise<string | null> {
  if (!stored?.startsWith(UPLOADED)) return stored;
  const name = path.basename(stored);
  const contents = await fs
    .readFile(path.join(resolveUploadsDir(), BACKGROUND_DIRECTORY, name))
    .catch(() => null);
  if (!contents) return null;
  const portablePath = `${PORTABLE}${workspaceId}/${name}`;
  files.push({ path: portablePath, contents });
  return portablePath;
}

/** What a new workspace starts with: a built-in choice as it is; a picture comes with the files. */
export function startingBackground(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  // An older archive names the original's upload: sharing it is what #677 was.
  return stored.startsWith(UPLOADED) || stored.startsWith(PORTABLE) ? null : stored;
}

/**
 * Stages a carried picture under a fresh name with the restore's other files,
 * and answers the URL the workspace should show; null when there is none.
 */
export async function stageBackground(
  stored: unknown,
  files: Map<string, Buffer>,
  restoreDirectory: string,
  stagedFiles: Array<{ stagedPath: string; targetPath: string }>,
): Promise<string | null> {
  if (typeof stored !== 'string' || !stored.startsWith(PORTABLE) || !IMAGE.test(stored))
    return null;
  const contents = files.get(stored);
  if (!contents) return null;
  const name = `${randomUUID()}${path.extname(stored).toLowerCase()}`;
  const stagedPath = path.join(restoreDirectory, `${randomUUID()}-${name}`);
  await fs.writeFile(stagedPath, contents, { flag: 'wx' });
  stagedFiles.push({
    stagedPath,
    targetPath: path.join(resolveUploadsDir(), BACKGROUND_DIRECTORY, name),
  });
  return `${UPLOADED}${name}`;
}

/**
 * The uploaded background only this workspace names, as a file on disk: what
 * discarding an opened version removes. A copy opened before backgrounds were
 * carried names the original's file, which stays.
 */
export async function ownBackgroundFile(
  query: (sql: string, params: unknown[]) => Promise<Array<{ name: string }>>,
  workspaceId: string,
): Promise<string[]> {
  const rows = await query(
    `SELECT w.background_image AS name FROM workspaces w
      WHERE w.id = $1 AND w.background_image LIKE $2
        AND NOT EXISTS (SELECT 1 FROM workspaces o
                         WHERE o.background_image = w.background_image AND o.id <> $1)`,
    [workspaceId, `${UPLOADED}%`],
  );
  return rows.map(row =>
    path.join(resolveUploadsDir(), BACKGROUND_DIRECTORY, path.basename(row.name)),
  );
}

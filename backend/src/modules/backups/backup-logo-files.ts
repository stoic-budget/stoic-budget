import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { LOGO_DIRECTORY } from '../business-profile/business-profile.service';

/** Where a business logo sits inside a backup or a version. */
export const LOGO_PORTABLE_PREFIX = 'workspace-logos/';

/**
 * The invoice logo travels with the backup (#677): restored elsewhere the
 * invoices would lose it, and restored on the same server the copy would point
 * at the original's file, so deleting it in one deleted it in both. A logo
 * whose file is already gone is left out: it could not be shown anyway.
 */
export async function collectLogoFiles(
  records: Record<string, unknown>[],
  files: Array<{ path: string; contents: Buffer }>,
): Promise<Record<string, unknown>[]> {
  return Promise.all(
    records.map(async record => {
      if (typeof record.logoFile !== 'string') return record;
      const name = path.basename(record.logoFile);
      const contents = await fs
        .readFile(path.join(resolveUploadsDir(), LOGO_DIRECTORY, name))
        .catch(() => null);
      if (!contents) return { ...record, logoFile: null };
      // The profile's key is its workspace: one profile, one logo per workspace.
      const portablePath = `${LOGO_PORTABLE_PREFIX}${String(record.workspaceId)}/${name}`;
      files.push({ path: portablePath, contents });
      return { ...record, logoFile: portablePath };
    }),
  );
}

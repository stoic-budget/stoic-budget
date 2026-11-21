import * as fs from 'fs';
import * as path from 'path';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';

/**
 * Generated reports live under uploads/ rather than the OS temp dir, because
 * report history rows keep pointing at them long after the download stream ends.
 * One directory per workspace, and every writer adds a random prefix to the
 * file: a name built from a template id and dates alone was shared by every
 * workspace, so one workspace's run overwrote the file another's history served.
 */
export function reportsDirOf(workspaceId: string): string {
  return path.join(resolveUploadsDir(), 'reports', workspaceId);
}

export function resolveReportsDir(workspaceId: string): string {
  const dir = reportsDirOf(workspaceId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
